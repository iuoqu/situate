"""把 eval 翻车样本喂回 Claude，让它指 RUBRIC 哪几行该改。

用法：
    python revise_rubric.py            # 看 train 桶，不看 holdout
    python revise_rubric.py --include-holdout   # 也看 holdout（确认大改之前）
    python revise_rubric.py --mode partial      # 改 RUBRIC_PARTIAL 而不是 FULL

流程：
    1. 读 results/ 里所有 .json（即上一轮 run_eval.py 的输出）
    2. 跟 expectations.json 对账，找出失败和 borderline 案例
    3. 把当前 RUBRIC + 失败样本（含文本 / 期望 / 模型推理）+ 代表性 PASS 案例
       一起喂给 Claude，强制 tool_use 输出修改建议
    4. 把建议打印 + 写到 revision_proposals/<timestamp>.json

注意：本脚本本身要调 Claude，**不走 ANALYZER_URL**——meta 推理是开发工作，
请在本地用 ANTHROPIC_API_KEY 跑。默认用 opus-4-7（开高思考），因为 RUBRIC 改动
是高杠杆决策，比单篇诊断值钱。
"""
from __future__ import annotations

import argparse
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Literal

import anthropic

from analyze import RUBRIC_FULL, RUBRIC_PARTIAL
from run_eval import (
    SPEC_DIR,
    RESULT_DIR,
    EXPECT_FILE,
    check_full,
    check_partial,
    confidence_of,
    primary_engine,
    collect_specimens,
)

ROOT = Path(__file__).parent
PROPOSAL_DIR = ROOT / "revision_proposals"

# Meta-analysis is high-leverage; spend more here than on per-specimen calls.
META_MODEL = "claude-opus-4-7"
META_MAX_TOKENS = 8192

Mode = Literal["full", "partial"]


META_SYSTEM = """\
你是叙事结构诊断 RUBRIC 的提示词工程审查员。给你：
- 现行 RUBRIC
- 一批最近一次 eval 翻车的样本（文本 + 期望 + 模型实际推理）
- 一批 borderline PASS（confidence 贴近 band 边缘）作为风险锚
- 一批 healthy PASS 作为"不要破坏这些"的不动点

你的工作：定位翻车的根因，提出**外科式**的 RUBRIC 修改建议——指向具体段落，
说明改前改后，预估修改可能把哪些当前 PASS 推过边界。

**根因分类**：
- rubric_wording：措辞模糊、判定边界没说清，改 RUBRIC 文字就能修
- skeleton_model：S0/D/T/S1/K 五元 + 四引擎本身覆盖不到这类文学——
  改文字救不了，要扩骨架（或显式声明这一类 out_of_scope）
- confidence_calibration：判断对了但 confidence 偏（普遍太高 / 太低）
- expectation_wrong：标注本身有争议，eval 数据需要修正

**重要原则**：
1. 宁可缩小 RUBRIC 适用范围，也不要把它扩成"什么都能说"。明确标 out_of_scope
   比硬给低 confidence 结论好。
2. 单次修改建议 ≤ 200 字。改一处，看下一轮结果，再改一处。**不要给"重写整段"
   这种建议**——那是骨架改，不是 RUBRIC 改。
3. 任何修改都要预估副作用：如果改了某一句让 X 类样本能通过，可能让 Y 类样本
   反而过界——必须明说。

通过 propose_rubric_revisions 工具输出。"""


REVISION_TOOL: dict[str, Any] = {
    "name": "propose_rubric_revisions",
    "description": "Submit your structured rubric-revision proposal.",
    "input_schema": {
        "type": "object",
        "properties": {
            "diagnosis": {
                "type": "array",
                "description": "把失败聚类，每条覆盖一类失败模式。",
                "items": {
                    "type": "object",
                    "properties": {
                        "failure_pattern": {"type": "string"},
                        "affected_specimens": {
                            "type": "array",
                            "items": {"type": "string"},
                        },
                        "root_cause": {
                            "type": "string",
                            "enum": [
                                "rubric_wording",
                                "skeleton_model",
                                "confidence_calibration",
                                "expectation_wrong",
                            ],
                        },
                        "evidence": {"type": "string"},
                    },
                    "required": [
                        "failure_pattern",
                        "affected_specimens",
                        "root_cause",
                        "evidence",
                    ],
                },
            },
            "proposed_edits": {
                "type": "array",
                "description": "外科式修改，每条 ≤ 200 字，指向 RUBRIC 中具体段落。",
                "items": {
                    "type": "object",
                    "properties": {
                        "target_rubric": {
                            "type": "string",
                            "enum": ["RUBRIC_FULL", "RUBRIC_PARTIAL"],
                        },
                        "summary": {"type": "string"},
                        "before_snippet": {
                            "type": "string",
                            "description": "RUBRIC 中应被替换的原文片段，≤ 200 字。",
                        },
                        "after_snippet": {
                            "type": "string",
                            "description": "替换后的文字，≤ 200 字。",
                        },
                        "expected_to_fix": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "预计修复哪些当前失败 specimen。",
                        },
                        "risk_of_breaking": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "预计可能让哪些当前 PASS 退步。",
                        },
                    },
                    "required": [
                        "target_rubric",
                        "summary",
                        "before_snippet",
                        "after_snippet",
                        "expected_to_fix",
                        "risk_of_breaking",
                    ],
                },
            },
            "skeleton_questions": {
                "type": "array",
                "items": {"type": "string"},
                "description": "需要人类决断的骨架级问题（不是 RUBRIC 改得动的）。",
            },
            "overall_assessment": {"type": "string"},
        },
        "required": [
            "diagnosis",
            "proposed_edits",
            "skeleton_questions",
            "overall_assessment",
        ],
    },
}


def load_result_for(rel_path: str) -> dict | None:
    """逆向 run_eval 的命名规则找 result 文件。"""
    stem = Path(rel_path).stem
    flat = f"{stem}__{rel_path.replace('/', '__').replace('.txt', '')}.json"
    p = RESULT_DIR / flat
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def gather_cases(mode: Mode, include_holdout: bool) -> dict[str, list[dict]]:
    expectations = json.loads(EXPECT_FILE.read_text(encoding="utf-8"))
    failures: list[dict] = []
    borderlines: list[dict] = []
    healthy: list[dict] = []
    skipped_no_result = 0
    skipped_partial = 0
    skipped_holdout = 0

    for spec_path in collect_specimens():
        rel = spec_path.relative_to(SPEC_DIR).as_posix()
        expected = expectations.get(rel)
        if not expected:
            continue
        if expected.get("is_partial") and mode == "full":
            skipped_partial += 1
            continue
        if not expected.get("is_partial") and mode == "partial":
            skipped_partial += 1
            continue
        if expected.get("holdout") and not include_holdout:
            skipped_holdout += 1
            continue

        result = load_result_for(rel)
        if not result or "error" in result:
            skipped_no_result += 1
            continue

        is_partial = expected.get("is_partial", False)
        ok, fails = (
            check_partial(result, expected)
            if is_partial
            else check_full(result, expected)
        )

        case = {
            "path": rel,
            "text": spec_path.read_text(encoding="utf-8"),
            "expected": expected,
            "actual": {
                "is_story": (result.get("gate") or {}).get("is_story"),
                "if_not_story_type": (result.get("gate") or {}).get("if_not_story_type"),
                "confidence": confidence_of(result),
                "primary_engine": primary_engine(result),
                "borderline_note": (result.get("gate") or {}).get("borderline_note", ""),
                "skeleton": result.get("skeleton") or result.get("skeleton_status"),
                "why_transformed": (
                    (result.get("gate") or {}).get("transformed") or {}
                ).get("why", ""),
                "why_causal": (
                    (result.get("gate") or {}).get("causal") or {}
                ).get("why", ""),
                "why_stakes_bound": (
                    (result.get("gate") or {}).get("stakes_bound") or {}
                ).get("why", ""),
            },
            "failed_checks": fails,
        }
        if not ok:
            failures.append(case)
        else:
            conf = confidence_of(result)
            band = expected.get("confidence_band")
            if conf is not None and band:
                lo, hi = band
                margin = min(conf - lo, hi - conf)
                if margin <= 0.05:
                    borderlines.append(case)
                else:
                    healthy.append(case)
            else:
                healthy.append(case)

    return {
        "failures": failures,
        "borderlines": borderlines,
        "healthy": healthy,
        "stats": {
            "skipped_no_result": skipped_no_result,
            "skipped_wrong_mode": skipped_partial,
            "skipped_holdout": skipped_holdout,
        },
    }


def build_user_message(
    rubric_text: str, rubric_name: str, cases: dict[str, list[dict]]
) -> str:
    parts = [
        f"## 当前 {rubric_name}\n\n```\n{rubric_text}\n```\n",
        f"## 失败样本 ({len(cases['failures'])} 篇)",
    ]
    for c in cases["failures"]:
        parts.append(json.dumps(c, ensure_ascii=False, indent=2))
    parts.append(f"\n## Borderline PASS（confidence 贴近边界, {len(cases['borderlines'])} 篇）")
    for c in cases["borderlines"]:
        parts.append(json.dumps(c, ensure_ascii=False, indent=2))
    # Healthy 只取前 6 篇代表，省 token
    sample_healthy = cases["healthy"][:6]
    parts.append(f"\n## 健康 PASS 代表 ({len(sample_healthy)} / {len(cases['healthy'])} 篇), 不要破坏这些")
    for c in sample_healthy:
        parts.append(
            json.dumps(
                {"path": c["path"], "actual": c["actual"], "expected": c["expected"]},
                ensure_ascii=False,
                indent=2,
            )
        )
    return "\n\n".join(parts)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--mode",
        choices=["full", "partial"],
        default="full",
        help="改哪一份 RUBRIC（默认 full）",
    )
    parser.add_argument(
        "--include-holdout",
        action="store_true",
        help="把 holdout 桶也算进来。默认不算——是为了不让 holdout 影响 RUBRIC 调参。仅在做大改前最终检查时打开。",
    )
    args = parser.parse_args()

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise SystemExit("ANTHROPIC_API_KEY 未设置——meta 调用不走 ANALYZER_URL。")

    rubric_text = RUBRIC_FULL if args.mode == "full" else RUBRIC_PARTIAL
    rubric_name = "RUBRIC_FULL" if args.mode == "full" else "RUBRIC_PARTIAL"

    cases = gather_cases(args.mode, args.include_holdout)
    print(
        f"收集到 失败 {len(cases['failures'])} / borderline {len(cases['borderlines'])} "
        f"/ 健康 {len(cases['healthy'])} 篇"
    )
    print(f"  (skipped: {cases['stats']})")

    if not cases["failures"] and not cases["borderlines"]:
        print("没有失败也没有边界——RUBRIC 已经稳了，不需要 revise。")
        return

    print(f"\n调用 {META_MODEL} 跑 meta 分析...")
    client = anthropic.Anthropic(api_key=api_key)
    user_msg = build_user_message(rubric_text, rubric_name, cases)

    response = client.messages.create(
        model=META_MODEL,
        max_tokens=META_MAX_TOKENS,
        thinking={"type": "adaptive"},
        system=META_SYSTEM,
        tools=[REVISION_TOOL],
        tool_choice={"type": "tool", "name": "propose_rubric_revisions"},
        messages=[{"role": "user", "content": user_msg}],
    )

    tool_use = next(
        (b for b in response.content if getattr(b, "type", None) == "tool_use"), None
    )
    if not tool_use:
        raise SystemExit(
            f"无 tool_use 返回。stop_reason={response.stop_reason}\n{response.content}"
        )

    proposal = tool_use.input

    PROPOSAL_DIR.mkdir(exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_path = PROPOSAL_DIR / f"{args.mode}_{stamp}.json"
    out_path.write_text(
        json.dumps(
            {
                "mode": args.mode,
                "include_holdout": args.include_holdout,
                "case_counts": {k: len(v) if isinstance(v, list) else v for k, v in cases.items()},
                "proposal": proposal,
                "model": META_MODEL,
                "usage": {
                    "input_tokens": response.usage.input_tokens,
                    "output_tokens": response.usage.output_tokens,
                    "cache_read_input_tokens": getattr(
                        response.usage, "cache_read_input_tokens", 0
                    ),
                },
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    print(f"\n建议写入 {out_path.relative_to(ROOT)}\n")
    print("─" * 60)
    print("DIAGNOSIS")
    print("─" * 60)
    for d in proposal["diagnosis"]:
        print(f"\n• [{d['root_cause']}] {d['failure_pattern']}")
        print(f"  影响: {', '.join(d['affected_specimens'][:5])}"
              f"{' …' if len(d['affected_specimens']) > 5 else ''}")
        print(f"  证据: {d['evidence']}")

    print()
    print("─" * 60)
    print("PROPOSED EDITS")
    print("─" * 60)
    for i, e in enumerate(proposal["proposed_edits"], 1):
        print(f"\n[{i}] {e['target_rubric']}: {e['summary']}")
        print(f"  before: {e['before_snippet']}")
        print(f"  after : {e['after_snippet']}")
        print(f"  修复 : {', '.join(e['expected_to_fix'])}")
        print(f"  风险 : {', '.join(e['risk_of_breaking'])}")

    if proposal.get("skeleton_questions"):
        print()
        print("─" * 60)
        print("骨架级问题（需要人决断，RUBRIC 改不动）")
        print("─" * 60)
        for q in proposal["skeleton_questions"]:
            print(f"  ? {q}")

    print()
    print("─" * 60)
    print(f"OVERALL: {proposal['overall_assessment']}")
    print("─" * 60)
    print()
    print("下一步：人工 review 上面的 edits，挑一两条 apply 到 analyze.py")
    print("（如果合并到 TS 端，apply 到 src/lib/skeleton-diagnostic/rubric.ts），")
    print("然后重跑 run_eval.py 看效果。")


if __name__ == "__main__":
    main()

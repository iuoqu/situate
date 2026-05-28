"""把 eval 翻车样本喂回 /api/revise-rubric（opus-4-7 + adaptive thinking），
让它指 RUBRIC 哪几行该改。

用法：
    python revise_rubric.py            # 看 train 桶，不看 holdout
    python revise_rubric.py --include-holdout   # 也看 holdout（大改前的最终检查）
    python revise_rubric.py --mode partial      # 改 RUBRIC_PARTIAL 而不是 FULL

流程：
    1. 读 results/ 里所有 .json（即上一轮 run_eval.py 的输出）
    2. 跟 expectations.json 对账，找出失败和 borderline 案例
    3. 把当前 RUBRIC（从 analyze.py 读取本地副本）+ 失败 + borderline + 健康代表
       POST 到 /api/revise-rubric
    4. 把建议打印 + 写到 revision_proposals/<timestamp>.json

env vars: ANALYZER_URL（必需，Vercel base URL）+ ANALYZER_TOKEN（必需，bearer）。
本端**不需要** ANTHROPIC_API_KEY——Claude 调用在 Vercel 那一头跑。
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Literal

from _http import base_url, post_json
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

Mode = Literal["full", "partial"]


def load_result_for(rel_path: str) -> dict | None:
    stem = Path(rel_path).stem
    flat = f"{stem}__{rel_path.replace('/', '__').replace('.txt', '')}.json"
    p = RESULT_DIR / flat
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def gather_cases(mode: Mode, include_holdout: bool) -> dict[str, Any]:
    expectations = json.loads(EXPECT_FILE.read_text(encoding="utf-8"))
    failures: list[dict] = []
    borderlines: list[dict] = []
    healthy: list[dict] = []
    skipped_no_result = 0
    skipped_wrong_mode = 0
    skipped_holdout = 0

    for spec_path in collect_specimens():
        rel = spec_path.relative_to(SPEC_DIR).as_posix()
        expected = expectations.get(rel)
        if not expected:
            continue
        if expected.get("is_partial") and mode == "full":
            skipped_wrong_mode += 1
            continue
        if not expected.get("is_partial") and mode == "partial":
            skipped_wrong_mode += 1
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

        gate = result.get("gate") or {}
        case = {
            "path": rel,
            "text": spec_path.read_text(encoding="utf-8"),
            "expected": expected,
            "actual": {
                "is_story": gate.get("is_story"),
                "if_not_story_type": gate.get("if_not_story_type"),
                "confidence": confidence_of(result),
                "primary_engine": primary_engine(result),
                "borderline_note": gate.get("borderline_note", ""),
                "skeleton": result.get("skeleton") or result.get("skeleton_status"),
                "why_transformed": (gate.get("transformed") or {}).get("why", ""),
                "why_causal": (gate.get("causal") or {}).get("why", ""),
                "why_stakes_bound": (gate.get("stakes_bound") or {}).get("why", ""),
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
                    healthy.append({k: v for k, v in case.items() if k != "text"})
            else:
                healthy.append({k: v for k, v in case.items() if k != "text"})

    return {
        "failures": failures,
        "borderlines": borderlines,
        "healthy": healthy,
        "skipped": {
            "no_result": skipped_no_result,
            "wrong_mode": skipped_wrong_mode,
            "holdout": skipped_holdout,
        },
    }


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

    if not base_url():
        raise SystemExit(
            "ANALYZER_URL 未设置——meta 调用走 /api/revise-rubric，需要指向 Vercel base URL。"
        )

    rubric_text = RUBRIC_FULL if args.mode == "full" else RUBRIC_PARTIAL
    rubric_name = "RUBRIC_FULL" if args.mode == "full" else "RUBRIC_PARTIAL"

    cases = gather_cases(args.mode, args.include_holdout)
    print(
        f"收集到 失败 {len(cases['failures'])} / borderline {len(cases['borderlines'])} "
        f"/ 健康 {len(cases['healthy'])} 篇"
    )
    print(f"  skipped: {cases['skipped']}")

    if not cases["failures"] and not cases["borderlines"]:
        print("没有失败也没有边界——RUBRIC 已经稳了，不需要 revise。")
        return

    print(f"\nPOST /api/revise-rubric ...")
    result = post_json(
        "/api/revise-rubric",
        {
            "current_rubric": rubric_text,
            "rubric_name": rubric_name,
            "mode": args.mode,
            "failures": cases["failures"],
            "borderlines": cases["borderlines"],
            "healthy": cases["healthy"],
        },
    )

    if "error" in result:
        raise SystemExit(f"远端错误: {result['error']}\n{result.get('raw', '')[:500]}")

    PROPOSAL_DIR.mkdir(exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_path = PROPOSAL_DIR / f"{args.mode}_{stamp}.json"
    out_path.write_text(
        json.dumps(
            {
                "mode": args.mode,
                "include_holdout": args.include_holdout,
                "case_counts": {
                    "failures": len(cases["failures"]),
                    "borderlines": len(cases["borderlines"]),
                    "healthy": len(cases["healthy"]),
                },
                "proposal": result,
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
    for d in result.get("diagnosis", []):
        print(f"\n• [{d['root_cause']}] {d['failure_pattern']}")
        print(
            f"  影响: {', '.join(d['affected_specimens'][:5])}"
            f"{' …' if len(d['affected_specimens']) > 5 else ''}"
        )
        print(f"  证据: {d['evidence']}")

    print()
    print("─" * 60)
    print("PROPOSED EDITS")
    print("─" * 60)
    for i, e in enumerate(result.get("proposed_edits", []), 1):
        print(f"\n[{i}] {e['target_rubric']}: {e['summary']}")
        print(f"  before: {e['before_snippet']}")
        print(f"  after : {e['after_snippet']}")
        print(f"  修复 : {', '.join(e['expected_to_fix'])}")
        print(f"  风险 : {', '.join(e['risk_of_breaking'])}")

    if result.get("skeleton_questions"):
        print()
        print("─" * 60)
        print("骨架级问题（需要人决断，RUBRIC 改不动）")
        print("─" * 60)
        for q in result["skeleton_questions"]:
            print(f"  ? {q}")

    print()
    print("─" * 60)
    print(f"OVERALL: {result.get('overall_assessment', '')}")
    print("─" * 60)
    print()
    print("下一步：人审上述 edits，挑 1-2 条同时 apply 到")
    print("  - src/lib/skeleton-diagnostic/rubric.ts（权威，部署用）")
    print("  - story-gate-eval/analyze.py 里的 RUBRIC_* 副本（沙盒）")
    print("然后重跑 run_eval.py 看效果。")


if __name__ == "__main__":
    main()

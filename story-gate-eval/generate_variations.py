"""把 36 篇种子集放大到几百篇——给 Claude 一个种子 + 结构变形要求，
产新 specimen + 草案 expectation 条目。人工 review 后入库。

两种调用：

1) 单次：
    python generate_variations.py \\
        --seed specimens/synthetic/faqtiao/02_revelation.txt \\
        --transform "把引擎改成 inevitability，understanding 改成 situation" \\
        --out specimens/synthetic/faqtiao/04b_inevitability_v2.txt

2) 批量：
    python generate_variations.py --manifest variations_plan.yaml
    （manifest 见 generate_variations.example.yaml）

每篇产物会写两个文件：
    <out>.txt                       新 specimen 内容
    <out>.expectation.json          单条 expectation，带 _generated: true
                                    和 _seed / _transform 做溯源

入库流程：
    1. review .txt 看读起来对不对
    2. 把 .expectation.json 内容合并进 expectations.json
    3. 删 .expectation.json，run_eval

人审是不可省的——Claude 写出来的样本可能在结构上"刚好达成"但读起来是 AI 套话。
保留原始 .expectation.json 文件让 review 工作可追溯。

模型：默认 sonnet-4-6（写作够用、便宜）；--strict 切到 opus-4-7（更稳定但贵 5x）。
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

import anthropic

ROOT = Path(__file__).parent
SPEC_DIR = ROOT / "specimens"
EXPECT_FILE = ROOT / "expectations.json"

DEFAULT_MODEL = "claude-sonnet-4-6"
STRICT_MODEL = "claude-opus-4-7"
MAX_TOKENS = 2048


GENERATOR_SYSTEM = """\
你是叙事结构 eval 套件的样本生成器。给你：
- 一篇种子 specimen + 它当前的 expectation 标注
- 一个结构变形要求（例如"把引擎改成 inevitability"、"砍掉 K 让它降级成说明"、
  "保持骨架但加 flat_subtext 失败"）

你产一篇**新 specimen**——题材应当跟种子接近（这样变量隔离干净，能精准探测
RUBRIC 的判别边界），但结构按变形要求重写。同时产一份**草案 expectation**——
你预测这篇新 specimen 应该被 RUBRIC 怎么判。

**重要原则**：
1. 不要写"AI 套话"。读起来要像真实投稿——节制、不耍花腔、不补全所有情绪。
   长度向种子靠近（±50%）。
2. 变形要"刚好"——只改要求改的那个轴，其他保持。别顺手把所有东西都升级。
3. expectation 字段要诚实：如果你写的变体在结构上是边界 case，
   confidence_band 就该宽（[0.3, 0.7]）。不要为了"看起来合理"硬给高 confidence。
4. tradition 标签要选最贴的——"中国现代" / "现代冲突" / "命运式" /
   "契诃夫式" / "中国古典笔记小说" / "网文升级流" / "zuihitsu / 随笔" /
   "极简对话+subtext" / "实验" / "草稿"。
5. purpose 字段一句话写清楚这篇变体在测什么——读 expectations.json 的人
   要能立刻看懂。
6. 通过 submit_variation 工具输出。"""


VARIATION_TOOL: dict[str, Any] = {
    "name": "submit_variation",
    "description": "Submit one new specimen + its draft expectation entry.",
    "input_schema": {
        "type": "object",
        "properties": {
            "variant_text": {
                "type": "string",
                "description": "新 specimen 的完整内容，首行是标题，整体长度向种子靠近 ±50%。",
            },
            "proposed_expectation": {
                "type": "object",
                "properties": {
                    "is_story": {"type": "boolean"},
                    "type": {
                        "type": ["string", "null"],
                        "enum": ["描摹", "随笔", "说明", None],
                    },
                    "expected_engine": {
                        "type": ["string", "null"],
                        "enum": [
                            "conflict",
                            "recontextualize",
                            "revelation",
                            "inevitability",
                            None,
                        ],
                    },
                    "confidence_band": {
                        "type": "array",
                        "items": {"type": "number"},
                        "minItems": 2,
                        "maxItems": 2,
                    },
                    "tradition": {"type": "string"},
                    "purpose": {"type": "string"},
                    "holdout": {"type": "boolean"},
                },
                "required": [
                    "is_story",
                    "type",
                    "expected_engine",
                    "confidence_band",
                    "tradition",
                    "purpose",
                    "holdout",
                ],
            },
            "design_notes": {
                "type": "string",
                "description": "这篇变体在结构上做了什么操作、为什么这样写——给 reviewer 看的。",
            },
        },
        "required": ["variant_text", "proposed_expectation", "design_notes"],
    },
}


def load_seed(seed_path: Path) -> tuple[str, dict | None]:
    if not seed_path.exists():
        raise SystemExit(f"种子文件不存在: {seed_path}")
    text = seed_path.read_text(encoding="utf-8")
    expectations = json.loads(EXPECT_FILE.read_text(encoding="utf-8"))
    rel = seed_path.relative_to(SPEC_DIR).as_posix()
    return text, expectations.get(rel)


def safe_filename_segment(s: str) -> str:
    """从 transform 字符串里造一个文件名片段。"""
    s = re.sub(r"[^\w\-]+", "_", s)
    return s.strip("_")[:40] or "variant"


def generate_one(
    client: anthropic.Anthropic,
    model: str,
    seed_text: str,
    seed_expectation: dict | None,
    transform: str,
) -> dict[str, Any]:
    seed_meta = (
        f"种子当前 expectation:\n{json.dumps(seed_expectation, ensure_ascii=False, indent=2)}\n\n"
        if seed_expectation
        else "（种子无 expectation 标注）\n\n"
    )
    user_msg = (
        f"## 种子\n\n{seed_text}\n\n"
        f"{seed_meta}"
        f"## 结构变形要求\n\n{transform}\n"
    )

    response = client.messages.create(
        model=model,
        max_tokens=MAX_TOKENS,
        system=GENERATOR_SYSTEM,
        tools=[VARIATION_TOOL],
        tool_choice={"type": "tool", "name": "submit_variation"},
        messages=[{"role": "user", "content": user_msg}],
    )

    tool_use = next(
        (b for b in response.content if getattr(b, "type", None) == "tool_use"), None
    )
    if not tool_use:
        raise RuntimeError(
            f"无 tool_use 返回。stop_reason={response.stop_reason}"
        )

    out = dict(tool_use.input)
    out["_usage"] = {
        "input_tokens": response.usage.input_tokens,
        "output_tokens": response.usage.output_tokens,
    }
    return out


def write_variant(
    out_path: Path,
    seed_rel: str,
    transform: str,
    variation: dict[str, Any],
) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(variation["variant_text"], encoding="utf-8")

    expectation = variation["proposed_expectation"]
    expectation["_generated"] = True
    expectation["_seed"] = seed_rel
    expectation["_transform"] = transform
    expectation["_design_notes"] = variation["design_notes"]

    rel = out_path.relative_to(SPEC_DIR).as_posix()
    sidecar = out_path.with_suffix(".expectation.json")
    sidecar.write_text(
        json.dumps({rel: expectation}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def run_single(args: argparse.Namespace, client: anthropic.Anthropic, model: str) -> None:
    seed_path = Path(args.seed).resolve()
    out_path = Path(args.out).resolve()
    seed_rel = seed_path.relative_to(SPEC_DIR).as_posix()

    seed_text, seed_expect = load_seed(seed_path)
    print(f"种子: {seed_rel}")
    print(f"变形: {args.transform}")
    print(f"模型: {model}")
    print(f"产出: {out_path.relative_to(ROOT)}")
    print()

    variation = generate_one(client, model, seed_text, seed_expect, args.transform)
    write_variant(out_path, seed_rel, args.transform, variation)

    print("✓ 写出 specimen + 草案 expectation")
    print(f"  - {out_path.relative_to(ROOT)}")
    print(f"  - {out_path.with_suffix('.expectation.json').relative_to(ROOT)}")
    print()
    print("草案 expectation:")
    print(
        json.dumps(variation["proposed_expectation"], ensure_ascii=False, indent=2)
    )
    print()
    print(f"设计笔记: {variation['design_notes']}")
    print()
    print(f"用量: in={variation['_usage']['input_tokens']} out={variation['_usage']['output_tokens']}")


def run_manifest(args: argparse.Namespace, client: anthropic.Anthropic, model: str) -> None:
    # Manifest 用 JSON 而不是 YAML——不引入 yaml 依赖。结构：
    # [{"seed": "...", "transform": "...", "out": "..."}], ...
    manifest_path = Path(args.manifest).resolve()
    plan = json.loads(manifest_path.read_text(encoding="utf-8"))
    if not isinstance(plan, list):
        raise SystemExit("manifest 顶层必须是 list[{seed, transform, out}]")

    total_in = total_out = 0
    for i, entry in enumerate(plan, 1):
        seed_path = (manifest_path.parent / entry["seed"]).resolve()
        out_path = (manifest_path.parent / entry["out"]).resolve()
        transform = entry["transform"]
        seed_rel = seed_path.relative_to(SPEC_DIR).as_posix()

        print(f"[{i}/{len(plan)}] {seed_rel}  →  {out_path.relative_to(ROOT)}")
        print(f"        transform: {transform}")

        try:
            seed_text, seed_expect = load_seed(seed_path)
            variation = generate_one(client, model, seed_text, seed_expect, transform)
            write_variant(out_path, seed_rel, transform, variation)
            total_in += variation["_usage"]["input_tokens"]
            total_out += variation["_usage"]["output_tokens"]
            print(f"        ✓ {variation['proposed_expectation']['tradition']} / "
                  f"engine={variation['proposed_expectation']['expected_engine']}")
        except Exception as e:
            print(f"        ✗ {type(e).__name__}: {e}")

    print()
    print(f"完成 {len(plan)} 项。总用量 in={total_in} out={total_out}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--manifest", help="批量模式：读取 JSON manifest")
    parser.add_argument("--seed", help="单次模式：种子 .txt 路径")
    parser.add_argument("--transform", help="单次模式：变形要求（自然语言）")
    parser.add_argument("--out", help="单次模式：产出 .txt 路径")
    parser.add_argument("--strict", action="store_true", help="用 opus-4-7（贵 5x，结构更稳）")
    args = parser.parse_args()

    if not (args.manifest or (args.seed and args.transform and args.out)):
        parser.error("需要 --manifest，或 --seed + --transform + --out")

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise SystemExit("ANTHROPIC_API_KEY 未设置——生成调用不走 ANALYZER_URL。")

    model = STRICT_MODEL if args.strict else DEFAULT_MODEL
    client = anthropic.Anthropic(api_key=api_key)

    if args.manifest:
        run_manifest(args, client, model)
    else:
        run_single(args, client, model)


if __name__ == "__main__":
    main()

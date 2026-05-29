"""把 36 篇种子集放大到几百篇——POST 种子 + 变形要求到 /api/generate-variation，
拿回新 specimen + 草案 expectation 条目。人审后入库。

两种调用：

1) 单次：
    python generate_variations.py \\
        --seed specimens/synthetic/faqtiao/02_revelation.txt \\
        --transform "把引擎改成 inevitability，保持 understanding 维度" \\
        --out specimens/synthetic/faqtiao/04b_inevitability_v2.txt

2) 批量：
    python generate_variations.py --manifest variations.example.json

每篇产物写两个文件：
    <out>.txt                    新 specimen 内容
    <out>.expectation.json       单条 expectation，带 _generated / _seed /
                                 _transform / _design_notes 做溯源

入库流程：
    1. review .txt 看读起来对不对
    2. 把 .expectation.json 内容合并进 expectations.json
    3. 删 .expectation.json，run_eval

env vars: ANALYZER_URL（必需）+ ANALYZER_TOKEN（必需）。本端**不需要**
ANTHROPIC_API_KEY——Claude 调用在 Vercel 那一头跑。

模型选择走 --strict flag：默认 sonnet-4-6（写作够用、便宜）；--strict 切到
opus-4-7（贵 5x 但结构更稳）。
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from _http import base_url, post_json

ROOT = Path(__file__).parent
SPEC_DIR = ROOT / "specimens"
EXPECT_FILE = ROOT / "expectations.json"


def load_seed(seed_path: Path) -> tuple[str, dict | None]:
    if not seed_path.exists():
        raise SystemExit(f"种子文件不存在: {seed_path}")
    text = seed_path.read_text(encoding="utf-8")
    expectations = json.loads(EXPECT_FILE.read_text(encoding="utf-8"))
    rel = seed_path.relative_to(SPEC_DIR).as_posix()
    return text, expectations.get(rel)


def generate_one(
    seed_text: str,
    seed_expectation: dict | None,
    transform: str,
    strict: bool,
) -> dict[str, Any]:
    body: dict[str, Any] = {
        "seed_text": seed_text,
        "transform": transform,
        "strict": strict,
    }
    if seed_expectation is not None:
        body["seed_expectation"] = seed_expectation
    return post_json("/api/generate-variation", body, timeout=90.0)


def write_variant(
    out_path: Path,
    seed_rel: str,
    transform: str,
    variation: dict[str, Any],
) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(variation["variant_text"], encoding="utf-8")

    expectation = dict(variation["proposed_expectation"])
    expectation["_generated"] = True
    expectation["_seed"] = seed_rel
    expectation["_transform"] = transform
    expectation["_design_notes"] = variation.get("design_notes", "")

    rel = out_path.relative_to(SPEC_DIR).as_posix()
    sidecar = out_path.with_suffix(".expectation.json")
    sidecar.write_text(
        json.dumps({rel: expectation}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def run_single(args: argparse.Namespace) -> None:
    seed_path = Path(args.seed).resolve()
    out_path = Path(args.out).resolve()
    seed_rel = seed_path.relative_to(SPEC_DIR).as_posix()

    seed_text, seed_expect = load_seed(seed_path)
    print(f"种子: {seed_rel}")
    print(f"变形: {args.transform}")
    print(f"模型: {'opus-4-7 (strict)' if args.strict else 'sonnet-4-6 (default)'}")
    print(f"产出: {out_path.relative_to(ROOT)}\n")

    variation = generate_one(seed_text, seed_expect, args.transform, args.strict)
    if "error" in variation:
        raise SystemExit(f"远端错误: {variation['error']}\n{variation.get('raw', '')[:500]}")

    write_variant(out_path, seed_rel, args.transform, variation)

    print("✓ 写出 specimen + 草案 expectation")
    print(f"  - {out_path.relative_to(ROOT)}")
    print(f"  - {out_path.with_suffix('.expectation.json').relative_to(ROOT)}\n")
    print("草案 expectation:")
    print(json.dumps(variation["proposed_expectation"], ensure_ascii=False, indent=2))
    print(f"\n设计笔记: {variation.get('design_notes', '')}")
    meta = variation.get("_meta", {}).get("usage", {})
    if meta:
        print(f"\n用量: in={meta.get('input_tokens')} out={meta.get('output_tokens')}")


def run_manifest(args: argparse.Namespace) -> None:
    # Manifest 用 JSON（不引入 yaml 依赖）。顶层 list，元素 {seed, transform, out}。
    manifest_path = Path(args.manifest).resolve()
    plan = json.loads(manifest_path.read_text(encoding="utf-8"))
    if not isinstance(plan, list):
        raise SystemExit("manifest 顶层必须是 list[{seed, transform, out}]")

    total_in = total_out = 0
    success = 0
    for i, entry in enumerate(plan, 1):
        seed_path = (manifest_path.parent / entry["seed"]).resolve()
        out_path = (manifest_path.parent / entry["out"]).resolve()
        transform = entry["transform"]
        seed_rel = seed_path.relative_to(SPEC_DIR).as_posix()

        print(f"[{i}/{len(plan)}] {seed_rel}  →  {out_path.relative_to(ROOT)}")
        print(f"        transform: {transform[:80]}{'…' if len(transform) > 80 else ''}")

        try:
            seed_text, seed_expect = load_seed(seed_path)
            variation = generate_one(seed_text, seed_expect, transform, args.strict)
            if "error" in variation:
                print(f"        ✗ remote error: {variation['error']}")
                continue
            write_variant(out_path, seed_rel, transform, variation)
            usage = variation.get("_meta", {}).get("usage", {})
            total_in += usage.get("input_tokens", 0)
            total_out += usage.get("output_tokens", 0)
            success += 1
            print(
                f"        ✓ {variation['proposed_expectation']['tradition']} / "
                f"engine={variation['proposed_expectation']['expected_engine']}"
            )
        except Exception as e:
            print(f"        ✗ {type(e).__name__}: {e}")

    print(f"\n完成 {success}/{len(plan)}。总用量 in={total_in} out={total_out}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--manifest", help="批量模式：读取 JSON manifest")
    parser.add_argument("--seed", help="单次模式：种子 .txt 路径")
    parser.add_argument("--transform", help="单次模式：变形要求（自然语言）")
    parser.add_argument("--out", help="单次模式：产出 .txt 路径")
    parser.add_argument(
        "--strict",
        action="store_true",
        help="用 opus-4-7（贵 5x，结构更稳）",
    )
    args = parser.parse_args()

    if not (args.manifest or (args.seed and args.transform and args.out)):
        parser.error("需要 --manifest，或 --seed + --transform + --out")

    if not base_url():
        raise SystemExit(
            "ANALYZER_URL 未设置——生成调用走 /api/generate-variation，需要指向 Vercel base URL。"
        )

    if args.manifest:
        run_manifest(args)
    else:
        run_single(args)


if __name__ == "__main__":
    main()

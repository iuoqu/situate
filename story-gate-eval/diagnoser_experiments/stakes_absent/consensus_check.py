"""多模型共识检查——验证 contrast-pair 金标准是否站得住。

对每篇 specimen 在 4 个 provider 上跑现行 RUBRIC，读 gate.stakes_bound.verdict，
跟 expectations.json 里 intended_stakes_absent 对账，输出共识报告。

环境变量（同 story-gate-eval 其他脚本）：
    ANALYZER_URL    Vercel base URL（如 https://situate.vercel.app）或本地
    ANALYZER_TOKEN  对应 DIAGNOSTIC_INTERNAL_TOKEN

用法：
    cd story-gate-eval/diagnoser_experiments/stakes_absent
    python consensus_check.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).parent
SCRIPT_ROOT = HERE.parent.parent  # story-gate-eval/
sys.path.insert(0, str(SCRIPT_ROOT))

from _http import base_url, post_json  # noqa: E402

SPEC_DIR = HERE / "specimens"
EXPECT_FILE = HERE / "expectations.json"

PROVIDERS = [
    "anthropic:claude-sonnet-4-6",
    "anthropic:claude-opus-4-7",
    "deepseek:deepseek-chat",
    "alibaba:qwen3-max",
]


def short(p: str) -> str:
    return p.split(":")[-1].replace("claude-", "").replace("-chat", "")


def extract_k_verdict(result: dict) -> tuple[str, str]:
    """Return (verdict, rationale). verdict ∈ present|absent|error."""
    if "error" in result:
        # post_json wraps HTTP 5xx as {error: "HTTP 500 ...", raw: "<body>"}.
        # The upstream JSON usually has a useful `detail` field — unwrap it.
        upstream = result.get("raw", "")
        if upstream:
            try:
                parsed = json.loads(upstream)
                detail = parsed.get("detail") or parsed.get("error") or ""
                if detail:
                    return "error", f"{result['error']}: {detail}"[:300]
            except json.JSONDecodeError:
                pass
        return "error", result.get("error", "")[:200]
    # /api/diagnose returns SkeletonDiagnostic directly (not wrapped)
    if result.get("mode") != "full":
        return "error", f"unexpected mode: {result.get('mode')}"
    gate = result.get("gate") or {}
    sb = gate.get("stakes_bound") or {}
    verdict = sb.get("verdict")
    why = sb.get("why", "")
    if verdict is True:
        return "present", why
    if verdict is False:
        return "absent", why
    return "error", "stakes_bound.verdict missing from response"


def main() -> int:
    if not base_url():
        sys.exit("ANALYZER_URL 未设置——这个脚本走 Vercel route")

    raw_expect = json.loads(EXPECT_FILE.read_text(encoding="utf-8"))
    expectations = {k: v for k, v in raw_expect.items() if not k.startswith("$")}

    spec_files = sorted(SPEC_DIR.glob("*.txt"))
    total_calls = len(spec_files) * len(PROVIDERS)
    print(f"运行 {len(spec_files)} specimens × {len(PROVIDERS)} providers = {total_calls} calls")
    print(f"endpoint: {base_url()}/api/diagnose\n")

    # results[name][provider] = "present" / "absent" / "error"
    results: dict[str, dict[str, str]] = {}
    rationales: dict[str, dict[str, str]] = {}

    for spec_path in spec_files:
        name = spec_path.name
        text = spec_path.read_text(encoding="utf-8")
        print(f"  {name}")
        results[name] = {}
        rationales[name] = {}
        for provider in PROVIDERS:
            print(f"    → {short(provider):<14}", end="", flush=True)
            res = post_json(
                "/api/diagnose",
                {"text": text, "mode": "full", "provider": provider},
                timeout=120.0,
            )
            verdict, why = extract_k_verdict(res)
            results[name][provider] = verdict
            rationales[name][provider] = why
            marker = {"present": "K", "absent": "∅", "error": "?"}[verdict]
            print(f" {marker}", flush=True)

    # ─── Report ─────────────────────────────────────────────────────────
    print("\n" + "=" * 78)
    print("RESULTS — per specimen × provider")
    print("=" * 78)
    header = f"{'specimen':<40}" + "".join(f"{short(p):>10}" for p in PROVIDERS) + f"  intent  consensus"
    print(header)
    print("-" * (len(header) + 3))

    unanimous_match: list[str] = []
    unanimous_mismatch: list[str] = []
    split_set: list[str] = []
    had_errors: list[str] = []

    for name in sorted(results.keys()):
        expected = expectations.get(name)
        if not expected:
            continue
        intended_absent = expected["intended_stakes_absent"]
        intended_label = "absent" if intended_absent else "present"

        per = [results[name][p] for p in PROVIDERS]
        sym_row = "".join(
            f"{({'present': 'K', 'absent': '∅', 'error': '?'}[v]):>10}" for v in per
        )
        intent_short = "∅" if intended_absent else "K"

        if "error" in per:
            had_errors.append(name)
            consensus = "ERR"
        elif all(v == intended_label for v in per):
            unanimous_match.append(name)
            consensus = "✓ unanim"
        elif all(v != intended_label and v != "error" for v in per):
            unanimous_mismatch.append(name)
            consensus = "✗ all-disagree"
        else:
            split_set.append(name)
            consensus = "split"

        print(f"{name:<40}{sym_row}{intent_short:>7}  {consensus}")

    print()
    print("=" * 78)
    print("SUMMARY")
    print("=" * 78)
    n_labeled = sum(1 for n in results if expectations.get(n))
    print(f"  unanimous-match     {len(unanimous_match):>2}/{n_labeled}  → 进生产金标准")
    print(f"  unanimous-disagree  {len(unanimous_mismatch):>2}/{n_labeled}  → 我可能写崩了，回去看")
    print(f"  split               {len(split_set):>2}/{n_labeled}  → 进 edge/，不作单元测试基线")
    print(f"  had errors          {len(had_errors):>2}/{n_labeled}")

    # Pair-level analysis
    print()
    print("=" * 78)
    print("PAIR-LEVEL CONTRAST  (4/4 = 模型完美区分同对的 K-present vs K-absent)")
    print("=" * 78)
    pairs: dict[int, dict[str, str]] = {}
    for name, exp in expectations.items():
        p = exp["pair"]
        pairs.setdefault(p, {})[exp["intended_label"]] = name

    for pair_id in sorted(pairs.keys()):
        wp = pairs[pair_id].get("K_present", "?")
        np = pairs[pair_id].get("K_absent", "?")
        wp_r = results.get(wp, {})
        np_r = results.get(np, {})
        correct = sum(
            1 for prov in PROVIDERS
            if wp_r.get(prov) == "present" and np_r.get(prov) == "absent"
        )
        material = wp.replace("_with_K.txt", "").split("_", 1)[-1]
        print(f"  Pair {pair_id} ({material}): {correct}/4 providers correctly distinguish")

    # User audit guidance
    print()
    print("=" * 78)
    print("FOR YOUR AUDIT (step C)")
    print("=" * 78)
    if unanimous_match:
        print("\n✓ 进生产金标准（4/4 一致同意你的标签）：")
        for n in unanimous_match:
            print(f"     {n}")
    if unanimous_mismatch:
        print("\n⚠ 全部模型反对——可能是 specimen 写崩了：")
        for n in unanimous_mismatch:
            print(f"     {n}")
            for p in PROVIDERS:
                why = rationales[n].get(p, "")[:80]
                print(f"        {short(p):<14}: {why}")
    if split_set:
        print("\n⊕ 模型分裂，进 edge/，不作单元测试基线：")
        for n in split_set:
            print(f"     {n}")
            for p in PROVIDERS:
                v = results[n].get(p, "?")
                print(f"        {short(p):<14}: {v}")
    if had_errors:
        print("\n✗ 有 ERR，需要重跑：")
        for n in had_errors:
            print(f"     {n}")

    # Save full data
    out = HERE / "consensus_results.json"
    out.write_text(
        json.dumps(
            {
                "providers": PROVIDERS,
                "results": results,
                "rationales": rationales,
                "summary": {
                    "unanimous_match": unanimous_match,
                    "unanimous_mismatch": unanimous_mismatch,
                    "split": split_set,
                    "had_errors": had_errors,
                },
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"\n完整数据写入 {out.relative_to(SCRIPT_ROOT.parent)}")

    return 0


if __name__ == "__main__":
    sys.exit(main())

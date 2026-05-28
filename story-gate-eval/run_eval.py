"""批量跑 specimens/，写 results/，对照 expectations.json 打印汇总表。"""
from __future__ import annotations

import json
from pathlib import Path

from analyze import analyze

ROOT = Path(__file__).parent
SPEC_DIR = ROOT / "specimens"
RESULT_DIR = ROOT / "results"
EXPECT_FILE = ROOT / "expectations.json"


def primary_engine(result: dict) -> str:
    engines = result.get("engines") or []
    if not engines:
        return "-"
    top = max(engines, key=lambda e: e.get("weight", 0) or 0)
    return top.get("engine", "-") or "-"


def check(result: dict, expected: dict) -> bool:
    gate = result.get("gate") or {}
    if gate.get("is_story") != expected["is_story"]:
        return False
    if expected["is_story"]:
        return True
    return gate.get("if_not_story_type") == expected["type"]


def fmt(s: object, width: int) -> str:
    text = str(s)
    # crude CJK-aware width: treat non-ASCII as width 2
    visual = sum(2 if ord(c) > 127 else 1 for c in text)
    pad = max(0, width - visual)
    return text + " " * pad


def main() -> None:
    RESULT_DIR.mkdir(exist_ok=True)
    expectations = json.loads(EXPECT_FILE.read_text(encoding="utf-8"))

    rows: list[tuple[str, dict, dict | None]] = []
    for spec_path in sorted(SPEC_DIR.glob("*.txt")):
        print(f"Analyzing {spec_path.name}...", flush=True)
        text = spec_path.read_text(encoding="utf-8")
        result = analyze(text)
        (RESULT_DIR / f"{spec_path.stem}.json").write_text(
            json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        rows.append((spec_path.name, result, expectations.get(spec_path.name)))

    print()
    header = (
        fmt("文件名", 24)
        + fmt("is_story", 10)
        + fmt("not_type", 10)
        + fmt("主引擎", 18)
        + fmt("conf", 6)
        + fmt("期望", 22)
        + "结果"
    )
    print(header)
    print("-" * 100)

    passed = 0
    total = 0
    for name, result, expected in rows:
        if "error" in result:
            print(
                fmt(name, 24)
                + fmt("ERROR", 10)
                + fmt("-", 10)
                + fmt("-", 18)
                + fmt("-", 6)
                + fmt(str(expected), 22)
                + result["error"]
            )
            total += 1
            continue
        gate = result.get("gate") or {}
        is_story = gate.get("is_story")
        not_type = gate.get("if_not_story_type") or "-"
        conf = gate.get("confidence", 0)
        ok = expected is not None and check(result, expected)
        if expected is not None:
            total += 1
            if ok:
                passed += 1
        expected_s = "—" if expected is None else (
            "story" if expected["is_story"] else f"not:{expected['type']}"
        )
        verdict = "PASS" if ok else ("FAIL" if expected is not None else "-")
        print(
            fmt(name, 24)
            + fmt(str(is_story), 10)
            + fmt(not_type, 10)
            + fmt(primary_engine(result), 18)
            + fmt(f"{conf:.2f}" if isinstance(conf, (int, float)) else "-", 6)
            + fmt(expected_s, 22)
            + verdict
        )

    print()
    print(f"命中率: {passed}/{total}" if total else "(无期望项)")


if __name__ == "__main__":
    main()

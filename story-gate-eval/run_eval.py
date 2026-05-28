"""批量跑 specimens/，写 results/，对照 expectations.json 打印汇总表。

新版本：
- 递归 specimens/ 所有子目录
- 支持完整稿和草稿两种 mode（草稿走 analyze_partial）
- 支持 holdout 切分：iterating prompt 时只看 train，最终验收看 holdout
- expectation 包含期望失败类型、期望主引擎、confidence 区间，逐项核对
"""
from __future__ import annotations

import json
import os
from pathlib import Path

from analyze import analyze

ROOT = Path(__file__).parent
SPEC_DIR = ROOT / "specimens"
RESULT_DIR = ROOT / "results"
EXPECT_FILE = ROOT / "expectations.json"


def primary_engine(result: dict) -> str:
    engines = result.get("engines") or result.get("tentative_engines") or []
    if not engines:
        return "-"
    top = max(engines, key=lambda e: e.get("weight", 0) or 0)
    return top.get("engine", "-") or "-"


def confidence_of(result: dict) -> float | None:
    gate = result.get("gate") or {}
    if "confidence" in gate:
        return gate.get("confidence")
    # partial mode uses progress_estimate as proxy
    return result.get("progress_estimate")


def fmt(s: object, width: int) -> str:
    text = str(s) if s is not None else "-"
    visual = sum(2 if ord(c) > 127 else 1 for c in text)
    if visual > width:
        # truncate with width awareness; rough but readable
        out = ""
        used = 0
        for c in text:
            w = 2 if ord(c) > 127 else 1
            if used + w > width - 1:
                out += "…"
                used = width
                break
            out += c
            used += w
        return out + " " * max(0, width - used)
    return text + " " * (width - visual)


def check_full(result: dict, expected: dict) -> tuple[bool, list[str]]:
    """完整稿对账。返回 (整体 PASS?, 失败的子项列表)。"""
    gate = result.get("gate") or {}
    fails: list[str] = []

    if gate.get("is_story") != expected["is_story"]:
        fails.append("is_story")

    if not expected["is_story"]:
        if gate.get("if_not_story_type") != expected.get("type"):
            fails.append(f"type({gate.get('if_not_story_type')}≠{expected.get('type')})")

    if expected.get("expected_engine"):
        if primary_engine(result) != expected["expected_engine"]:
            fails.append(f"engine({primary_engine(result)}≠{expected['expected_engine']})")

    band = expected.get("confidence_band")
    conf = confidence_of(result)
    if band and isinstance(conf, (int, float)):
        lo, hi = band
        if not (lo <= conf <= hi):
            fails.append(f"conf({conf:.2f}∉[{lo},{hi}])")

    return (len(fails) == 0, fails)


def check_partial(result: dict, expected: dict) -> tuple[bool, list[str]]:
    """草稿对账。检查每根轴的 status 是否符合预期，且 confidence 不虚高。"""
    pe = expected.get("partial_expectations") or {}
    axes = result.get("skeleton_status") or {}
    fails: list[str] = []

    for axis, want_present in [("S0", "S0_present"), ("D", "D_present"),
                                ("T", "T_present"), ("S1", "S1_present")]:
        want = pe.get(want_present)
        if want is None:
            continue
        got_status = (axes.get(axis) or {}).get("status")
        got_present = got_status == "present"
        # "hinted" 算半present——只要不是 "present"，未来未出现的就该是 hinted/not_yet
        if want and not got_present:
            fails.append(f"{axis}=want_present,got_{got_status}")
        if not want and got_present:
            fails.append(f"{axis}=want_absent,got_present(编造)")

    band = expected.get("confidence_band")
    conf = confidence_of(result)
    if band and isinstance(conf, (int, float)):
        lo, hi = band
        if not (lo <= conf <= hi):
            fails.append(f"conf({conf:.2f}∉[{lo},{hi}])")

    return (len(fails) == 0, fails)


def collect_specimens() -> list[Path]:
    return sorted(p for p in SPEC_DIR.rglob("*.txt"))


def main() -> None:
    RESULT_DIR.mkdir(exist_ok=True)
    expectations = json.loads(EXPECT_FILE.read_text(encoding="utf-8"))

    rows: list[dict] = []
    for spec_path in collect_specimens():
        rel = spec_path.relative_to(SPEC_DIR).as_posix()
        print(f"Analyzing {rel}...", flush=True)
        text = spec_path.read_text(encoding="utf-8")
        expected = expectations.get(rel)
        is_partial = bool(expected and expected.get("is_partial"))
        mode = "partial" if is_partial else "full"
        result = analyze(text, mode=mode)
        out_path = RESULT_DIR / f"{spec_path.stem}__{rel.replace('/', '__').replace('.txt', '')}.json"
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        rows.append({"path": rel, "result": result, "expected": expected, "partial": is_partial})

    print()
    header = (
        fmt("path", 38) + fmt("is_story", 9) + fmt("type", 8)
        + fmt("engine", 16) + fmt("conf", 6) + fmt("set", 9) + "result"
    )
    print(header)
    print("-" * 110)

    train_pass = train_total = 0
    holdout_pass = holdout_total = 0
    errors = 0

    for row in rows:
        expected = row["expected"]
        result = row["result"]
        rel = row["path"]
        partial = row["partial"]
        holdout = bool(expected and expected.get("holdout"))
        bucket = "holdout" if holdout else ("partial" if partial else "train")

        if "error" in result:
            errors += 1
            print(fmt(rel, 38) + fmt("ERR", 9) + fmt("-", 8) + fmt("-", 16)
                  + fmt("-", 6) + fmt(bucket, 9) + result["error"])
            continue

        if expected is None:
            print(fmt(rel, 38) + fmt("?", 9) + fmt("?", 8)
                  + fmt(primary_engine(result), 16) + fmt(f"{confidence_of(result):.2f}" if isinstance(confidence_of(result), (int, float)) else "-", 6)
                  + fmt("unlabeled", 9) + "-")
            continue

        if partial:
            ok, fails = check_partial(result, expected)
            is_story_disp = "-"
            type_disp = "-"
        else:
            ok, fails = check_full(result, expected)
            gate = result.get("gate") or {}
            is_story_disp = str(gate.get("is_story"))
            type_disp = gate.get("if_not_story_type") or "-"

        conf = confidence_of(result)
        conf_disp = f"{conf:.2f}" if isinstance(conf, (int, float)) else "-"

        if not holdout:
            train_total += 1
            if ok:
                train_pass += 1
        else:
            holdout_total += 1
            if ok:
                holdout_pass += 1

        verdict = "PASS" if ok else f"FAIL[{','.join(fails)}]"
        print(fmt(rel, 38) + fmt(is_story_disp, 9) + fmt(type_disp, 8)
              + fmt(primary_engine(result), 16) + fmt(conf_disp, 6)
              + fmt(bucket, 9) + verdict)

    print()
    print("─" * 60)
    print(f"train   {train_pass}/{train_total}"
          + (f"  ({train_pass / train_total * 100:.0f}%)" if train_total else ""))
    print(f"holdout {holdout_pass}/{holdout_total}"
          + (f"  ({holdout_pass / holdout_total * 100:.0f}%)" if holdout_total else ""))
    print(f"errors  {errors}")
    print()
    if holdout_total and train_total:
        delta = (train_pass / train_total) - (holdout_pass / holdout_total)
        if delta > 0.15:
            print(f"⚠️  train 比 holdout 高 {delta:.0%}——可能在过拟合 RUBRIC 到训练样本")


if __name__ == "__main__":
    main()

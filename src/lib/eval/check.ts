/**
 * Per-axis check helpers. Mirror story-gate-eval/run_eval.py::check_full /
 * check_partial. A specimen PASSes when all of:
 *   - is_story matches
 *   - if non-story, failure type matches
 *   - if expected_engine given, primary engine matches
 *   - confidence within band
 *
 * Returns the failures list (empty = PASS).
 */

import type {
  FullDiagnostic,
  PartialDiagnostic,
  SkeletonDiagnostic,
} from "@/lib/skeleton-diagnostic/types";

import type { ExpectationEntry } from "./specimens";

export interface CheckResult {
  ok: boolean;
  fails: string[];
}

export function primaryEngine(result: SkeletonDiagnostic): string {
  if (result.mode === "full") {
    const engines = result.engines ?? [];
    if (!engines.length) return "-";
    const top = engines.reduce((a, b) => ((b.weight ?? 0) > (a.weight ?? 0) ? b : a));
    return top.engine ?? "-";
  }
  const engines = result.tentative_engines ?? [];
  if (!engines.length) return "-";
  const top = engines.reduce((a, b) => ((b.weight ?? 0) > (a.weight ?? 0) ? b : a));
  return top.engine || "-";
}

export function confidence(result: SkeletonDiagnostic): number | null {
  if (result.mode === "full") return result.gate?.confidence ?? null;
  return result.progress_estimate ?? null;
}

export function checkFull(
  result: FullDiagnostic,
  expected: ExpectationEntry,
): CheckResult {
  const fails: string[] = [];
  const gate = result.gate ?? null;

  if (gate?.is_story !== expected.is_story) {
    fails.push("is_story");
  }

  if (expected.is_story === false) {
    if (gate?.if_not_story_type !== (expected.type ?? null)) {
      fails.push(`type(${gate?.if_not_story_type}≠${expected.type ?? "null"})`);
    }
  }

  if (expected.expected_engine) {
    const got = primaryEngine(result);
    if (got !== expected.expected_engine) {
      fails.push(`engine(${got}≠${expected.expected_engine})`);
    }
  }

  if (expected.confidence_band && gate) {
    const [lo, hi] = expected.confidence_band;
    const c = gate.confidence;
    if (typeof c === "number" && (c < lo || c > hi)) {
      fails.push(`conf(${c.toFixed(2)}∉[${lo},${hi}])`);
    }
  }

  return { ok: fails.length === 0, fails };
}

export function checkPartial(
  result: PartialDiagnostic,
  expected: ExpectationEntry,
): CheckResult {
  const pe = expected.partial_expectations ?? {};
  const axes = result.skeleton_status;
  const fails: string[] = [];

  const checks: Array<[keyof typeof axes, keyof typeof pe]> = [
    ["S0", "S0_present"],
    ["D", "D_present"],
    ["T", "T_present"],
    ["S1", "S1_present"],
  ];
  for (const [axis, wantKey] of checks) {
    const want = pe[wantKey];
    if (want === undefined) continue;
    const got = axes[axis]?.status;
    const gotPresent = got === "present";
    if (want === true && !gotPresent) {
      fails.push(`${axis}=want_present,got_${got}`);
    }
    if (want === false && gotPresent) {
      fails.push(`${axis}=want_absent,got_present(编造)`);
    }
  }

  if (expected.confidence_band) {
    const [lo, hi] = expected.confidence_band;
    const c = result.progress_estimate;
    if (typeof c === "number" && (c < lo || c > hi)) {
      fails.push(`conf(${c.toFixed(2)}∉[${lo},${hi}])`);
    }
  }

  return { ok: fails.length === 0, fails };
}

export function check(
  result: SkeletonDiagnostic,
  expected: ExpectationEntry,
): CheckResult {
  if (result.mode === "partial") return checkPartial(result, expected);
  return checkFull(result, expected);
}

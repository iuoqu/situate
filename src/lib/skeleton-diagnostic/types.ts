/**
 * Types for the skeleton-diagnostic module. Two modes:
 *
 *   - **full**     A completed draft. Output is a verdict (story / 描摹 / 随笔 /
 *                  说明) with engine identification and per-axis diagnostics.
 *                  Mirrors the candidate "Is It a Story?" principle that may
 *                  later become a real `principles/px.ts` checker.
 *
 *   - **partial**  A draft being written. Output is an observation, not a
 *                  verdict — each skeleton axis gets a status (present /
 *                  hinted / not_yet) and a low confidence is expected when the
 *                  draft hasn't reached the relevant move. Used by the
 *                  /submit-form sidebar to give live diagnostic to authors.
 *
 * Schema parity with the Python `analyze.py` rubric in
 * `story-gate-eval/` is intentional — the same eval specimens score both
 * implementations.
 */

import type Anthropic from "@anthropic-ai/sdk";

export type DiagnosticMode = "full" | "partial";

// ─── Shared vocabulary ─────────────────────────────────────────────────────

export type TransformationDimension = "situation" | "understanding" | "both";

export type Engine =
  | "conflict"
  | "recontextualize"
  | "revelation"
  | "inevitability";

export type FailureType = "描摹" | "随笔" | "说明" | null;

export type Severity = "ok" | "note" | "warn" | "error";

export type AxisStatus = "present" | "hinted" | "not_yet";

// ─── Full-mode shape ───────────────────────────────────────────────────────

export interface Skeleton {
  S0: string;
  D: string;
  T: string;
  S1: string;
  K: string;
  transformation_dimension: TransformationDimension;
}

export interface GatePredicate {
  verdict: boolean;
  why: string;
}

export interface Gate {
  transformed: GatePredicate;
  causal: GatePredicate;
  stakes_bound: GatePredicate;
  is_story: boolean;
  if_not_story_type: FailureType;
  confidence: number;
  borderline_note: string;
}

export interface EngineWeight {
  engine: Engine;
  weight: number;
  why: string;
}

export type FullDiagnosticId =
  | "causal_spine"
  | "the_turn"
  | "economy"
  | "flat_subtext";

export interface FullDiagnosticAxis {
  id: FullDiagnosticId;
  finding: string;
  severity: Severity;
}

export interface FullDiagnostic {
  mode: "full";
  title_or_first_line: string;
  skeleton: Skeleton;
  gate: Gate;
  engines: EngineWeight[];
  diagnostics: FullDiagnosticAxis[];
  one_line_verdict: string;
  _meta?: DiagnosticMeta;
}

// ─── Partial-mode shape ────────────────────────────────────────────────────

export interface SkeletonAxisObservation {
  status: AxisStatus;
  note: string;
}

export interface SkeletonStatus {
  S0: SkeletonAxisObservation;
  D: SkeletonAxisObservation;
  T: SkeletonAxisObservation;
  S1: SkeletonAxisObservation;
  K: SkeletonAxisObservation;
}

export interface TentativeEngine {
  engine: Engine | "";
  weight: number;
  why: string;
}

export type PartialDiagnosticId = "causal_spine" | "economy";

export interface PartialDiagnosticAxis {
  id: PartialDiagnosticId;
  finding: string;
  severity: Severity;
}

export type NextAxisHint = "S0" | "D" | "T" | "S1" | "K" | "none";

export interface PartialDiagnostic {
  mode: "partial";
  title_or_first_line: string;
  skeleton_status: SkeletonStatus;
  progress_estimate: number;
  tentative_engines: TentativeEngine[];
  diagnostics: PartialDiagnosticAxis[];
  next_axis_hint: NextAxisHint;
  observation_summary: string;
  _meta?: DiagnosticMeta;
}

// ─── Common envelope ───────────────────────────────────────────────────────

export type SkeletonDiagnostic = FullDiagnostic | PartialDiagnostic;

export interface DiagnosticMeta {
  model: string;
  duration_ms: number;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens: number;
    cache_creation_input_tokens: number;
  };
}

// ─── Internal: raw tool-call input shapes (before we add `mode` + `_meta`) ──

export type RawFullToolInput = Omit<FullDiagnostic, "mode" | "_meta">;
export type RawPartialToolInput = Omit<PartialDiagnostic, "mode" | "_meta">;

// Tools exported as Anthropic.Tool — type-only re-export for callers that
// only need the type without importing the SDK directly.
export type DiagnosticTool = Anthropic.Tool;

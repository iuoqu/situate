import {
  DIAGNOSER_ID as CAUSAL_SPINE_ID,
  STATUS as CAUSAL_SPINE_STATUS,
  runCausalSpine,
  type CausalSpineJudgment,
} from "./causal_spine";
import {
  DIAGNOSER_ID as INTENT_REALIZATION_ID,
  STATUS as INTENT_REALIZATION_STATUS,
  runIntentRealization,
} from "./intent_realization";
import {
  DIAGNOSER_ID as STAKES_ABSENT_ID,
  STATUS as STAKES_ABSENT_STATUS,
  runStakesAbsent,
  type StakesAbsentJudgment,
} from "./stakes_absent";

/**
 * Registry of focused diagnosers. The /api/dev/run-diagnoser endpoint
 * looks up the diagnoser by id and dispatches.
 *
 * Each diagnoser is responsible for:
 *   - its own focused system prompt
 *   - its own output schema (small, single-axis)
 *   - a `pair_axis` if it's testable via contrast pairs (e.g. K_present
 *     vs K_absent for stakes_absent). null for diagnosers that don't
 *     fit the pair-test methodology.
 */

export interface DiagnoserDefinition {
  id: string;
  display_name: string;
  status: "experimental" | "production";
  description: string;
  /**
   * For contrast-pair tests: a function that, given a judgment, says
   * whether it indicates the "positive" or "negative" verdict on the
   * diagnoser's axis. Used by PDR computation.
   */
  pair_axis: {
    /** Filename suffix that indicates "positive" specimens (axis present). */
    positive_suffix: string;
    /** Filename suffix that indicates "negative" specimens (axis absent). */
    negative_suffix: string;
    /** Given a raw judgment, classify it as "positive" or "negative". */
    classify_judgment: (judgment: unknown) => "positive" | "negative" | "ambiguous";
  } | null;
  /**
   * When true: this diagnoser only runs when an intent block is
   * supplied. Routes should skip it otherwise. Its `run` function
   * receives the intent as the third argument. The other diagnosers
   * (stakes_absent, causal_spine) stay strictly per-axis and do NOT
   * receive intent — they would only be confused by it.
   */
  requires_intent: boolean;
  /** Runs the diagnoser against one specimen with one provider. */
  run: (
    text: string,
    providerId?: string,
    intent?: string,
  ) => Promise<unknown>;
}

export const DIAGNOSERS: Record<string, DiagnoserDefinition> = {
  [STAKES_ABSENT_ID]: {
    id: STAKES_ABSENT_ID,
    display_name: "stakes_absent",
    status: STAKES_ABSENT_STATUS,
    description:
      "Detects K-absence — whether any consciousness carries the weight of what occurs.",
    pair_axis: {
      // contrast pair specimens are named *_with_K.txt and *_no_K.txt
      positive_suffix: "_with_K.txt",
      negative_suffix: "_no_K.txt",
      // Strict binarization: only K_present counts as "K is squarely
      // here" (positive). K_implicit and K_absent both count as "K is
      // not squarely here" (negative). The v0 classifier was generous
      // (treated K_implicit as positive), which caused the first PDR
      // experiment to score 6% — models reliably returned K_implicit
      // on stripped specimens, so K_implicit had to belong to the
      // "not present" side for the binary contrast to track the line
      // the model actually draws.
      classify_judgment: (judgment) => {
        const j = judgment as Partial<StakesAbsentJudgment>;
        if (j.verdict === "K_present") return "positive";
        if (j.verdict === "K_implicit" || j.verdict === "K_absent")
          return "negative";
        return "ambiguous";
      },
    },
    requires_intent: false,
    run: runStakesAbsent,
  },
  [CAUSAL_SPINE_ID]: {
    id: CAUSAL_SPINE_ID,
    display_name: "causal_spine",
    status: CAUSAL_SPINE_STATUS,
    description:
      "Detects whether events form a causal chain ('therefore') or are merely sequential / juxtaposed ('and then').",
    pair_axis: {
      // contrast pair specimens are named *_causal.txt and *_juxtaposed.txt
      positive_suffix: "_causal.txt",
      negative_suffix: "_juxtaposed.txt",
      // Same strict binarization as stakes_absent: only the strongest
      // verdict counts as "positive". causal_implicit falls to the
      // negative side because in our contrast construction the positive
      // version is built to be explicitly causal — if the model only
      // sees implicit linkage, it has under-detected the spine.
      classify_judgment: (judgment) => {
        const j = judgment as Partial<CausalSpineJudgment>;
        if (j.verdict === "causal_present") return "positive";
        if (j.verdict === "causal_implicit" || j.verdict === "causal_absent")
          return "negative";
        return "ambiguous";
      },
    },
    requires_intent: false,
    run: runCausalSpine,
  },
  [INTENT_REALIZATION_ID]: {
    id: INTENT_REALIZATION_ID,
    display_name: "intent_realization",
    status: INTENT_REALIZATION_STATUS,
    description:
      "Given an author-declared intent block and prose, judges how completely the prose realizes the declared intent. Requires intent.",
    pair_axis: null, // contrast pairs don't apply — axis is per-call
    requires_intent: true,
    run: runIntentRealization,
  },
};

export function listDiagnosers(): DiagnoserDefinition[] {
  return Object.values(DIAGNOSERS);
}

export function getDiagnoser(id: string): DiagnoserDefinition | null {
  return DIAGNOSERS[id] ?? null;
}

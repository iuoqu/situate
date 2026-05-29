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
  /** Runs the diagnoser against one specimen with one provider. */
  run: (text: string, providerId?: string) => Promise<unknown>;
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
    run: runStakesAbsent,
  },
};

export function listDiagnosers(): DiagnoserDefinition[] {
  return Object.values(DIAGNOSERS);
}

export function getDiagnoser(id: string): DiagnoserDefinition | null {
  return DIAGNOSERS[id] ?? null;
}

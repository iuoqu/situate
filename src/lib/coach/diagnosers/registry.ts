import {
  DIAGNOSER_ID as CAUSAL_SPINE_ID,
  STATUS as CAUSAL_SPINE_STATUS,
  runCausalSpine,
  type CausalSpineJudgment,
} from "./causal_spine";
import {
  DIAGNOSER_ID as CENTER_CONSENSUS_ID,
  STATUS as CENTER_CONSENSUS_STATUS,
  runCenterConsensus,
} from "./center_consensus";
import {
  DIAGNOSER_ID as CHARACTER_CONSISTENCY_ID,
  STATUS as CHARACTER_CONSISTENCY_STATUS,
  runCharacterConsistency,
  type CharacterConsistencyJudgment,
} from "./character_consistency";
import {
  DIAGNOSER_ID as CHARACTER_INTERVIEW_ID,
  STATUS as CHARACTER_INTERVIEW_STATUS,
  runCharacterInterview,
} from "./character_interview";
import {
  DIAGNOSER_ID as ECONOMY_ID,
  STATUS as ECONOMY_STATUS,
  runEconomy,
  type EconomyJudgment,
} from "./economy";
import {
  DIAGNOSER_ID as INFERRED_INTENT_ID,
  STATUS as INFERRED_INTENT_STATUS,
  runInferredIntent,
} from "./inferred_intent";
import {
  DIAGNOSER_ID as INTENT_REALIZATION_ID,
  STATUS as INTENT_REALIZATION_STATUS,
  runIntentRealization,
} from "./intent_realization";
import {
  DIAGNOSER_ID as PLACE_ARC_ID,
  STATUS as PLACE_ARC_STATUS,
  runPlaceArc,
  type PlaceArcJudgment,
} from "./place_arc";
import {
  DIAGNOSER_ID as PLACE_INTERVIEW_ID,
  STATUS as PLACE_INTERVIEW_STATUS,
  runPlaceInterview,
} from "./place_interview";
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
  /**
   * When false: this diagnoser ignores the UI-selected providers and
   * runs once total, using its own internal provider (e.g.
   * center_consensus uses qwen-plus multi-sample). When true (default):
   * the route fans out one call per UI-selected provider.
   */
  provider_fanout: boolean;
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
    provider_fanout: true,
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
    provider_fanout: true,
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
    provider_fanout: true,
    run: runIntentRealization,
  },
  [INFERRED_INTENT_ID]: {
    id: INFERRED_INTENT_ID,
    display_name: "inferred_intent",
    status: INFERRED_INTENT_STATUS,
    description:
      "Independently reads the prose and reports the AI-inferred intent (K, transformation, setting, center of gravity, subtext signal). No verdict tier — it's an extractor, not a judge.",
    pair_axis: null,
    requires_intent: false,
    provider_fanout: true,
    run: runInferredIntent,
  },
  [ECONOMY_ID]: {
    id: ECONOMY_ID,
    display_name: "economy",
    status: ECONOMY_STATUS,
    description:
      "Detects whether every element in the prose earns its place. Handles device-style repetition (overprotest, ritual) as load-bearing, not slack.",
    pair_axis: {
      // economy contrast pairs not yet authored; placeholder suffixes
      // means /api/dev/diagnoser-pair-test will return "no pairs found"
      // until the corpus exists.
      positive_suffix: "_taut.txt",
      negative_suffix: "_slack.txt",
      classify_judgment: (judgment) => {
        const j = judgment as Partial<EconomyJudgment>;
        if (j.verdict === "economy_present") return "positive";
        if (j.verdict === "economy_implicit" || j.verdict === "economy_absent")
          return "negative";
        return "ambiguous";
      },
    },
    requires_intent: false,
    provider_fanout: true,
    run: runEconomy,
  },
  [CENTER_CONSENSUS_ID]: {
    id: CENTER_CONSENSUS_ID,
    display_name: "center_consensus",
    status: CENTER_CONSENSUS_STATUS,
    description:
      "Multi-sample structural robustness check. Runs qwen-plus N times at high temperature, votes on the center of gravity. Tests intra-model robustness — complements inter-model consensus from inferred_intent.",
    pair_axis: null,
    requires_intent: false,
    provider_fanout: false, // uses internal qwen-plus, ignores UI provider selection
    run: runCenterConsensus,
  },
  [CHARACTER_INTERVIEW_ID]: {
    id: CHARACTER_INTERVIEW_ID,
    display_name: "character_interview",
    status: CHARACTER_INTERVIEW_STATUS,
    description:
      "Generative — asks the writer 8 Stanislavski/Slumdog-style character backstory questions. Output is questions, not verdicts. Used in the guided write flow as an optional deep-dive workshop.",
    pair_axis: null,
    requires_intent: false,
    provider_fanout: false, // uses internal Sonnet
    run: runCharacterInterview,
  },
  [PLACE_INTERVIEW_ID]: {
    id: PLACE_INTERVIEW_ID,
    display_name: "place_interview",
    status: PLACE_INTERVIEW_STATUS,
    description:
      "Generative — asks the writer 8 place backstory questions (history/sensory/time/secrets/physical/others/marking events/boundaries). Maps to Situate's place-anchored mission: place has its own arc.",
    pair_axis: null,
    requires_intent: false,
    provider_fanout: false, // uses internal Sonnet
    run: runPlaceInterview,
  },
  [CHARACTER_CONSISTENCY_ID]: {
    id: CHARACTER_CONSISTENCY_ID,
    display_name: "character_consistency",
    status: CHARACTER_CONSISTENCY_STATUS,
    description:
      "Compares declared character backstory (in the intent block) against the prose. Flags drift — places where prose contradicts or has no backstory support. Requires intent.",
    pair_axis: {
      positive_suffix: "_consistent.txt",
      negative_suffix: "_drift.txt",
      classify_judgment: (judgment) => {
        const j = judgment as Partial<CharacterConsistencyJudgment>;
        if (j.verdict === "character_consistency_present") return "positive";
        if (
          j.verdict === "character_consistency_implicit" ||
          j.verdict === "character_consistency_absent"
        )
          return "negative";
        return "ambiguous";
      },
    },
    requires_intent: true,
    provider_fanout: true,
    run: runCharacterConsistency,
  },
  [PLACE_ARC_ID]: {
    id: PLACE_ARC_ID,
    display_name: "place_arc",
    status: PLACE_ARC_STATUS,
    description:
      "Reads the prose and identifies whether the central place has its own arc, what type (convergent/divergent/static/shifting/absent), and how it relates to the character arc. Works best on 1500+ char prose.",
    pair_axis: {
      positive_suffix: "_with_arc.txt",
      negative_suffix: "_static.txt",
      classify_judgment: (judgment) => {
        const j = judgment as Partial<PlaceArcJudgment>;
        if (j.verdict === "place_arc_present") return "positive";
        if (
          j.verdict === "place_arc_implicit" ||
          j.verdict === "place_arc_absent"
        )
          return "negative";
        return "ambiguous";
      },
    },
    requires_intent: false,
    provider_fanout: true,
    run: runPlaceArc,
  },
};

export function listDiagnosers(): DiagnoserDefinition[] {
  return Object.values(DIAGNOSERS);
}

export function getDiagnoser(id: string): DiagnoserDefinition | null {
  return DIAGNOSERS[id] ?? null;
}

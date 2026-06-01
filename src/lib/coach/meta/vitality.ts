/**
 * Story readiness signals — meta-aggregator.
 *
 * Does NOT call an LLM. Aggregates already-run diagnoser signals into a
 * neutral 5-signal report ("readiness signals"). The writer reads the
 * signal report as a glanceable copilot view — NOT as a quality verdict.
 *
 * Per METHODOLOGY v2.0:
 *   §3 Aggregation ≠ verdict: signal counts are aggregation, permitted.
 *     Quality verdicts (vital / flat) are forbidden.
 *   §18.9 AI gives categories, user gives specifics: each signal's
 *     "consequence" copy reports structural fact, not prescription.
 *
 * The 5 signals:
 *   1. K_carrier present       — stakes_absent finds something carrying K
 *   2. causation holds         — causal_spine majority not absent
 *   3. character backstory     — character_consistency present, or intent declares backstory
 *   4. place participates      — place_arc not absent
 *   5. subtext present         — inferred_intent finds a subtext pattern
 *
 * Output: 5 per-signal rows + neutral fact count ("3 of 5 signals firing").
 * NO verdict. NO aesthetic label. NO ranking.
 *
 * Future v2.X work (B.1.4): drive-aware signal set — when entangled drive,
 * swap to the_thing_arrived + recurrent_image axes. Currently runs in
 * drive-agnostic mode (signals are purposeful-leaning).
 */

import type { PreviewResponse } from "../lay-translator";

export interface ReadinessSignal {
  id:
    | "k_carrier_present"
    | "causation_holds"
    | "character_backstory"
    | "place_participates"
    | "subtext_present";
  label: string;
  /** true = firing, false = not firing, null = signal not available (diagnoser didn't run) */
  state: boolean | null;
  /** One-line neutral fact about what's there or not. NOT prescriptive. */
  fact: string;
}

export interface VitalityResult {
  signals: ReadinessSignal[];
  /** Count of signals where state === true. */
  firing: number;
  /** Count of signals where state !== null. */
  evaluated: number;
  /** Neutral fact-string. NO verdict, NO aesthetic label. */
  summary: string;
}

export function computeVitality(
  response: PreviewResponse,
  intentBlock?: string,
): VitalityResult {
  const signals: ReadinessSignal[] = [
    kCarrierPresent(response),
    causationHolds(response),
    characterBackstory(response, intentBlock),
    placeParticipates(response),
    subtextPresent(response),
  ];

  const firing = signals.filter((s) => s.state === true).length;
  const evaluated = signals.filter((s) => s.state !== null).length;

  const summary =
    evaluated === 0
      ? "未跑足够诊断器，无信号可报告。"
      : `${evaluated} 项已评估，其中 ${firing} 项 firing。`;

  return { signals, firing, evaluated, summary };
}

// ─── individual signal evaluators ───────────────────────────────────────────

function kCarrierPresent(response: PreviewResponse): ReadinessSignal {
  const stakes = response.results.stakes_absent;
  if (!stakes) {
    return {
      id: "k_carrier_present",
      label: "K 有承载者",
      state: null,
      fact: "未跑 stakes_absent。",
    };
  }
  const verdicts = verdictsOf(stakes);
  const total = verdicts.length;
  if (total === 0) {
    return {
      id: "k_carrier_present",
      label: "K 有承载者",
      state: null,
      fact: "无判定结果。",
    };
  }
  const presentCount = verdicts.filter((v) => v === "K_present").length;
  if (presentCount > total / 2) {
    return {
      id: "k_carrier_present",
      label: "K 有承载者",
      state: true,
      fact: "多数读者读到有人在承担这件事。",
    };
  }
  return {
    id: "k_carrier_present",
    label: "K 有承载者",
    state: false,
    fact: "多数读者没读到有人在承担这件事。",
  };
}

function causationHolds(response: PreviewResponse): ReadinessSignal {
  const causal = response.results.causal_spine;
  if (!causal) {
    return {
      id: "causation_holds",
      label: "因果立得住",
      state: null,
      fact: "未跑 causal_spine。",
    };
  }
  const verdicts = verdictsOf(causal);
  const total = verdicts.length;
  if (total === 0) {
    return {
      id: "causation_holds",
      label: "因果立得住",
      state: null,
      fact: "无判定结果。",
    };
  }
  const absentCount = verdicts.filter((v) => v === "causal_absent").length;
  // implicit counts as "holds" — implicit causation is the dominant
  // register in many prose traditions.
  const holdsCount = total - absentCount;
  if (holdsCount > total / 2) {
    return {
      id: "causation_holds",
      label: "因果立得住",
      state: true,
      fact: "多数读者读到事件之间的因果链（可显式或隐含）。",
    };
  }
  return {
    id: "causation_holds",
    label: "因果立得住",
    state: false,
    fact: "多数读者读到事件平行陈述（可重排）。",
  };
}

function characterBackstory(
  response: PreviewResponse,
  intentBlock?: string,
): ReadinessSignal {
  const charConsistency = response.results.character_consistency;
  const declaresBackstory =
    !!intentBlock &&
    /backstory|背景|given circumstances|前史|身世/i.test(intentBlock);

  if (charConsistency) {
    const verdicts = verdictsOf(charConsistency);
    const total = verdicts.length;
    if (total > 0) {
      const present = verdicts.filter(
        (v) => v === "character_consistency_present",
      ).length;
      if (present >= total / 2) {
        return {
          id: "character_backstory",
          label: "角色背景在场",
          state: true,
          fact: "声明的角色 backstory 在 prose 中得到落实。",
        };
      }
      return {
        id: "character_backstory",
        label: "角色背景在场",
        state: false,
        fact: "声明的角色 backstory 跟 prose 行为不一致。",
      };
    }
  }

  if (declaresBackstory) {
    return {
      id: "character_backstory",
      label: "角色背景在场",
      state: true,
      fact: "intent 块中包含角色 backstory 声明。",
    };
  }

  return {
    id: "character_backstory",
    label: "角色背景在场",
    state: false,
    fact: "未声明角色 backstory，且 prose 未被 character_consistency 跑过。",
  };
}

function placeParticipates(response: PreviewResponse): ReadinessSignal {
  const placeArc = response.results.place_arc;
  if (!placeArc) {
    return {
      id: "place_participates",
      label: "地点参与",
      state: null,
      fact: "未跑 place_arc。",
    };
  }
  const arcTypes = fieldOf(placeArc, "arc_type");
  const total = arcTypes.length;
  if (total === 0) {
    return {
      id: "place_participates",
      label: "地点参与",
      state: null,
      fact: "无判定结果。",
    };
  }
  const absentCount = arcTypes.filter((a) => a === "absent").length;
  if (absentCount >= total / 2) {
    return {
      id: "place_participates",
      label: "地点参与",
      state: false,
      fact: "多数读者读到地点是 backdrop，未参与叙事变化。",
    };
  }
  return {
    id: "place_participates",
    label: "地点参与",
    state: true,
    fact: "多数读者读到地点有自己的弧光或参与互动。",
  };
}

function subtextPresent(response: PreviewResponse): ReadinessSignal {
  const intent = response.results.inferred_intent;
  if (!intent) {
    return {
      id: "subtext_present",
      label: "subtext 可读出",
      state: null,
      fact: "未跑 inferred_intent。",
    };
  }
  const subtexts = fieldOf(intent, "subtext_pattern").filter(
    (s) => s && s.length > 4,
  );
  if (subtexts.length >= 2) {
    return {
      id: "subtext_present",
      label: "subtext 可读出",
      state: true,
      fact: "多个读者识别出一致的 subtext pattern。",
    };
  }
  return {
    id: "subtext_present",
    label: "subtext 可读出",
    state: false,
    fact: "读者未识别出明确的 subtext pattern。",
  };
}

// ─── helpers ─────────────────────────────────────────────────────────────

function verdictsOf(
  result: PreviewResponse["results"][string],
): string[] {
  return Object.values(result.by_provider)
    .map((c) => {
      const j = (c?.judgment ?? {}) as Record<string, unknown>;
      return typeof j.verdict === "string" ? j.verdict : "";
    })
    .filter(Boolean);
}

function fieldOf(
  result: PreviewResponse["results"][string],
  field: string,
): string[] {
  return Object.values(result.by_provider)
    .map((c) => {
      const j = (c?.judgment ?? {}) as Record<string, unknown>;
      return typeof j[field] === "string" ? (j[field] as string).trim() : "";
    })
    .filter(Boolean);
}

/**
 * Story vitality prediction — meta-diagnoser.
 *
 * Does NOT call an LLM. Aggregates already-run diagnoser signals into a
 * traffic-light verdict that answers the pre-writing question: "is this
 * going to feel alive, or read like a primary-school diary?"
 *
 * The 5 signals (from missing-modules-v1 P1.11):
 *   1. K will move          — stakes_absent finds K + intent declares a transformation
 *   2. causation holds      — causal_spine majority not absent
 *   3. character not flat   — character_consistency present, or intent declares backstory
 *   4. setting specific     — place_arc not absent (place is participant, not backdrop)
 *   5. subtext exists       — inferred_intent finds a subtext pattern
 *
 * Verdict:
 *   vital      — 4+ signals firing
 *   borderline — 2-3 signals firing
 *   flat       — 0-1 signals firing
 *
 * Pure derivation: latency = O(n) over diagnoser results, zero LLM cost.
 */

import type { PreviewResponse } from "../lay-translator";

export type VitalityVerdict = "vital" | "borderline" | "flat";

export interface VitalitySignal {
  id:
    | "k_will_move"
    | "causation_holds"
    | "character_not_flat"
    | "setting_specific"
    | "subtext_exists";
  label: string;
  /** true = firing, false = missing, null = no signal available (diagnoser didn't run) */
  state: boolean | null;
  /** One-line plain-language reason for the state. */
  reason: string;
  /** Concrete suggestion if missing; empty if firing or unavailable. */
  suggestion: string;
}

export interface VitalityResult {
  verdict: VitalityVerdict;
  signals: VitalitySignal[];
  /** Count of firing signals (state === true). */
  firing: number;
  /** Count of signals with a definitive verdict (state !== null). */
  evaluated: number;
  summary: string;
}

export function computeVitality(
  response: PreviewResponse,
  intentBlock?: string,
): VitalityResult {
  const signals: VitalitySignal[] = [
    kWillMove(response, intentBlock),
    causationHolds(response),
    characterNotFlat(response, intentBlock),
    settingSpecific(response),
    subtextExists(response),
  ];

  const firing = signals.filter((s) => s.state === true).length;
  const evaluated = signals.filter((s) => s.state !== null).length;

  let verdict: VitalityVerdict;
  if (firing >= 4) verdict = "vital";
  else if (firing >= 2) verdict = "borderline";
  else verdict = "flat";

  const summary = buildSummary(verdict, firing, evaluated, signals);

  return { verdict, signals, firing, evaluated, summary };
}

// ─── individual signal evaluators ───────────────────────────────────────────

function kWillMove(
  response: PreviewResponse,
  intentBlock?: string,
): VitalitySignal {
  const stakes = response.results.stakes_absent;
  const intent = response.results.inferred_intent;

  if (!stakes) {
    return {
      id: "k_will_move",
      label: "K 会动起来",
      state: null,
      reason: "没跑 stakes_absent，无法判断。",
      suggestion: "",
    };
  }

  const verdicts = verdictsOf(stakes);
  const presentCount = verdicts.filter((v) => v === "K_present").length;
  const total = verdicts.length;
  const kPresent = total > 0 && presentCount > total / 2;

  // Intent transformation: either declared in the intent block, or
  // surfaced by inferred_intent's transformation field.
  const intentDeclares =
    !!intentBlock && /转变|transformation|变化/i.test(intentBlock);
  const inferredTransformation =
    intent && fieldOf(intent, "transformation").some((t) => t && t !== "无");
  const hasTransformation = intentDeclares || inferredTransformation;

  if (kPresent && hasTransformation) {
    return {
      id: "k_will_move",
      label: "K 会动起来",
      state: true,
      reason: "有人在承受 + 故事里有可能的转变。",
      suggestion: "",
    };
  }
  if (kPresent && !hasTransformation) {
    return {
      id: "k_will_move",
      label: "K 会动起来",
      state: false,
      reason: "有人在承受这件事，但还看不到 ta 会怎么动 / 变。",
      suggestion: "想一下：这件事压在 ta 身上之后，ta 会做什么不同的事？",
    };
  }
  return {
    id: "k_will_move",
    label: "K 会动起来",
    state: false,
    reason: "AI 还感觉不到有人真的承担这件事——更像在描述事件本身。",
    suggestion: "让某一个具体的人在内心或行动上接住这件事。",
  };
}

function causationHolds(response: PreviewResponse): VitalitySignal {
  const causal = response.results.causal_spine;
  if (!causal) {
    return {
      id: "causation_holds",
      label: "因果立得住",
      state: null,
      reason: "没跑 causal_spine。",
      suggestion: "",
    };
  }
  const verdicts = verdictsOf(causal);
  const total = verdicts.length;
  if (total === 0) {
    return {
      id: "causation_holds",
      label: "因果立得住",
      state: null,
      reason: "无判定结果。",
      suggestion: "",
    };
  }
  const absentCount = verdicts.filter((v) => v === "causal_absent").length;
  const presentOrImplicit = total - absentCount;
  // 中文文学传统里 implicit 是主流，所以 implicit 算 holds。只有多数 absent 才算不成立。
  if (presentOrImplicit > total / 2) {
    return {
      id: "causation_holds",
      label: "因果立得住",
      state: true,
      reason: "事件之间有「因此」——不是流水账。",
      suggestion: "",
    };
  }
  return {
    id: "causation_holds",
    label: "因果立得住",
    state: false,
    reason: "事件读起来像「然后再然后」，没有「因此」——容易像日程表。",
    suggestion: "让某个事件明确是前一个事件造成的，哪怕只是暗示。",
  };
}

function characterNotFlat(
  response: PreviewResponse,
  intentBlock?: string,
): VitalitySignal {
  const charConsistency = response.results.character_consistency;
  const declaresBackstory =
    !!intentBlock &&
    /backstory|背景|circumstances|前史|身世/i.test(intentBlock);

  if (charConsistency) {
    const verdicts = verdictsOf(charConsistency);
    const present = verdicts.filter(
      (v) => v === "character_consistency_present",
    ).length;
    const total = verdicts.length;
    if (total > 0 && present >= total / 2) {
      return {
        id: "character_not_flat",
        label: "人物不扁",
        state: true,
        reason: "你定的角色 backstory 在 prose 里落实了。",
        suggestion: "",
      };
    }
    if (total > 0) {
      return {
        id: "character_not_flat",
        label: "人物不扁",
        state: false,
        reason: "你定了 backstory 但 prose 里角色的行为没接住。",
        suggestion:
          "让某个动作 / 选择 / 对话能追溯到你定的 backstory，否则 backstory 等于没写。",
      };
    }
  }

  if (declaresBackstory) {
    return {
      id: "character_not_flat",
      label: "人物不扁",
      state: true,
      reason: "intent 里你给了角色具体 backstory（Stanislavski「given circumstances」）。",
      suggestion: "",
    };
  }

  return {
    id: "character_not_flat",
    label: "人物不扁",
    state: false,
    reason: "没看到具体 backstory——角色容易停留在角色名 + 动作。",
    suggestion:
      "至少给你的核心人物 3 件 ta 来之前发生过的具体事，让 ta 不是「一个被故事推动的人形」。",
  };
}

function settingSpecific(response: PreviewResponse): VitalitySignal {
  const placeArc = response.results.place_arc;
  if (!placeArc) {
    return {
      id: "setting_specific",
      label: "设定具体",
      state: null,
      reason: "没跑 place_arc。",
      suggestion: "",
    };
  }
  const arcTypes = fieldOf(placeArc, "arc_type");
  const total = arcTypes.length;
  if (total === 0) {
    return {
      id: "setting_specific",
      label: "设定具体",
      state: null,
      reason: "无判定结果。",
      suggestion: "",
    };
  }
  const absentCount = arcTypes.filter((a) => a === "absent").length;
  if (absentCount >= total / 2) {
    return {
      id: "setting_specific",
      label: "设定具体",
      state: false,
      reason: "地点是 backdrop，不是参与者——设定可被任何「某个城市某个时代」替换。",
      suggestion:
        "找一个具体物件 / 气味 / 声音 / 边界，让这个地点只能是这一个地方。",
    };
  }
  return {
    id: "setting_specific",
    label: "设定具体",
    state: true,
    reason: "地点有自己的存在感，能跟人物互动。",
    suggestion: "",
  };
}

function subtextExists(response: PreviewResponse): VitalitySignal {
  const intent = response.results.inferred_intent;
  if (!intent) {
    return {
      id: "subtext_exists",
      label: "subtext 在场",
      state: null,
      reason: "没跑 inferred_intent。",
      suggestion: "",
    };
  }
  const subtexts = fieldOf(intent, "subtext_pattern").filter(
    (s) => s && s.length > 4,
  );
  if (subtexts.length >= 2) {
    return {
      id: "subtext_exists",
      label: "subtext 在场",
      state: true,
      reason: "AI 读到了一种 pattern——表面之下有另一层。",
      suggestion: "",
    };
  }
  return {
    id: "subtext_exists",
    label: "subtext 在场",
    state: false,
    reason: "AI 没读出「表面之下还有一层」——目前文本只在说它字面说的事。",
    suggestion:
      "想一下：除了字面发生的事，你想让读者顺便感觉到什么？让一个细节同时做两件事。",
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

function buildSummary(
  verdict: VitalityVerdict,
  firing: number,
  evaluated: number,
  signals: VitalitySignal[],
): string {
  if (evaluated === 0) {
    return "还没有跑足够的诊断，无法预测。";
  }
  if (verdict === "vital") {
    return `${firing}/${evaluated} 项指标命中——故事有活力，可以接着写。`;
  }
  const missing = signals
    .filter((s) => s.state === false)
    .map((s) => s.label)
    .join(" / ");
  if (verdict === "borderline") {
    return `${firing}/${evaluated} 项指标命中——边缘。缺：${missing}。先把缺的补上再写下去会更扎实。`;
  }
  return `${firing}/${evaluated} 项指标命中——目前像一篇小学生日记。缺：${missing}。`;
}

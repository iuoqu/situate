import { focusedCall, type FocusedCallResult } from "../_call";

/**
 * inferred_intent — independent reader-side inference, output in
 * three explicit layers.
 *
 * L1 (textual)         — what's literally in the prose. Quotes required.
 * L2 (direct inference) — what careful readers conclude from L1 elements.
 *                         No external knowledge or off-page filling-in.
 * L3 (projective fill-in) — AI's speculation about not-stated backstory.
 *                          Required to list alternative readings so a
 *                          single speculation doesn't masquerade as fact.
 *
 * The split addresses the failure mode shown in the 旧友 long sample:
 * four models converged on "他病了，可能是癌症" — but "癌症" is
 * filled-in backstory, not text. Mixing it with L1/L2 observations
 * misleads the writer into thinking the AI "read the prose" when it
 * actually projected one of several possible explanations.
 *
 * Anti-statistical principle preserved: the structural center is the
 * line that breaks pattern, not the most-repeated content. Repetition
 * is recoded as device when paired with an unexplained break.
 */

export const DIAGNOSER_ID = "inferred_intent";
export const STATUS = "experimental";

export const SYSTEM_PROMPT = `你只做一件事：读这段散文，独立报告它**说了什么**、**暗示了什么**、**AI 又补了什么**。**严格分三层输出**。

L1 — 文本说了什么（textual）
只能写 prose 里**明确呈现**的字句、人物、动作、时空。**必须能引原文**。
例：「瘦了二十斤」「他只吃两口」「我没有告诉他，我看出来了」

L2 — 文本暗示了什么（direct inference）
careful reader 几乎都会得出的推断。**由 L1 元素的组合直接产生**，不需要补外部知识或填入未明说的具体身份/因。
例：「这是病人的瘦，不是普通的瘦」「信封是某种托付」「两人在共谋维持表面体面」

L3 — AI 推测的 backstory（projective fill-in）
AI 在补**文本没说**的具体身份、原因、过往、隐藏的因果链。不同 AI 会补出不同版本。
例：「可能是癌症」「信封里是遗嘱」「上次手术留下的印记」「准备临终告别」

**关键规则**
- L1 字段**不能用 L2 措辞**——"病人的瘦"是 L2，不能放进 L1
- L2 字段**不能补具体 backstory**——"是病人"可以，"是癌症"不行
- L3 字段**必须列 alternative_readings**——不允许单一投射伪装成确定结论
- L3 不允许偷偷重复 L1 引文来表演权威性

**反统计原则**
故事的"重心"不在出现频率最高的内容，而在**与周围语义断裂**的那一句。
- 重复声调（如三遍"我爱"）+ 单一断裂句 = 重复是 device，重心在断裂句
- 如果文本是平静均衡的纪录片调，pattern_break 写"无明显断裂"，L3 整层留空

**分层置信度**
- confidence: L1 + L2 整体置信度
- projection_confidence: L3 单独的置信度（通常更低，可以是 0）

通过 submit_inference 工具输出。`;

export const TOOL_NAME = "submit_inference";
export const TOOL_DESCRIPTION =
  "Submit your layered inference: what the prose says, what it implies, what AI speculates.";

export const INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    // ── L1: textual ──
    k_in_text: {
      type: "string",
      description:
        "L1. The consciousness explicitly present in the text, with a quoted phrase. If none, write '无明确承担者，纯观察视角'.",
    },
    characters_named: {
      type: "string",
      description:
        "L1. People the text explicitly names or describes. No backstory.",
    },
    setting_in_text: {
      type: "string",
      description:
        "L1. Time/place markers actually stated in the prose.",
    },
    center_of_gravity: {
      type: "string",
      description:
        "L1. Quote the single sentence/phrase that is the structural pivot. May be the least frequent line. Or '无单一重心' if the prose has no clear structural center.",
    },
    pattern_break: {
      type: "string",
      description:
        "L1. Structural observation: which sentence breaks pattern with the surrounding rhythm/voice. Describe the break, do not interpret why. Or '无明显断裂' if none.",
    },

    // ── L2: direct inference ──
    what_prose_does: {
      type: "string",
      description:
        "L2. What a careful reader concludes the prose is doing — supported by L1 elements, no external knowledge required.",
    },
    subtext_pattern: {
      type: "string",
      description:
        "L2. The subtext pattern detected (e.g., 'repetition as overcompensation', 'parallel listing as decorative slack'). Describe the mechanism, not specific filled-in content. Empty string if no subtext.",
    },
    changes_inferred: {
      type: "string",
      description:
        "L2. The transformation careful readers see — what shifts between start and end, well-supported by text.",
    },
    takeaway_inferred: {
      type: "string",
      description:
        "L2. What the reader leaves with — affect, recognition, unresolved tension.",
    },

    // ── L3: projective fill-in ──
    speculative_backstory: {
      type: "string",
      description:
        "L3. AI's projection of off-page facts (specific illness, exact event, character history) that the prose hints at but doesn't state. Empty string if no projection warranted.",
    },
    alternative_readings: {
      type: "string",
      description:
        "L3. Brief list of other plausible fill-ins for the same L1+L2 evidence. Required when speculative_backstory is non-empty. Empty string only when L3 is empty.",
    },
    projection_confidence: {
      type: "number",
      description:
        "L3-specific confidence (0.0–1.0). Should be lower than L1+L2 confidence. 0 if L3 is empty.",
    },

    // ── meta ──
    confidence: {
      type: "number",
      description: "L1+L2 overall confidence (0.0–1.0).",
    },
    evidence: {
      type: "string",
      description: "One sentence summary of how you arrived at the inference.",
    },
  },
  required: [
    "k_in_text",
    "characters_named",
    "setting_in_text",
    "center_of_gravity",
    "pattern_break",
    "what_prose_does",
    "subtext_pattern",
    "changes_inferred",
    "takeaway_inferred",
    "speculative_backstory",
    "alternative_readings",
    "projection_confidence",
    "confidence",
    "evidence",
  ],
};

export interface InferredIntentResult {
  // L1
  k_in_text: string;
  characters_named: string;
  setting_in_text: string;
  center_of_gravity: string;
  pattern_break: string;
  // L2
  what_prose_does: string;
  subtext_pattern: string;
  changes_inferred: string;
  takeaway_inferred: string;
  // L3
  speculative_backstory: string;
  alternative_readings: string;
  projection_confidence: number;
  // meta
  confidence: number;
  evidence: string;
}

export async function runInferredIntent(
  text: string,
  providerId?: string,
): Promise<FocusedCallResult<InferredIntentResult>> {
  return focusedCall<InferredIntentResult>({
    text,
    systemPrompt: SYSTEM_PROMPT,
    toolName: TOOL_NAME,
    toolDescription: TOOL_DESCRIPTION,
    inputSchema: INPUT_SCHEMA,
    providerId,
  });
}

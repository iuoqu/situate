import { focusedCall, type FocusedCallResult } from "../_call";

/**
 * intent_realization — v0 focused diagnoser dedicated to author intent.
 *
 * The other focused diagnosers (stakes_absent, causal_spine) each
 * examine ONE craft axis of the prose. The previous experiment piped
 * intent through them all — but every diagnoser only catches intent
 * gaps on its own axis (stakes catches K mis-identification; causal
 * catches transformation mismatch). Worse, the more "charitable" models
 * (Sonnet) would re-interpret the prose to match declared intent,
 * defeating the comparison.
 *
 * This diagnoser is the dedicated comparison surface. Its only job:
 * given an <intent> block and <prose>, judge how completely the prose
 * realizes what the author declared they were attempting. It does not
 * judge whether the prose is good, whether K is present, whether the
 * causal chain holds — only realization fidelity.
 *
 * 3-tier verdict mirrors the pattern from K and causal:
 *   intent_implemented   — every declared element has a clear realization
 *   intent_partial       — some elements landed; others transformed or absent
 *   intent_unimplemented — declared intent and actual prose are largely
 *                          disjoint (e.g. declared "cat learns to type",
 *                          prose is a hospital scene)
 *
 * This diagnoser does NOT have a pair_axis — contrast-pair PDR doesn't
 * apply (axis = "intent realization", which is per-call, not per-prose).
 * Validation is by direct use, not by PDR.
 *
 * The diagnoser requires intent; if no intent is supplied, the route
 * skips it.
 */

export const DIAGNOSER_ID = "intent_realization";
export const STATUS = "experimental";

export const SYSTEM_PROMPT = `你只评估一件事：作者在 <intent> 块里声明的意图，在 <prose> 里实现了多少。

定义
"实现" = 作者声明的每一项关键元素（K 承担者、转变路径、设定、其他人物、读者留下的东西），都能在 prose 里找到对应的落地。不要求逐字对应——意思到了就算实现。

三档判定

intent_implemented
  作者声明的每一项关键元素都在 prose 里能找到清晰对应。即便表达方式不同，意图的"目的地"到了。
  例：声明"K = 女儿；转变 = 翻完抽屉后没走"——prose 里女儿确实是承担者，"没走"这一动作明确发生。

intent_partial
  部分元素到位（如 K 身份对了、设定对了），另一些被改写或缺失。
  最常见的情况是**转变路径被改写**：作者声明"女儿告诉妈妈悔意"，prose 里只到"女儿没走"——悔意只在内心独白，未出口。这不是"未实现"，是改成了另一条路径。

intent_unimplemented
  prose 与声明的意图几乎是两个故事。元素、人物、场景大面积不对。
  例：声明"K = 一只猫；转变 = 猫学会打字"——prose 是病房场景。直接 unimplemented。

注意
- 不要把"改写"误判为"未实现"——作者说要做 A，prose 做了 B（不是 A 但与 A 邻近），算 partial 而非 unimplemented
- 不要因为 prose 写得好就抬高 verdict——只评估"声明与实现是否对齐"，不评估 prose 质量
- 不要因为作者声明就贴近——只评估 prose 实际呈现，意图是参照系

输出字段
- realized: 一句话描述 prose 实际实现了意图里的什么。引文最多 1 处
- unrealized: 一句话描述 prose 没实现的（或改写成别的样子的）部分。如果完全实现就写空字符串
- evidence: 一句话总结，可引一处文本

通过 submit_judgment 工具输出。`;

export const TOOL_NAME = "submit_judgment";
export const TOOL_DESCRIPTION =
  "Submit your intent-realization judgment for this prose passage.";

export const INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    verdict: {
      type: "string",
      enum: ["intent_implemented", "intent_partial", "intent_unimplemented"],
      description:
        "intent_implemented = every declared element landed; intent_partial = some landed, others transformed or missing; intent_unimplemented = declared intent and actual prose are largely disjoint.",
    },
    realized: {
      type: "string",
      description:
        "1 sentence: what the prose actually realizes from the declared intent. Up to one quote.",
    },
    unrealized: {
      type: "string",
      description:
        "1 sentence: what the intent declared that the prose doesn't realize (or rewrites differently). Empty string if fully implemented.",
    },
    confidence: {
      type: "number",
      description: "0.0–1.0",
    },
    evidence: {
      type: "string",
      description:
        "1 sentence summary, may cite one passage.",
    },
  },
  required: ["verdict", "realized", "unrealized", "confidence", "evidence"],
};

export interface IntentRealizationJudgment {
  verdict: "intent_implemented" | "intent_partial" | "intent_unimplemented";
  realized: string;
  unrealized: string;
  confidence: number;
  evidence: string;
}

export async function runIntentRealization(
  text: string,
  providerId?: string,
  intent?: string,
): Promise<FocusedCallResult<IntentRealizationJudgment>> {
  return focusedCall<IntentRealizationJudgment>({
    text,
    systemPrompt: SYSTEM_PROMPT,
    toolName: TOOL_NAME,
    toolDescription: TOOL_DESCRIPTION,
    inputSchema: INPUT_SCHEMA,
    providerId,
    intent,
  });
}

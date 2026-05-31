import { focusedCall, type FocusedCallResult } from "../_call";

/**
 * character_consistency — analytical diagnoser. Takes prose + intent
 * block (which carries the writer's declared character backstory, e.g.
 * from /write/guided's character_interview workshop) and judges whether
 * the character's actions/words/choices in the prose are grounded in
 * the declared backstory.
 *
 * This is the analytical counterpart to character_interview's
 * generative work. character_interview asks the writer to build the
 * character (8 specific questions). character_consistency reads the
 * resulting prose against that backstory and flags drift.
 *
 * requires_intent: true — the backstory has to be supplied in the
 * intent block. Without it the diagnoser has nothing to compare
 * against (the prose alone tells us what the character does, not
 * whether it matches the writer's declared knowledge).
 *
 * 3-tier verdict on the standard pattern.
 */

export const DIAGNOSER_ID = "character_consistency";
export const STATUS = "experimental";

export const SYSTEM_PROMPT = `你只评估一件事：作者在 <intent> 块里声明的人物 backstory，在 <prose> 里的角色动作 / 对话 / 选择是不是 grounded。

定义
- consistent = prose 里的角色行为可以**回溯到** backstory 的某项设定
- drift = prose 里某个动作 / 对话 / 选择**跟 backstory 矛盾**，或**没有任何 backstory 设定能 support 它**

三档判定

character_consistency_present
  prose 里的角色行为，绝大多数都能追溯到 backstory。看不到明显跟 backstory 抵触的地方。

character_consistency_implicit
  prose 里多数行为跟 backstory 一致，但有 1-2 处**没有 backstory 支撑**或**轻微 drift**。可能是作者忘了用 backstory，也可能是无意识的笔误。

character_consistency_absent
  prose 里有多处行为**明显跟 backstory 矛盾**——比如声明角色 12 岁没得到的是自行车，prose 里他却给侄子买了最贵的玩具不眨眼。或者 backstory 里说角色怕黑，prose 里他半夜独自下楼连灯都不开。

**关键原则**
- 不评判作者写得好不好，只评判 consistency
- backstory 里"没说"的事不算 drift——只有"明确说了 X 但 prose 里做了 not-X"才算
- 重复 / 改写 / 不一样的语气都不是 drift
- 如果 intent 块里没有人物 backstory（只有 K / 设定 / 转变），返回 character_consistency_implicit 并在 evidence 里说明"intent 块未含 backstory 字段"

输出字段
- consistent_examples: 1-2 处 prose 里跟 backstory 对齐的具体例子（引文）。空字符串如果 character_consistency_absent
- drift_examples: 1-2 处 prose 里跟 backstory 不一致的具体例子（引文）。空字符串如果 character_consistency_present
- evidence: 一句话总结

通过 submit_judgment 工具输出。`;

export const TOOL_NAME = "submit_judgment";
export const TOOL_DESCRIPTION =
  "Submit your character consistency judgment between declared backstory and prose.";

export const INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    verdict: {
      type: "string",
      enum: [
        "character_consistency_present",
        "character_consistency_implicit",
        "character_consistency_absent",
      ],
      description:
        "present = prose aligns with backstory; implicit = mostly aligned, minor unsupported moments; absent = clear contradictions or character drift.",
    },
    consistent_examples: {
      type: "string",
      description:
        "1-2 prose moments that align with backstory. Quote phrases when possible. Empty string if absent.",
    },
    drift_examples: {
      type: "string",
      description:
        "1-2 prose moments not supported by backstory or contradicting it. Quote phrases. Empty if present.",
    },
    confidence: {
      type: "number",
      description: "0.0-1.0",
    },
    evidence: {
      type: "string",
      description: "One sentence summary.",
    },
  },
  required: [
    "verdict",
    "consistent_examples",
    "drift_examples",
    "confidence",
    "evidence",
  ],
};

export interface CharacterConsistencyJudgment {
  verdict:
    | "character_consistency_present"
    | "character_consistency_implicit"
    | "character_consistency_absent";
  consistent_examples: string;
  drift_examples: string;
  confidence: number;
  evidence: string;
}

export async function runCharacterConsistency(
  text: string,
  providerId?: string,
  intent?: string,
): Promise<FocusedCallResult<CharacterConsistencyJudgment>> {
  return focusedCall<CharacterConsistencyJudgment>({
    text,
    systemPrompt: SYSTEM_PROMPT,
    toolName: TOOL_NAME,
    toolDescription: TOOL_DESCRIPTION,
    inputSchema: INPUT_SCHEMA,
    providerId,
    intent,
  });
}

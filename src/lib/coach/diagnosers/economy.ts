import { focusedCall, type FocusedCallResult } from "../_call";

/**
 * economy — does every element earn its place?
 *
 * Chekhov's principle: if a gun appears on the wall, it must fire. The
 * craft test: can you delete this sentence / image / character without
 * losing meaning? If yes, it didn't earn its place.
 *
 * This is the structural backstop for the dog example. inferred_intent
 * fights statistical averaging by reframing repetition as device; if
 * that fails, economy independently flags the surplus.
 *
 * 3-tier verdict on the standard pattern:
 *   economy_present  — every element earns its place (taut)
 *   economy_implicit — most elements earn; minor slack tolerable
 *   economy_absent   — significant fraction is decorative or padding
 *
 * Critical subtext exception: repeated phrasing that LOOKS redundant
 * may be a structural device (overprotest, ritual, hammered emphasis).
 * The prompt teaches the model to test: "if I keep only one of these
 * repetitions, what's lost?" If something is lost, it's economy_present.
 */

export const DIAGNOSER_ID = "economy";
export const STATUS = "experimental";

export const SYSTEM_PROMPT = `你只评估一件事：这段散文里，每一个元素（句子、画面、人物、动作）是否都挣到自己的位置。

定义
- 元素"挣到位置" = 删掉它，文本会损失意义、情感、节奏、或推动力
- 元素"未挣到位置" = 删掉它，文本基本不变

**重要：subtext 类的"重复"是结构性，不是冗余**

重复的叙述声调（如三遍"我爱我的狗"）单看是 economy_absent，但如果重复本身是 device——
- 对冲愧疚（"我爱我的狗"× 3 + "下午打了一下" = 重复是仪式性掩饰）
- 制造仪式感（祈祷、口号、咒语）
- 累积情绪压力（强调、坚持）

它就是 economy_present——**重复在做结构上的事**。

检验题：如果只保留 1 句"我爱"删掉其他两句，会损失什么？
- 不损失意义、情感、调式 → 是 economy_absent（纯填充）
- 失去某种节奏、对冲、仪式感 → 是 economy_present（device）

三档判定

economy_present
  每个元素都挣到位置（包括"看似冗余但作为 device"的重复）。删任何一处都损失东西。

economy_implicit
  多数元素挣到位置，少数有冗余但不破坏整体（如一两句多余的描述、一个未发挥功能的次要细节）。

economy_absent
  显著比例的元素不挣位置——装饰描写、平行排比无功能、unproductive 的细节、纯填充的对话。

输出字段
- load_bearing: 一两个例子说明哪些元素挣到位置（包括 device 性的重复）。引文一处
- slack: 一两个例子说明哪些元素没挣到位置。如果 economy_present 就留空字符串
- evidence: 一句话总结

通过 submit_judgment 工具输出。`;

export const TOOL_NAME = "submit_judgment";
export const TOOL_DESCRIPTION =
  "Submit your economy judgment for this prose passage.";

export const INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    verdict: {
      type: "string",
      enum: ["economy_present", "economy_implicit", "economy_absent"],
      description:
        "economy_present = every element earns its place (taut); economy_implicit = mostly tight with minor slack; economy_absent = significant decorative or padding content.",
    },
    load_bearing: {
      type: "string",
      description:
        "1-2 examples of elements that earn their place, including device-style repetition. May cite one phrase.",
    },
    slack: {
      type: "string",
      description:
        "1-2 examples of elements that don't earn their place. Empty string if economy_present.",
    },
    confidence: {
      type: "number",
      description: "0.0–1.0",
    },
    evidence: {
      type: "string",
      description: "1 sentence summary.",
    },
  },
  required: ["verdict", "load_bearing", "slack", "confidence", "evidence"],
};

export interface EconomyJudgment {
  verdict: "economy_present" | "economy_implicit" | "economy_absent";
  load_bearing: string;
  slack: string;
  confidence: number;
  evidence: string;
}

export async function runEconomy(
  text: string,
  providerId?: string,
): Promise<FocusedCallResult<EconomyJudgment>> {
  return focusedCall<EconomyJudgment>({
    text,
    systemPrompt: SYSTEM_PROMPT,
    toolName: TOOL_NAME,
    toolDescription: TOOL_DESCRIPTION,
    inputSchema: INPUT_SCHEMA,
    providerId,
  });
}

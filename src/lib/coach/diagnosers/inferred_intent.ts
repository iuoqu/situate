import { focusedCall, type FocusedCallResult } from "../_call";

/**
 * inferred_intent — independent reader-side inference.
 *
 * The other focused diagnosers EVALUATE the prose on a specific axis.
 * This one is different: it INFERS — independently reads the prose and
 * reports what it thinks the story is actually doing. No verdict tier,
 * no axis judgment, no comparison with author intent. Pure read.
 *
 * Why: the author has two intents — what they declare (the intent card)
 * and what they actually wrote. These two diverge constantly. The
 * reader (and a careful AI) can see only the second. Surfacing the
 * AI-inferred intent gives the author a mirror onto their executed
 * intent, separately from their declared one.
 *
 * Critical design choice: the model must NOT default to statistical
 * averaging. The "center of gravity" of a short narrative is usually
 * the sentence that breaks pattern, not the sentence that repeats.
 * Three sentences saying "I love my dog" + one saying "I hit my dog"
 * is a story about hitting the dog. The prompt explicitly fights the
 * majority-vote tendency.
 */

export const DIAGNOSER_ID = "inferred_intent";
export const STATUS = "experimental";

export const SYSTEM_PROMPT = `你只做一件事：读这段散文，独立推断这位作者**实际在写**什么。

不是评判好坏，不是判断 axis 在不在。是回答：如果一位读者读完这段，他会读出什么故事？

**关键反统计原则**

故事的"重心"不在出现频率最高的内容，而在**与周围语义断裂的那一句**。
- 如果文本里有任何一句突然出现、未被解释、或与表面情绪相反，那一句通常就是真正的 D（扰动）
- 重复的叙述声调（如三遍"我爱"）往往是为了**对冲**那一处断裂——是 subtext 的征兆，不是 K 的确认
- 推断时优先报告这种张力，**不要按统计平均推断**

例：四句里有三句"我爱我的狗"和一句"下午打了一下我的狗"——故事是关于那一句"打"的，不是关于三句"爱"的。center_of_gravity = "下午打了一下"，subtext_signal = "重复的爱意宣告是对冲愧疚的仪式"。

如果文本里没有任何断裂、就是平静的均衡（如纪录片、纯描述），坦诚报告——center_of_gravity 可以写"无单一重心"，subtext_signal 留空。不要硬造 subtext。

输出字段
- k_inferred: 谁是承担者。可以是叙事者、显式人物、或"隐含读者"
- others_inferred: 其他出现的人物，及相对位置（背景/对手/共同承担者）
- changes_inferred: 转变是什么——读完之后，世界/某人/读者的理解发生了什么
- setting_inferred: 时空设定
- takeaway_inferred: 读者读完会留下什么（情绪、领悟、未解之结）
- center_of_gravity: 重心**落在哪一句**。引文一处
- subtext_signal: 如果检测到 subtext（声调与事件错位、未解释的断裂、反复声张的反面），描述。否则空字符串

通过 submit_inference 工具输出。`;

export const TOOL_NAME = "submit_inference";
export const TOOL_DESCRIPTION =
  "Submit your independent inference of what this prose is actually doing.";

export const INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    k_inferred: {
      type: "string",
      description: "Who carries the weight of the transformation.",
    },
    others_inferred: {
      type: "string",
      description: "Other persons present and their relational position.",
    },
    changes_inferred: {
      type: "string",
      description: "What transforms between start and end of the prose.",
    },
    setting_inferred: {
      type: "string",
      description: "Where and when.",
    },
    takeaway_inferred: {
      type: "string",
      description: "What the reader is left with.",
    },
    center_of_gravity: {
      type: "string",
      description:
        "Quote one sentence/phrase the prose actually pivots on. May be the least frequent line.",
    },
    subtext_signal: {
      type: "string",
      description:
        "If you detect tonal/event mismatch, unexplained breaks, or repeated assertion contradicted by a small moment — describe. Empty string if none.",
    },
    confidence: {
      type: "number",
      description: "0.0–1.0",
    },
    evidence: {
      type: "string",
      description: "1 sentence on how you arrived at the inference.",
    },
  },
  required: [
    "k_inferred",
    "others_inferred",
    "changes_inferred",
    "setting_inferred",
    "takeaway_inferred",
    "center_of_gravity",
    "subtext_signal",
    "confidence",
    "evidence",
  ],
};

export interface InferredIntentResult {
  k_inferred: string;
  others_inferred: string;
  changes_inferred: string;
  setting_inferred: string;
  takeaway_inferred: string;
  center_of_gravity: string;
  subtext_signal: string;
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

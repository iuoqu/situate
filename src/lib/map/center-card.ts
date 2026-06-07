import { focusedCall, type FocusedCallResult } from "@/lib/coach/_call";
import type { AnsweredQuestion, SynthesisResult } from "./types";

/**
 * situate.map — center card field generation (§7, post-naming step).
 *
 * After the writer names their center, generate three structural fields
 * that complete the center card:
 *
 *   core_question  — the structural question only this center can answer
 *   hardest_part   — the rendering difficulty implied by this center
 *   not_center     — 2–3 near-misses from the writer's own materials
 *
 * All fields are derived from the writer's own words (§3 "Categories not
 * specifics"). AI surfaces structure; writer supplied the content.
 */

export interface CenterCardFields {
  core_question: string;
  hardest_part: string;
  not_center: string[];
}

const SYSTEM_PROMPT = `你是 situate.map 的中心卡片生成助手。作者已经通过归纳算法确认了自己的中心，
现在需要从作者自己的素材和回答里提炼中心卡片的三个字段。

三个字段的要求：

1. core_question — 这篇作品在追问的结构性问题，一句话。
   - 必须只属于这个中心和这批素材，不能是泛泛的文学问题（"什么是意义"）
   - 必须来自作者说过的词或描述的处境
   - 50字以内
   - 以问句结尾

2. hardest_part — 在散文里渲染这个中心最难的地方，一句话。
   - 结构性困难（"中心的行动性贫乏，难以制造场景张力"是好例子）
   - 不是泛泛的审美评价（"情感复杂""描写难"太笼统）
   - 来自素材里能看到的矛盾或缺口

3. not_center — 在素材里真实出现过但没成为中心的2–3个东西。
   - 直接从作者的回答里取，用作者说过的词
   - 这些是写作中容易发生漂移的磁极，明确列出有助于作者守住中心

规则（严格遵守）：
- 所有内容来自作者自己的话，不发明不在素材里的人名、事件或场所
- 禁用审美评价词：强大、动人、有深度、精彩、丰富、感人
- 不预测作者会写什么，只陈列结构性事实
- 语言与素材语言保持一致（中文素材→中文输出；英文素材→英文输出）

通过 submit_center_card 工具输出。`;

const TOOL_NAME = "submit_center_card";
const TOOL_DESCRIPTION =
  "Submit the three generated center card fields after analysing the writer's center and source material.";

const INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    core_question: {
      type: "string",
      description:
        "The structural question this work is asking — one sentence, ≤50 chars, ends with a question mark, derived from the writer's own words.",
    },
    hardest_part: {
      type: "string",
      description:
        "The structural challenge in rendering this center in prose — one sentence, concrete, not an aesthetic judgement.",
    },
    not_center: {
      type: "array",
      items: { type: "string" },
      minItems: 2,
      maxItems: 3,
      description:
        "2–3 things from the writer's materials that are near the center but are NOT the center. Use the writer's own words.",
    },
  },
  required: ["core_question", "hardest_part", "not_center"],
};

function composeInput(
  center: string,
  material: string,
  answers: AnsweredQuestion[],
  synthesis: SynthesisResult,
): string {
  const answersBlock = answers
    .map((a) => `[${a.angle_name}]\n问：${a.question}\n答：${a.answer}`)
    .join("\n\n");

  const recurringBlock =
    synthesis.recurring.length > 0
      ? synthesis.recurring.map((p) => `"${p}"`).join("、")
      : "（无）";

  return [
    `作者确认的中心：${center}`,
    "",
    `素材世界：\n<material>\n${material}\n</material>`,
    "",
    `作者的问答回答：\n<answers>\n${answersBlock}\n</answers>`,
    "",
    `归纳算法提炼出的重复短语：${recurringBlock}`,
    synthesis.shared_frame ? `共同框架：${synthesis.shared_frame}` : "",
    `归纳消息：${synthesis.message}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generateCenterCard(
  center: string,
  material: string,
  answers: AnsweredQuestion[],
  synthesis: SynthesisResult,
  providerId?: string,
): Promise<FocusedCallResult<CenterCardFields>> {
  return focusedCall<CenterCardFields>({
    text: composeInput(center, material, answers, synthesis),
    systemPrompt: SYSTEM_PROMPT,
    toolName: TOOL_NAME,
    toolDescription: TOOL_DESCRIPTION,
    inputSchema: INPUT_SCHEMA,
    providerId,
  });
}

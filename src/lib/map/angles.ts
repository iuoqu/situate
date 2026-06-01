import { focusedCall, type FocusedCallResult } from "@/lib/coach/_call";
import type { AngleQuestion, QuestionsResult } from "./types";

/**
 * situate.map — angle question generation (§7, Socratic Step 2).
 *
 * Given a writer's source material (world description, characters,
 * events, texts), picks 5–6 of the 8 universal angles and instantiates
 * each as a specific question using names and details from the material.
 *
 * Constraints (§3 / §7 / §12):
 * - Never suggests a center
 * - Never names canonical authors/works (§12 Invariant 10)
 * - Center may be person, place, institution, or system
 * - Angles 2/4/5/7 adapt when center might be non-person
 * - Register-neutral: no heavy-register bias in question phrasing
 */

export const DIAGNOSER_ID = "map_angles";

const SYSTEM_PROMPT = `你是 situate.map 的选角助手。作者给了你一份素材世界的描述（人物、事件、
场所、文本摘录）。你的唯一工作：从下面八个角度中挑 5–6 个最适合这份素材的，然后把
每个角度实例化为一个具体问题，用素材里真实存在的名字和细节。

八个角度及其提问方向：

1 位置（Position）
  作者的注意力在素材里一直回到哪个结构性位置？

2 共鸣（Resonance）
  素材里哪个人/地方/处境，让作者感觉像是在认出自己的某一部分？
  （当素材中心可能是地点或系统时，改问："哪个地方或系统让作者感觉被
  卷进去、无法置身事外？"）

3 标签失效（Label Inadequacy）
  哪个外部分类把这里面某样东西框死了、框错了？

4 难以归类（Ungrabbable）
  谁/什么抵抗"英雄/反派/受害者"这类平坦化的定性？
  （地点/系统版："哪个地方或系统，拒绝被简化为背景或反派？"）

5 承载世界（World-Bearing）
  谁/什么的日常存在，最集中地承载了这个时代或这个世界？
  （轻盈版：可以是季节性的节奏、日常喜剧、平凡习惯——不一定是重大事件）

6 藏在边缘（Hidden in Periphery）
  真正的中心，是不是在明显舞台的边上？

7 最难写（Difficulty as Depth）
  哪一个的内心逻辑（或内部运转方式）最难被准确还原？
  （重要：最难 ≠ 最重。精准的喜剧可以比沉重的悲剧更难写。）

8 不可消去（Irreducibility）
  如果这份素材最后只剩一个名字/地点/机构/系统，是哪个？

关于中心类型：
中心可以是人，也可以是地方、机构、系统。八个角度都适用。挑角度和实例化问题时，
按素材里实际有什么来处理——不假设中心一定是人。

怎么说话（最重要）：
你是在跟一个写东西的普通人聊天，不是在写论文。想象你是一个中学语文老师，
在问一个中学生——对方聪明，但你绝不端着。
- 说人话。日常口语，第二人称（"你"），短句。
- 一个问题只问一件事。别把两三层意思塞进一句话，也别用破折号接一长串解释。
- 用素材里真实的人、地方、事来问，不要用抽象名词去堆。
- 严禁这类词：结构性、功能、枢纽、主体、客体、具身、承载、话语、张力、
  节奏、共谋、褶皱、范式、规训、锚定、实例化……凡是会让作者停下来想
  "这词什么意思"的，一律不要。
- 看一个例子，感受差别：
  ✗（别这样，太装）："作者的注意力是否始终锚定在'大庆某贸易有限公司'这个
    空壳公司的结构性功能上——它既不是真实经营实体，又成为虚开发票行为的实际
    操作枢纽？"
  ✓（要这样，人话）："你写这个案子的时候，是不是总忍不住绕回那家大庆的空壳
    公司？它不真做生意，可好像所有事都从它那儿过。"

引子（opener）：
每个问题再配一句引子，专门帮作者起笔——面对空白框，最难的就是写下第一个字。
- 引子是一句特别轻松的话，给作者一个具体的入口：一个画面、一个时刻、或者
  一句可以直接接着往下写的半句话（比如"可以这么起头：'我最忘不掉的是那次……'"）。
- 引子也要说人话，比问题还更松一点，像随口一说。
- 引子绝不能暗示哪个答案是对的——它只负责降低开口的门槛，不替作者选。

挑选规则：
- 根据素材密度和实际有东西可问的角度挑 5–6 个
- 每个问题必须用素材里真实出现的名字、地点或细节来具体化
- 不造素材里没有的内容
- 问题开放性强，不暗示答案
- 绝不推荐中心，绝不表示哪个角度"最重要"
- selection_note 是内部工作记录，不给作者看

通过 submit_questions 工具输出。`;

const TOOL_NAME = "submit_questions";
const TOOL_DESCRIPTION =
  "Submit the selected and instantiated angle questions for this material.";

const INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    questions: {
      type: "array",
      description: "5–6 instantiated questions, one per selected angle.",
      minItems: 5,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          angle_id: {
            type: "integer",
            minimum: 1,
            maximum: 8,
            description: "Which of the 8 universal angles this question comes from.",
          },
          angle_name: {
            type: "string",
            description: "Short angle label (e.g. '共鸣', '不可消去').",
          },
          question: {
            type: "string",
            description:
              "The instantiated question, in plain spoken Chinese (middle-school-teacher register, second person, short). Uses real names/details from the material. Open-ended, does not suggest an answer. NO critical jargon.",
          },
          opener: {
            type: "string",
            description:
              "一句帮作者起笔的引子：给一个具体入口（一个画面、一个时刻）或半句可以直接续写的开头。说人话，比问题更松。绝不暗示答案。",
          },
        },
        required: ["angle_id", "angle_name", "question", "opener"],
      },
    },
    selection_note: {
      type: "string",
      description:
        "Internal note (not shown to writer) on why these angles were selected over the others.",
    },
  },
  required: ["questions", "selection_note"],
};

export async function generateAngles(
  material: string,
  providerId?: string,
): Promise<FocusedCallResult<QuestionsResult>> {
  return focusedCall<QuestionsResult>({
    text: material,
    systemPrompt: SYSTEM_PROMPT,
    toolName: TOOL_NAME,
    toolDescription: TOOL_DESCRIPTION,
    inputSchema: INPUT_SCHEMA,
    providerId,
  });
}

export { type AngleQuestion, type QuestionsResult };

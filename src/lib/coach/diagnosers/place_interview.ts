import { focusedCall, type FocusedCallResult } from "../_call";

/**
 * place_interview — generative diagnoser parallel to character_interview.
 * Asks the writer 8 specific questions about the central place in their
 * story so that the place develops the depth a real setting has — its
 * own history, sensory texture, secrets, and arc.
 *
 * Maps to Situate's place-anchored mission: a place is not a static
 * backdrop. It has its own arc (time changes it, characters change it,
 * events mark it) that runs parallel to and interacts with character
 * arc.
 *
 * Same architecture as character_interview: generative, single internal
 * model call, output is questions not verdicts.
 */

export const DIAGNOSER_ID = "place_interview";
export const STATUS = "experimental";

const INTERNAL_PROVIDER_ID = "anthropic:claude-sonnet-4-6";

export const SYSTEM_PROMPT = `你是一个地点 workshop 教练。给你一段散文，你的工作是：

1. 识别 prose 里**最关键的一个地点**（不是设定的整体背景，是承担故事重量的那个具体空间）
2. 为这个地点生成 **8 个具体可数**的问题——目的是让作者了解这个地点的**肌理**

原则

地点不是静态背景，是有自己**弧光**的存在：
- 时间会改变它（早上的医院 vs 半夜的医院）
- 人物会改变它（妈妈健康时的厨房 vs 死后的厨房）
- 事件会标记它（"自从那次以后这屋就不一样了"）
- 它本身会改变（装修、磨损、被遗弃）

每个问题必须：
- **单一具体的可答事项**
- 答案能进入 prose——不是"这个地方很有意义"，是"这个地方半夜两点听得见什么"
- **不要重复 prose 里已经明示的事**——挑 prose 里没说但应该存在的

8 个问题必须**横跨 8 个不同范畴**（每个范畴 1 个）：
- 历史：这个地点 5 年前 / 10 年前是什么样的
- 感官：某一时刻的某一感官（半夜的声音、早晨的气味、冬天的触感）
- 时间变化：这个地点一天 / 一年里怎么变
- 秘密：这个地方有什么"没人提"的事
- 物理细节：墙皮、地砖、家具的某个具体磨损 / 标记
- 其他在场者：来这里的不是主角的人是谁
- 标记事件：这里发生过的某个具体的、可能跟主线无关的事
- 边界：这个地点的"外面"是什么（窗外 / 隔壁 / 楼下）

每个问题附 **1 句"why_matters"**——告诉作者答这个能产出什么。

通过 submit_interview 工具输出。`;

export const TOOL_NAME = "submit_interview";
export const TOOL_DESCRIPTION =
  "Submit 8 place backstory questions for the writer, one per category.";

export const INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    focal_place: {
      type: "string",
      description:
        "Name or short description of the place. The specific space carrying the story's weight (not the broader setting).",
    },
    rationale: {
      type: "string",
      description:
        "One sentence: why these particular questions for this particular place.",
    },
    questions: {
      type: "array",
      description:
        "Exactly 8 questions, one per category (历史/感官/时间变化/秘密/物理细节/其他在场者/标记事件/边界).",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          category: {
            type: "string",
            enum: [
              "历史",
              "感官",
              "时间变化",
              "秘密",
              "物理细节",
              "其他在场者",
              "标记事件",
              "边界",
            ],
          },
          question: {
            type: "string",
            description: "Single sentence, concrete and answerable.",
          },
          why_matters: {
            type: "string",
            description: "1 sentence: how answering this could feed prose.",
          },
        },
        required: ["category", "question", "why_matters"],
      },
    },
  },
  required: ["focal_place", "rationale", "questions"],
};

export interface PlaceInterviewResult {
  focal_place: string;
  rationale: string;
  questions: Array<{
    category: string;
    question: string;
    why_matters: string;
  }>;
}

export async function runPlaceInterview(
  text: string,
  _providerId?: string,
): Promise<FocusedCallResult<PlaceInterviewResult>> {
  return focusedCall<PlaceInterviewResult>({
    text,
    systemPrompt: SYSTEM_PROMPT,
    toolName: TOOL_NAME,
    toolDescription: TOOL_DESCRIPTION,
    inputSchema: INPUT_SCHEMA,
    providerId: INTERNAL_PROVIDER_ID,
  });
}

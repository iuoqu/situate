import { focusedCall, type FocusedCallResult } from "../_call";

/**
 * character_interview — generative diagnoser. Instead of analyzing prose
 * for a verdict, asks the writer 8 specific Stanislavski/Slumdog-style
 * questions about their main character.
 *
 * Principle: every choice a character makes in prose should be grounded
 * in a specific lived experience the author knows (even if the reader
 * never sees 80% of it). This diagnoser helps the author build that
 * grounding by asking concrete, answerable questions.
 *
 * Different from all prior diagnosers:
 *   - Output is questions, not verdicts
 *   - Goal is to feed the author's authorial knowledge, not evaluate
 *   - No 3-tier structure (it's not measuring anything)
 *   - Runs once with internal model (provider_fanout: false)
 */

export const DIAGNOSER_ID = "character_interview";
export const STATUS = "experimental";

const INTERNAL_PROVIDER_ID = "anthropic:claude-sonnet-4-6";

export const SYSTEM_PROMPT = `你是一个角色 workshop 教练。给你一段散文，你的工作是：

1. 识别 prose 里最关键的一个角色（通常是 K——承担故事重量的人）
2. 为这个角色生成 **8 个具体可数**的问题——目的是帮作者更深入了解 ta

原则（具体细节工作坊）

每个问题必须：
- **单一具体的可答事项**——一个东西 / 一个人 / 一个时间 / 一个动作
- 答案能进入 prose——不是"她的世界观"，是"她口袋里有什么"
- 让作者听了**愿意答**，感到具体而非压迫
- **不要重复 prose 里已经明示的事**——挑 prose 里没说但应该存在的

8 个问题必须**横跨 8 个不同范畴**（每个范畴 1 个）：
- 习惯：日常的、重复的、不假思索的动作
- 记忆：一个具体的过去画面 / 时刻
- 关系：跟某个具体的人的具体关系细节
- 物件：身上 / 家里 / 口袋里 的某个具体物件
- 恐惧：怕的东西里最不好意思承认的一个
- 渴望：想要但没得到的某个具体东西
- 过去事件：某个具体的过去发生过的事
- 身体细节：体态 / 声音 / 习惯动作 / 外貌的具体一处

每个问题附 **1 句"why_matters"**——告诉作者答这个能产出什么（"这能让你日后写 ta 触碰东西的细节"）。

通过 submit_interview 工具输出。`;

export const TOOL_NAME = "submit_interview";
export const TOOL_DESCRIPTION =
  "Submit 8 character backstory questions for the writer, one per category.";

export const INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    focal_character: {
      type: "string",
      description:
        "Name or short description of the character. Usually the K bearing the story's weight.",
    },
    rationale: {
      type: "string",
      description:
        "One sentence: why these particular questions for this particular character.",
    },
    questions: {
      type: "array",
      description:
        "Exactly 8 questions, one per category (习惯/记忆/关系/物件/恐惧/渴望/过去事件/身体细节).",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          category: {
            type: "string",
            enum: [
              "习惯",
              "记忆",
              "关系",
              "物件",
              "恐惧",
              "渴望",
              "过去事件",
              "身体细节",
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
  required: ["focal_character", "rationale", "questions"],
};

export interface CharacterInterviewResult {
  focal_character: string;
  rationale: string;
  questions: Array<{
    category: string;
    question: string;
    why_matters: string;
  }>;
}

export async function runCharacterInterview(
  text: string,
  _providerId?: string, // ignored — internal model
): Promise<FocusedCallResult<CharacterInterviewResult>> {
  return focusedCall<CharacterInterviewResult>({
    text,
    systemPrompt: SYSTEM_PROMPT,
    toolName: TOOL_NAME,
    toolDescription: TOOL_DESCRIPTION,
    inputSchema: INPUT_SCHEMA,
    providerId: INTERNAL_PROVIDER_ID,
  });
}

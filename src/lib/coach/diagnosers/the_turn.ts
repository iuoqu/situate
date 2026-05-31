import { focusedCall, type FocusedCallResult } from "../_call";

/**
 * the_turn — focused diagnoser for closure.
 *
 * Singular job: judge whether the ending performs a recontextualization
 * / decisive close, or merely summarizes / restates the theme. Promised
 * by transformational-v0 as a load-bearing axis: the difference between
 * a piece that "lands" and one that just stops.
 *
 *   turn_present  — closing beat reframes the preceding material;
 *                   re-reading the opening feels different after the
 *                   close. Or a decisive, irreversible act/image lands
 *                   the weight.
 *   turn_implicit — a faint shift is felt but reader must supply most
 *                   of the recontextualization themselves; the close
 *                   gestures rather than lands.
 *   turn_absent   — the ending summarizes, restates, or simply stops.
 *                   No reframing; the opening reads the same after the
 *                   close as before.
 *
 * The diagnoser identifies WHERE the turn (if any) lands, and the TYPE
 * of turn — recontextualization, decision, reversal, or image-as-meaning.
 */

export const DIAGNOSER_ID = "the_turn";
export const STATUS = "experimental";

export const SYSTEM_PROMPT = `你只评估一件事：这段散文的**结尾**有没有完成"转"——让前文重读起来意义被重新排列，或者落下一个决定性的、不可逆的收束。

定义
"转"不是反转剧情，不是惊人结局。"转"是结尾那一下让你**回头看开头时，开头的意义变了**。或者，结尾的某个动作 / 形象 / 决定，**让前面所有铺垫的重量落到一个具体的点上**，不可撤回。

判定 = 读者读完最后一句，会不会有"再回去重读开头"的冲动？读完后，开头那句话还是不是原来那个意思？

三档判定

turn_present
  结尾明确完成一次重排或决定性收束。任一种都算：
  - recontextualization：结尾揭示出某个事实 / 视角 / 真相，让前文意义重排（不是悬念揭晓，是 frame 变了）
  - decision：人物做出一个不可逆的具体动作，前面所有铺垫的重量都压在这一下
  - reversal：结尾的状态跟开头形成明确反向（不是情节反转，是 stance / 关系 / 理解的反向）
  - image-as-meaning：结尾落在一个具体的形象 / 物件 / 动作上，这个形象把整段的主题 carry 住

  例（recontextualization）：开头母亲在厨房忙碌，结尾"她从来不会做这道菜，是父亲一直骗我们说她会"——开头读起来变了。
  例（decision）：「他没有再敲门。他把那把钥匙放在窗台上，走了。」

turn_implicit
  有一丝转的痕迹，但读者要做大部分功。结尾**指向**重排但没完成它，或者形象 / 动作有暗示但 weight 不够。

turn_absent
  结尾是 summary / restate / 平淡落幕。读完后开头还是原来那句。结尾可以删掉而不损失结构——或者结尾只是"于是事情就这样过去了"式的收束。
  常见 absent 模式：
  - 总结主题（"我们都长大了"）
  - 重复开头的意象但没新意义
  - 中断而不是收束（写到没话说了就停）
  - 抒情泛化（"生活总是这样"）

输出字段
- verdict: turn_present / turn_implicit / turn_absent
- turn_location: 结尾完成 turn 的具体那一句或那个动作；absent 就写"无"
- turn_type: recontextualization / decision / reversal / image_as_meaning / none
- recontextualization_test: 简短回答——"读完结尾后，开头第一句话的意义有没有变？" 1-2 句
- evidence: 1-2 句引具体词句

通过 submit_judgment 工具输出。`;

export const TOOL_NAME = "submit_judgment";
export const TOOL_DESCRIPTION =
  "Submit your judgment about whether the ending performs a turn.";

export const INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    verdict: {
      type: "string",
      enum: ["turn_present", "turn_implicit", "turn_absent"],
      description:
        "turn_present = ending reframes or decisively closes; turn_implicit = faint shift, reader supplies the work; turn_absent = summary or simply stops.",
    },
    turn_location: {
      type: "string",
      description:
        "The specific sentence or action where the turn lands. Write '无' if absent.",
    },
    turn_type: {
      type: "string",
      enum: [
        "recontextualization",
        "decision",
        "reversal",
        "image_as_meaning",
        "none",
      ],
      description:
        "recontextualization = frame shifts so opening reads differently; decision = irreversible act lands the weight; reversal = stance/relation/understanding inverts; image_as_meaning = closing image carries the theme; none = no turn.",
    },
    recontextualization_test: {
      type: "string",
      description:
        "Apply the test: does the opening line mean the same thing after reading the close? 1-2 sentences.",
    },
    confidence: {
      type: "number",
      description: "0.0-1.0",
    },
    evidence: {
      type: "string",
      description: "1-2 sentences citing specific phrases or junctures.",
    },
  },
  required: [
    "verdict",
    "turn_location",
    "turn_type",
    "recontextualization_test",
    "confidence",
    "evidence",
  ],
};

export interface TheTurnJudgment {
  verdict: "turn_present" | "turn_implicit" | "turn_absent";
  turn_location: string;
  turn_type:
    | "recontextualization"
    | "decision"
    | "reversal"
    | "image_as_meaning"
    | "none";
  recontextualization_test: string;
  confidence: number;
  evidence: string;
}

export async function runTheTurn(
  text: string,
  providerId?: string,
): Promise<FocusedCallResult<TheTurnJudgment>> {
  return focusedCall<TheTurnJudgment>({
    text,
    systemPrompt: SYSTEM_PROMPT,
    toolName: TOOL_NAME,
    toolDescription: TOOL_DESCRIPTION,
    inputSchema: INPUT_SCHEMA,
    providerId,
  });
}

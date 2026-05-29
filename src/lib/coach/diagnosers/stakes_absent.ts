import { focusedCall, type FocusedCallResult } from "../_call";

/**
 * stakes_absent — v0 focused diagnoser.
 *
 * Singular job: judge whether some consciousness in the prose carries
 * the *weight* of what occurs (= K in the skeleton). NOT about whether
 * the prose has a narrator (an external observer narrator exists too);
 * the question is whether anyone in the text is shown to have stakes
 * in the events.
 *
 * The previous monolithic RUBRIC made this judgment in the context of
 * gate + engine + 4 other diagnostics, which (per the first contrast-
 * pair experiment) flooded models with too much else to consider; they
 * defaulted to is_story=true on observational specimens because the
 * rest of the gate predicates passed. This focused prompt strips that
 * context: it asks ONE question.
 *
 * Verdict is 3-way, not binary: K_present / K_implicit / K_absent.
 * K_implicit acknowledges that observational prose often implies a
 * consciousness without making it explicit; the previous binary
 * forced everything into present.
 */

export const DIAGNOSER_ID = "stakes_absent";
export const STATUS = "experimental"; // not yet wired into prod coach engine

export const SYSTEM_PROMPT = `你只评估一件事：这段散文里，是否有某个意识承担着发生之事的"分量"（K）。

定义
K = 一个**因这次转变而有所得失或被改变**的意识。
不是"有没有叙事者"——任何散文都有叙事视角。是"有没有任何人在文本里被显示出**承担这次事件**"。

三档判定，不是 binary：

K_present
  叙事承担明确绑定到某个意识——通过其内心活动、其对事件的反应、其在事件中的得失。
  例：「我从厨房探头，知道门外是谁。十年没见。」（叙事者承担与父亲缺席的分量）

K_implicit
  叙事承担**隐含**于一个外在观察视角，但**没有被显式承载**。读者能感觉到一个意识在记录、在选择细节，但那意识没有被推到台前。
  例：「门内人开了门。两人在门两侧站着，约十秒。屋内传出水开的声音。」（有观察判断，但 K 没被显示承载）

K_absent
  纯事件流，无观察判断、无选择性。读起来像监控记录、统计报表、流程描述。
  例：「公寓三楼门铃响。门内有人在做饭。一名约六十岁男性在门外。两人发生对话，时长约一分钟。」

注意：很多 prose 处于 K_implicit 和 K_present 之间。**诚实判 K_implicit**，不要把 K_implicit 误升为 K_present。

通过 submit_judgment 工具输出。`;

export const TOOL_NAME = "submit_judgment";
export const TOOL_DESCRIPTION =
  "Submit your K-presence judgment for this prose passage.";

export const INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    verdict: {
      type: "string",
      enum: ["K_present", "K_implicit", "K_absent"],
      description:
        "K_present = consciousness explicitly carries weight; K_implicit = consciousness inferable but not made explicit; K_absent = pure event flow, no consciousness carrying weight.",
    },
    who: {
      type: "string",
      description:
        "If K_present: name/role/description of the consciousness carrying weight. If K_implicit: who is being implied. If K_absent: empty string.",
    },
    confidence: {
      type: "number",
      description: "0.0–1.0",
    },
    evidence: {
      type: "string",
      description:
        "1-2 sentences citing specific phrases that drove your judgment.",
    },
  },
  required: ["verdict", "who", "confidence", "evidence"],
};

export interface StakesAbsentJudgment {
  verdict: "K_present" | "K_implicit" | "K_absent";
  who: string;
  confidence: number;
  evidence: string;
}

export async function runStakesAbsent(
  text: string,
  providerId?: string,
): Promise<FocusedCallResult<StakesAbsentJudgment>> {
  return focusedCall<StakesAbsentJudgment>({
    text,
    systemPrompt: SYSTEM_PROMPT,
    toolName: TOOL_NAME,
    toolDescription: TOOL_DESCRIPTION,
    inputSchema: INPUT_SCHEMA,
    providerId,
  });
}

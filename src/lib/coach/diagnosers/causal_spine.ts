import { focusedCall, type FocusedCallResult } from "../_call";

/**
 * causal_spine — v0 focused diagnoser.
 *
 * Singular job: judge whether the events in this prose form a causal
 * chain ("because of X, Y") or are merely sequential / juxtaposed ("X,
 * and also Y"). This is the Pixar but/therefore axis: every story beat
 * should follow with "but..." or "therefore...", never "and then...".
 *
 * 3-way verdict mirrors stakes_absent — we discovered with K that the
 * middle ground (implicit) is where most prose actually lives, so we
 * build that in from the start instead of forcing a binary.
 *
 *   causal_present  — events explicitly or unmistakably cause each
 *                     other; removing any step breaks the chain.
 *   causal_implicit — chain is inferable but not stated; reader fills
 *                     in the "therefore" from arrangement and selection.
 *   causal_absent   — events are parallel observations or chronological
 *                     juxtaposition; could be reordered without loss.
 *
 * NOTE: in Chinese literary tradition (汪曾祺、契诃夫式), causal_implicit
 * is the dominant register — explicit "因此/所以" markers are considered
 * heavy-handed. Implicit ≠ failure. The diagnoser flags causal_absent.
 */

export const DIAGNOSER_ID = "causal_spine";
export const STATUS = "experimental";

export const SYSTEM_PROMPT = `你只评估一件事：这段散文里，事件之间是不是真的"因此"，还是只是"然后"。

定义
因果脊柱 = 事件 B 之所以发生（或之所以这样发生），是因为前面的事件 A。**抽掉 A，B 就讲不通了**。
不是"有没有'因为/所以'这两个字"——很多优秀短篇没有因果连词但因果极强。是"事件的存在和顺序，是否被前面的事件所约束"。

三档判定，不是 binary：

causal_present
  每个事件都明确或不可误读地由前一个事件引发。事件不可重排——重排会让后面的事件讲不通。
  例：「他失业了。第二天，他没出门。第三天，他也没出门。妻子开始把他的剃须刀收起来。」
  （失业 → 闭门 → 妻子的具体动作，环环相扣）

causal_implicit
  因果关系**隐含**于事件的并置和选择中，但文本不点破。读者通过排列推出"因此"。
  例：「七月，公司体检。八月，他开始每天散步。九月，把烟戒了。」
  （体检结果没写出来，但读者从后续行为推出"因此"）

causal_absent
  事件是平行观察或时间记录，**可以重排而不损失意义**。读起来像日程表、新闻报道、统计描述。
  例：「上半年公司业务下降百分之十二。三月，新的客户经理上任。四月，办公室搬迁。五月，年中评审延期。」
  （事件并列，无任何一项的存在依赖于另一项；可以任意重排）

注意
- 中文文学传统里，causal_implicit 是主流写法——不要把缺少"因此/所以"字面误判为 causal_absent
- 检验题：**如果把第二个事件挪到第四个事件之后，文本还讲得通吗？**
  - 完全讲不通 → causal_present
  - 大致还行但失去了重量 → causal_implicit
  - 没差别 → causal_absent

通过 submit_judgment 工具输出。`;

export const TOOL_NAME = "submit_judgment";
export const TOOL_DESCRIPTION =
  "Submit your causal-spine judgment for this prose passage.";

export const INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    verdict: {
      type: "string",
      enum: ["causal_present", "causal_implicit", "causal_absent"],
      description:
        "causal_present = events explicitly chained, cannot reorder; causal_implicit = chain inferable from arrangement, reader supplies 'therefore'; causal_absent = parallel observations, freely reorderable.",
    },
    reorder_test: {
      type: "string",
      description:
        "Apply the reorder test: name two events and say what would happen if you swapped their order. 1-2 sentences.",
    },
    confidence: {
      type: "number",
      description: "0.0–1.0",
    },
    evidence: {
      type: "string",
      description:
        "1-2 sentences citing specific phrases or junctures that drove your judgment.",
    },
  },
  required: ["verdict", "reorder_test", "confidence", "evidence"],
};

export interface CausalSpineJudgment {
  verdict: "causal_present" | "causal_implicit" | "causal_absent";
  reorder_test: string;
  confidence: number;
  evidence: string;
}

export async function runCausalSpine(
  text: string,
  providerId?: string,
): Promise<FocusedCallResult<CausalSpineJudgment>> {
  return focusedCall<CausalSpineJudgment>({
    text,
    systemPrompt: SYSTEM_PROMPT,
    toolName: TOOL_NAME,
    toolDescription: TOOL_DESCRIPTION,
    inputSchema: INPUT_SCHEMA,
    providerId,
  });
}

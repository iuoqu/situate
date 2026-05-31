import { focusedCall, type FocusedCallResult } from "../_call";

/**
 * place_arc — analytical diagnoser. Identifies whether the central
 * place in the prose has its own arc (transforms across the narrative)
 * or stays static. Reports the type of arc and its relation to the
 * character arc.
 *
 * Maps to Situate's place-anchored mission: place is not just setting,
 * it's a character with its own narrative weight. This diagnoser
 * surfaces whether the writer has used place as a participant or
 * left it as backdrop.
 *
 * Arc types
 *   convergent  — place gradually moves toward a state that resolves
 *                 with the character's transformation (same direction)
 *   divergent   — place moves opposite to character (contrast pattern,
 *                 often the most powerful literary use)
 *   static      — place is fixed; character transforms in front of an
 *                 unchanging witness
 *   shifting    — place changes but without clear direction (often a
 *                 flag for under-developed setting)
 *   absent      — no central place identifiable, or place is pure
 *                 backdrop
 *
 * 3-tier verdict structure: place_arc_present (a clear arc exists) /
 * implicit (faint or weak arc) / absent (no arc at all).
 *
 * Does NOT require intent. Reads prose directly. Works best on
 * 1500+ char prose where multiple time/place states can be observed.
 */

export const DIAGNOSER_ID = "place_arc";
export const STATUS = "experimental";

export const SYSTEM_PROMPT = `你只评估一件事：这段散文里的中心地点，**是否有它自己的弧光**——会不会在叙事过程中以不同的状态出现？

定义
- 地点弧光 = 同一个地点，在叙事的不同时刻被展现为**不同的状态**（早 vs 晚、改变前 vs 改变后、被事件标记前 vs 后、某种感知 vs 另一种感知）
- 地点不是 setting，地点是有变化能力的存在

三档判定

place_arc_present
  中心地点在 prose 中明确以多种状态呈现，且这些状态共同构成一条**有方向**的弧光。例如：从"日常照护"→"创伤现场"→"忏悔场所"。

place_arc_implicit
  地点有变化痕迹，但变化轻微或方向不清。例如：路灯亮起 / 天色渐暗这种纯时间变化。

place_arc_absent
  地点是静态的，或者根本没有可识别的中心地点。读起来像 backdrop，不像参与者。

弧光类型（适用于 present 和 implicit）

- convergent：地点弧光跟人物弧光**同向**——双重强化主题
- divergent：地点弧光跟人物弧光**反向**——制造张力（往往是最有力的用法，如人物觉醒 vs 地点继续沉睡）
- static：人物变了，地点没变——地点作为"不动的见证者"
- shifting：地点在变但方向不明，常是设定不够 developed 的信号

输出字段
- focal_place: prose 里承担故事重量的那个具体空间（不是 setting 整体）。如果没识别出，写"无中心地点"
- arc_type: convergent / divergent / static / shifting / absent
- states_observed: 一两句话说明地点在 prose 中以哪些不同状态出现（如有）
- relation_to_character: parallel / contrast / independent / unclear——地点弧光跟人物弧光的关系
- evidence: 一句话总结

通过 submit_judgment 工具输出。`;

export const TOOL_NAME = "submit_judgment";
export const TOOL_DESCRIPTION =
  "Submit your place arc judgment for the prose.";

export const INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    verdict: {
      type: "string",
      enum: ["place_arc_present", "place_arc_implicit", "place_arc_absent"],
      description:
        "present = clear directional arc; implicit = weak/unclear arc; absent = static or no central place.",
    },
    focal_place: {
      type: "string",
      description:
        "The specific space carrying narrative weight, or '无中心地点'.",
    },
    arc_type: {
      type: "string",
      enum: ["convergent", "divergent", "static", "shifting", "absent"],
      description:
        "convergent = place arc parallels character arc; divergent = opposite directions; static = place fixed; shifting = no clear direction; absent = no arc.",
    },
    states_observed: {
      type: "string",
      description:
        "One or two sentences describing the different states the place appears in. Empty if absent.",
    },
    relation_to_character: {
      type: "string",
      enum: ["parallel", "contrast", "independent", "unclear"],
      description:
        "How place arc relates to character arc: parallel (same direction) / contrast (opposite) / independent (no relation) / unclear (insufficient signal).",
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
    "focal_place",
    "arc_type",
    "states_observed",
    "relation_to_character",
    "confidence",
    "evidence",
  ],
};

export interface PlaceArcJudgment {
  verdict: "place_arc_present" | "place_arc_implicit" | "place_arc_absent";
  focal_place: string;
  arc_type: "convergent" | "divergent" | "static" | "shifting" | "absent";
  states_observed: string;
  relation_to_character: "parallel" | "contrast" | "independent" | "unclear";
  confidence: number;
  evidence: string;
}

export async function runPlaceArc(
  text: string,
  providerId?: string,
): Promise<FocusedCallResult<PlaceArcJudgment>> {
  return focusedCall<PlaceArcJudgment>({
    text,
    systemPrompt: SYSTEM_PROMPT,
    toolName: TOOL_NAME,
    toolDescription: TOOL_DESCRIPTION,
    inputSchema: INPUT_SCHEMA,
    providerId,
  });
}

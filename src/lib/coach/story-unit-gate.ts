import { focusedCall, type FocusedCallResult } from "./_call";

/**
 * Story unit gate — B.4.
 *
 * Reads a section of prose and extracts the five structural slots
 * (S0 / D / T / S1 / K) plus three predicate verdicts. When the
 * predicates indicate a structural failure, surfaces a single Socratic
 * coach question — never a red-pen rewrite.
 *
 * Slot definitions (flash_situate_spine):
 *   S0  initial state / situation at the opening of this section
 *   D   disruption — the event or shift that disturbs S0
 *   T   turn / response — the protagonist's reaction or the pivot
 *   S1  end state — how things stand at the section's close
 *   K   what this section is making visible (the consciousness carrier)
 *
 * Predicates:
 *   transformed  S0 and S1 differ in a meaningful way (not merely time)
 *   causal       D genuinely causes T / S1 (not just before/after)
 *   stakes       something is at risk or to gain (featherweight counts)
 *
 * Failure types (only when predicates flag absence):
 *   descriptive   scenic rendering without story movement; S0 ≈ S1
 *   essayistic    explains / reflects rather than shows scene events
 *   expository    background / setup without a live scene event
 *
 * The coach_question is a Socratic question aimed at the failure mode —
 * phrased so the author asks it of themselves. Never a verdict.
 */

export interface StoryUnitResult {
  s0: string;
  d: string;
  t: string;
  s1: string;
  k_hint: string;
  transformed: boolean;
  causal: boolean;
  stakes: boolean;
  failure_type: "descriptive" | "essayistic" | "expository" | null;
  coach_question: string | null;
}

const SYSTEM_PROMPT = `你是散文结构分析助手。你的唯一工作是从一节散文里提取五个结构槽，并判断三个谓词。

五个槽（flash_situate_spine）：
  S0  — 这一节开头时的处境 / 状态（一句话，具体，来自文本）
  D   — 打破 S0 的事件或转折（一句话，来自文本的具体时刻）
  T   — 主角的反应或场景的枢轴（一句话，来自文本）
  S1  — 这一节结尾时的处境 / 状态（一句话，具体，来自文本）
  K   — 这一节在让什么东西变得可见？（用提问句表述，如"这个场景是在问：……吗？"）

三个谓词（布尔值）：
  transformed — S0 和 S1 之间是否发生了实质性变化（不只是时间流逝）
  causal      — D 是否真正引发了 T / S1（而不只是先后发生）
  stakes      — 有什么东西处于得失关头吗（羽量级也算）

失败类型（当谓词显示结构缺失时才填，否则 null）：
  descriptive  — 场景描写有余，故事运动缺失；S0 ≈ S1
  essayistic   — 解释 / 回顾 / 分析，而不是展示一个在发生的时刻
  expository   — 背景铺垫，没有一个活的场景事件

coach_question（仅在 failure_type 非 null 时填）：
  给作者的一个苏格拉底式问题，让作者问自己。
  不是指令，不是红笔，不是评语，就是一个问题。
  - descriptive 例："这一节开头和结尾，主角的处境是否发生了具体的变化？"
  - essayistic  例："这一节里有没有一个具体的时刻是在发生的——一个动作、一句话、一个决定？"
  - expository  例："这一节里，什么事情正在发生？有谁在做什么吗？"

规则：
- 所有槽的内容来自文本本身，不发明文本里没有的事件或人物
- 槽是分析性摘要，不是对文本的改写
- 语言与散文语言保持一致（中文散文→中文输出）
- failure_type 只在确实缺失时才填；正常结构填 null
- coach_question 只在 failure_type 非 null 时填；否则 null

通过 submit_story_unit 工具输出。`;

const TOOL_NAME = "submit_story_unit";
const TOOL_DESCRIPTION =
  "Submit the structural unit analysis of this prose section.";

const INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    s0: { type: "string", description: "Initial state at the opening of this section." },
    d: { type: "string", description: "The disruption event or shift." },
    t: { type: "string", description: "The turn / protagonist response or pivot." },
    s1: { type: "string", description: "End state at the close of this section." },
    k_hint: { type: "string", description: "What this section is making visible, as a question." },
    transformed: { type: "boolean", description: "S0 and S1 differ meaningfully." },
    causal: { type: "boolean", description: "D genuinely causes T / S1." },
    stakes: { type: "boolean", description: "Something is at risk or to gain." },
    failure_type: {
      type: ["string", "null"],
      enum: ["descriptive", "essayistic", "expository", null],
      description: "Structural failure category when applicable; null otherwise.",
    },
    coach_question: {
      type: ["string", "null"],
      description: "Socratic question for the author when failure_type is non-null; null otherwise.",
    },
  },
  required: ["s0", "d", "t", "s1", "k_hint", "transformed", "causal", "stakes",
             "failure_type", "coach_question"],
};

export async function analyseStoryUnit(
  sectionContent: string,
  sectionLabel: string,
  sectionPrompt: string,
  providerId?: string,
): Promise<FocusedCallResult<StoryUnitResult>> {
  const text = [
    `章节名称：${sectionLabel}`,
    `编辑提示（这一节要回答的问题）：${sectionPrompt}`,
    ``,
    `散文文本：`,
    `<prose>`,
    sectionContent.trim(),
    `</prose>`,
  ].join("\n");

  return focusedCall<StoryUnitResult>({
    text,
    systemPrompt: SYSTEM_PROMPT,
    toolName: TOOL_NAME,
    toolDescription: TOOL_DESCRIPTION,
    inputSchema: INPUT_SCHEMA,
    providerId,
  });
}

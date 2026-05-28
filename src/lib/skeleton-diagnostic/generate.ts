import type Anthropic from "@anthropic-ai/sdk";

import { anthropicClient } from "../ai-editor/client";

const DEFAULT_MODEL = "claude-sonnet-4-6";
const STRICT_MODEL = "claude-opus-4-7";
const MAX_TOKENS = 2048;

const GENERATE_SYSTEM = `你是叙事结构 eval 套件的样本生成器。给你：
- 一篇种子 specimen + 它当前的 expectation 标注
- 一个结构变形要求（例如"把引擎改成 inevitability"、"砍掉 K 让它降级成说明"、
  "保持骨架但加 flat_subtext 失败"）

你产一篇**新 specimen**——题材应当跟种子接近（这样变量隔离干净，能精准探测
RUBRIC 的判别边界），但结构按变形要求重写。同时产一份**草案 expectation**——
你预测这篇新 specimen 应该被 RUBRIC 怎么判。

**重要原则**：
1. 不要写"AI 套话"。读起来要像真实投稿——节制、不耍花腔、不补全所有情绪。
   长度向种子靠近（±50%）。
2. 变形要"刚好"——只改要求改的那个轴，其他保持。别顺手把所有东西都升级。
3. expectation 字段要诚实：如果你写的变体在结构上是边界 case，
   confidence_band 就该宽（[0.3, 0.7]）。不要为了"看起来合理"硬给高 confidence。
4. tradition 标签要选最贴的——"中国现代" / "现代冲突" / "命运式" /
   "契诃夫式" / "中国古典笔记小说" / "网文升级流" / "zuihitsu / 随笔" /
   "极简对话+subtext" / "实验" / "草稿"。
5. purpose 字段一句话写清楚这篇变体在测什么——读 expectations.json 的人
   要能立刻看懂。
6. 通过 submit_variation 工具输出。`;

const GENERATE_TOOL: Anthropic.Tool = {
  name: "submit_variation",
  description: "Submit one new specimen + its draft expectation entry.",
  input_schema: {
    type: "object",
    properties: {
      variant_text: {
        type: "string",
        description: "新 specimen 的完整内容，首行是标题，整体长度向种子靠近 ±50%。",
      },
      proposed_expectation: {
        type: "object",
        properties: {
          is_story: { type: "boolean" },
          type: {
            type: ["string", "null"],
            enum: ["描摹", "随笔", "说明", null],
          },
          expected_engine: {
            type: ["string", "null"],
            enum: ["conflict", "recontextualize", "revelation", "inevitability", null],
          },
          confidence_band: {
            type: "array",
            items: { type: "number" },
            minItems: 2,
            maxItems: 2,
          },
          tradition: { type: "string" },
          purpose: { type: "string" },
          holdout: { type: "boolean" },
        },
        required: [
          "is_story",
          "type",
          "expected_engine",
          "confidence_band",
          "tradition",
          "purpose",
          "holdout",
        ],
      },
      design_notes: {
        type: "string",
        description: "这篇变体在结构上做了什么操作、为什么这样写——给 reviewer 看的。",
      },
    },
    required: ["variant_text", "proposed_expectation", "design_notes"],
  },
};

export interface GenerationRequest {
  seed_text: string;
  seed_expectation?: Record<string, unknown>;
  transform: string;
  strict?: boolean;
}

export interface GenerationResult {
  variant_text: string;
  proposed_expectation: {
    is_story: boolean;
    type: "描摹" | "随笔" | "说明" | null;
    expected_engine:
      | "conflict"
      | "recontextualize"
      | "revelation"
      | "inevitability"
      | null;
    confidence_band: [number, number];
    tradition: string;
    purpose: string;
    holdout: boolean;
  };
  design_notes: string;
  _meta: {
    model: string;
    duration_ms: number;
    usage: { input_tokens: number; output_tokens: number };
  };
}

export async function generateVariation(
  req: GenerationRequest,
): Promise<GenerationResult> {
  const model = req.strict ? STRICT_MODEL : DEFAULT_MODEL;
  const seedMeta = req.seed_expectation
    ? `种子当前 expectation:\n${JSON.stringify(req.seed_expectation, null, 2)}\n\n`
    : "（种子无 expectation 标注）\n\n";
  const userMsg = [
    `## 种子\n\n${req.seed_text}`,
    seedMeta,
    `## 结构变形要求\n\n${req.transform}`,
  ].join("\n\n");

  const startedAt = Date.now();
  const response = await anthropicClient().messages.create({
    model,
    max_tokens: MAX_TOKENS,
    system: GENERATE_SYSTEM,
    tools: [GENERATE_TOOL],
    tool_choice: { type: "tool", name: GENERATE_TOOL.name },
    messages: [{ role: "user", content: userMsg }],
  });

  const toolUse = response.content.find(
    (b): b is Extract<typeof b, { type: "tool_use" }> => b.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error(
      `generateVariation returned no tool_use block. stop_reason=${response.stop_reason}`,
    );
  }

  const raw = toolUse.input as Omit<GenerationResult, "_meta">;
  return {
    ...raw,
    _meta: {
      model,
      duration_ms: Date.now() - startedAt,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    },
  };
}

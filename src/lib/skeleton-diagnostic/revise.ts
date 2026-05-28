import type Anthropic from "@anthropic-ai/sdk";

import { anthropicClient } from "../ai-editor/client";
import type { DiagnosticMode } from "./types";

// Meta-analysis is high-leverage; spend more here than on per-specimen calls.
const META_MODEL = "claude-opus-4-7";
const META_MAX_TOKENS = 8192;

const REVISE_SYSTEM = `你是叙事结构诊断 RUBRIC 的提示词工程审查员。给你：
- 现行 RUBRIC
- 一批最近一次 eval 翻车的样本（文本 + 期望 + 模型实际推理）
- 一批 borderline PASS（confidence 贴近 band 边缘）作为风险锚
- 一批 healthy PASS 作为"不要破坏这些"的不动点

你的工作：定位翻车的根因，提出**外科式**的 RUBRIC 修改建议——指向具体段落，
说明改前改后，预估修改可能把哪些当前 PASS 推过边界。

**根因分类**：
- rubric_wording：措辞模糊、判定边界没说清，改 RUBRIC 文字就能修
- skeleton_model：S0/D/T/S1/K 五元 + 四引擎本身覆盖不到这类文学——
  改文字救不了，要扩骨架（或显式声明这一类 out_of_scope）
- confidence_calibration：判断对了但 confidence 偏（普遍太高 / 太低）
- expectation_wrong：标注本身有争议，eval 数据需要修正

**重要原则**：
1. 宁可缩小 RUBRIC 适用范围，也不要把它扩成"什么都能说"。明确标 out_of_scope
   比硬给低 confidence 结论好。
2. 单次修改建议 ≤ 200 字。改一处，看下一轮结果，再改一处。**不要给"重写整段"
   这种建议**——那是骨架改，不是 RUBRIC 改。
3. 任何修改都要预估副作用：如果改了某一句让 X 类样本能通过，可能让 Y 类样本
   反而过界——必须明说。

通过 propose_rubric_revisions 工具输出。`;

const REVISE_TOOL: Anthropic.Tool = {
  name: "propose_rubric_revisions",
  description: "Submit your structured rubric-revision proposal.",
  input_schema: {
    type: "object",
    properties: {
      diagnosis: {
        type: "array",
        description: "把失败聚类，每条覆盖一类失败模式。",
        items: {
          type: "object",
          properties: {
            failure_pattern: { type: "string" },
            affected_specimens: { type: "array", items: { type: "string" } },
            root_cause: {
              type: "string",
              enum: [
                "rubric_wording",
                "skeleton_model",
                "confidence_calibration",
                "expectation_wrong",
              ],
            },
            evidence: { type: "string" },
          },
          required: ["failure_pattern", "affected_specimens", "root_cause", "evidence"],
        },
      },
      proposed_edits: {
        type: "array",
        description: "外科式修改，每条 ≤ 200 字，指向 RUBRIC 中具体段落。",
        items: {
          type: "object",
          properties: {
            target_rubric: { type: "string", enum: ["RUBRIC_FULL", "RUBRIC_PARTIAL"] },
            summary: { type: "string" },
            before_snippet: {
              type: "string",
              description: "RUBRIC 中应被替换的原文片段，≤ 200 字。",
            },
            after_snippet: { type: "string", description: "替换后的文字，≤ 200 字。" },
            expected_to_fix: {
              type: "array",
              items: { type: "string" },
              description: "预计修复哪些当前失败 specimen。",
            },
            risk_of_breaking: {
              type: "array",
              items: { type: "string" },
              description: "预计可能让哪些当前 PASS 退步。",
            },
          },
          required: [
            "target_rubric",
            "summary",
            "before_snippet",
            "after_snippet",
            "expected_to_fix",
            "risk_of_breaking",
          ],
        },
      },
      skeleton_questions: {
        type: "array",
        items: { type: "string" },
        description: "需要人类决断的骨架级问题（不是 RUBRIC 改得动的）。",
      },
      overall_assessment: { type: "string" },
    },
    required: ["diagnosis", "proposed_edits", "skeleton_questions", "overall_assessment"],
  },
};

export interface CaseRecord {
  path: string;
  text?: string;
  expected: Record<string, unknown>;
  actual: Record<string, unknown>;
  failed_checks?: string[];
}

export interface RevisionRequest {
  current_rubric: string;
  rubric_name: "RUBRIC_FULL" | "RUBRIC_PARTIAL";
  mode: DiagnosticMode;
  failures: CaseRecord[];
  borderlines: CaseRecord[];
  healthy: CaseRecord[];
}

export interface RevisionProposal {
  diagnosis: Array<{
    failure_pattern: string;
    affected_specimens: string[];
    root_cause:
      | "rubric_wording"
      | "skeleton_model"
      | "confidence_calibration"
      | "expectation_wrong";
    evidence: string;
  }>;
  proposed_edits: Array<{
    target_rubric: "RUBRIC_FULL" | "RUBRIC_PARTIAL";
    summary: string;
    before_snippet: string;
    after_snippet: string;
    expected_to_fix: string[];
    risk_of_breaking: string[];
  }>;
  skeleton_questions: string[];
  overall_assessment: string;
  _meta: {
    model: string;
    duration_ms: number;
    usage: {
      input_tokens: number;
      output_tokens: number;
      cache_read_input_tokens: number;
      cache_creation_input_tokens: number;
    };
  };
}

function buildUserMessage(req: RevisionRequest): string {
  const parts: string[] = [
    `## 当前 ${req.rubric_name}\n\n${"```"}\n${req.current_rubric}\n${"```"}`,
    `## 失败样本 (${req.failures.length} 篇)`,
    ...req.failures.map((c) => JSON.stringify(c, null, 2)),
    `\n## Borderline PASS（confidence 贴近边界，${req.borderlines.length} 篇）`,
    ...req.borderlines.map((c) => JSON.stringify(c, null, 2)),
  ];
  const sampleHealthy = req.healthy.slice(0, 6);
  parts.push(
    `\n## 健康 PASS 代表 (${sampleHealthy.length} / ${req.healthy.length} 篇), 不要破坏这些`,
  );
  for (const c of sampleHealthy) {
    parts.push(
      JSON.stringify({ path: c.path, actual: c.actual, expected: c.expected }, null, 2),
    );
  }
  return parts.join("\n\n");
}

export async function proposeRubricRevisions(
  req: RevisionRequest,
): Promise<RevisionProposal> {
  const startedAt = Date.now();
  const response = await anthropicClient().messages.create({
    model: META_MODEL,
    max_tokens: META_MAX_TOKENS,
    thinking: { type: "adaptive" },
    system: REVISE_SYSTEM,
    tools: [REVISE_TOOL],
    tool_choice: { type: "tool", name: REVISE_TOOL.name },
    messages: [{ role: "user", content: buildUserMessage(req) }],
  });

  const toolUse = response.content.find(
    (b): b is Extract<typeof b, { type: "tool_use" }> => b.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error(
      `proposeRubricRevisions returned no tool_use block. stop_reason=${response.stop_reason}`,
    );
  }

  const raw = toolUse.input as Omit<RevisionProposal, "_meta">;
  return {
    ...raw,
    _meta: {
      model: META_MODEL,
      duration_ms: Date.now() - startedAt,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
        cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0,
      },
    },
  };
}

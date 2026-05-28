import type Anthropic from "@anthropic-ai/sdk";

import { AI_EDITOR_MODEL, anthropicClient } from "../ai-editor/client";
import { RUBRIC_FULL, RUBRIC_PARTIAL } from "./rubric";
import type {
  DiagnosticMode,
  FullDiagnostic,
  PartialDiagnostic,
  RawFullToolInput,
  RawPartialToolInput,
  SkeletonDiagnostic,
} from "./types";

const FULL_TOOL: Anthropic.Tool = {
  name: "submit_full_diagnostic",
  description:
    "Submit the structural diagnostic for a completed draft. Mandatory output channel for the full-draft analyser.",
  // strict: true enforces schema at the API level. Without it, sonnet
  // sometimes calls the tool with partial input (e.g. engines populated
  // but gate missing) and Anthropic lets it through — which then surfaces
  // downstream as is_story(undefined≠...) check failures.
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      title_or_first_line: { type: "string" },
      skeleton: {
        type: "object",
        properties: {
          S0: { type: "string", description: "Equilibrium / starting state" },
          D: { type: "string", description: "Disturbance" },
          T: { type: "string", description: "Trajectory" },
          S1: { type: "string", description: "New equilibrium" },
          K: { type: "string", description: "Stakes binding" },
          transformation_dimension: {
            type: "string",
            enum: ["situation", "understanding", "both"],
          },
        },
        required: ["S0", "D", "T", "S1", "K", "transformation_dimension"],
      },
      gate: {
        type: "object",
        properties: {
          transformed: gatePredicate(),
          causal: gatePredicate(),
          stakes_bound: gatePredicate(),
          is_story: { type: "boolean" },
          if_not_story_type: {
            type: ["string", "null"],
            enum: ["描摹", "随笔", "说明", null],
            description:
              "Failure type when is_story is false. Must be null when is_story is true.",
          },
          confidence: {
            type: "number",
            description: "0.0 – 1.0. Borderline cases must report low confidence.",
          },
          borderline_note: {
            type: "string",
            description: "Empty when confidence is high; otherwise explain why.",
          },
        },
        required: [
          "transformed",
          "causal",
          "stakes_bound",
          "is_story",
          "if_not_story_type",
          "confidence",
          "borderline_note",
        ],
      },
      engines: {
        type: "array",
        items: {
          type: "object",
          properties: {
            engine: {
              type: "string",
              enum: ["conflict", "recontextualize", "revelation", "inevitability"],
            },
            weight: { type: "number" },
            why: { type: "string" },
          },
          required: ["engine", "weight", "why"],
        },
        description:
          "Empty when the gate said non-story. May list multiple engines with weights.",
      },
      diagnostics: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: {
              type: "string",
              enum: ["causal_spine", "the_turn", "economy", "flat_subtext"],
            },
            finding: { type: "string" },
            severity: {
              type: "string",
              enum: ["ok", "note", "warn", "error"],
            },
          },
          required: ["id", "finding", "severity"],
        },
        description:
          "All four ids must appear when the gate said story. Empty when non-story.",
      },
      one_line_verdict: { type: "string" },
    },
    required: [
      "title_or_first_line",
      "skeleton",
      "gate",
      "engines",
      "diagnostics",
      "one_line_verdict",
    ],
  },
};

const PARTIAL_TOOL: Anthropic.Tool = {
  name: "submit_partial_diagnostic",
  description:
    "Submit the observation for an in-progress draft. Mandatory output channel for the partial-draft analyser.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      title_or_first_line: { type: "string" },
      skeleton_status: {
        type: "object",
        properties: {
          S0: axisObservation(),
          D: axisObservation(),
          T: axisObservation(),
          S1: axisObservation(),
          K: axisObservation(),
        },
        required: ["S0", "D", "T", "S1", "K"],
      },
      progress_estimate: {
        type: "number",
        description: "0.0 – 1.0. How far through the arc the draft is so far.",
      },
      tentative_engines: {
        type: "array",
        items: {
          type: "object",
          properties: {
            engine: {
              type: "string",
              enum: ["conflict", "recontextualize", "revelation", "inevitability", ""],
            },
            weight: {
              type: "number",
              description: "≤ 0.5 — these are tentative.",
            },
            why: { type: "string" },
          },
          required: ["engine", "weight", "why"],
        },
      },
      diagnostics: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string", enum: ["causal_spine", "economy"] },
            finding: { type: "string" },
            severity: {
              type: "string",
              enum: ["ok", "note", "warn", "error"],
            },
          },
          required: ["id", "finding", "severity"],
        },
      },
      next_axis_hint: {
        type: "string",
        enum: ["S0", "D", "T", "S1", "K", "none"],
        description: "Which axis should the author work on next.",
      },
      observation_summary: { type: "string" },
    },
    required: [
      "title_or_first_line",
      "skeleton_status",
      "progress_estimate",
      "tentative_engines",
      "diagnostics",
      "next_axis_hint",
      "observation_summary",
    ],
  },
};

function gatePredicate() {
  return {
    type: "object",
    properties: {
      verdict: { type: "boolean" },
      why: { type: "string" },
    },
    required: ["verdict", "why"],
  } as const;
}

function axisObservation() {
  return {
    type: "object",
    properties: {
      status: { type: "string", enum: ["present", "hinted", "not_yet"] },
      note: { type: "string" },
    },
    required: ["status", "note"],
  } as const;
}

const MAX_TOKENS = 8192;

export async function diagnoseSkeleton(
  text: string,
  mode: DiagnosticMode,
): Promise<SkeletonDiagnostic> {
  const isFull = mode === "full";
  const tool = isFull ? FULL_TOOL : PARTIAL_TOOL;
  const rubric = isFull ? RUBRIC_FULL : RUBRIC_PARTIAL;

  const startedAt = Date.now();

  const response = await anthropicClient().messages.create({
    model: AI_EDITOR_MODEL,
    max_tokens: MAX_TOKENS,
    // Cache the rubric — it's stable and large enough to benefit. Once the
    // /submit sidebar fires per-keystroke, this is what keeps cost sane.
    system: [
      {
        type: "text",
        text: rubric,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [tool],
    tool_choice: { type: "tool", name: tool.name },
    messages: [{ role: "user", content: text }],
  });

  const toolUse = response.content.find(
    (b): b is Extract<typeof b, { type: "tool_use" }> => b.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error(
      `diagnoseSkeleton returned no tool_use block. stop_reason=${response.stop_reason}`,
    );
  }

  const duration_ms = Date.now() - startedAt;
  const meta = {
    model: AI_EDITOR_MODEL,
    duration_ms,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0,
    },
  } as const;

  if (isFull) {
    const raw = toolUse.input as RawFullToolInput;
    const out: FullDiagnostic = { mode: "full", ...raw, _meta: meta };
    return out;
  } else {
    const raw = toolUse.input as RawPartialToolInput;
    const out: PartialDiagnostic = { mode: "partial", ...raw, _meta: meta };
    return out;
  }
}

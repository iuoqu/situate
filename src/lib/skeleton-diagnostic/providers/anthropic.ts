import type Anthropic from "@anthropic-ai/sdk";

import { AI_EDITOR_MODEL, anthropicClient } from "../../ai-editor/client";
import { RUBRIC_FULL, RUBRIC_PARTIAL } from "../rubric";
import type {
  DiagnosticMode,
  FullDiagnostic,
  PartialDiagnostic,
  RawFullToolInput,
  RawPartialToolInput,
  SkeletonDiagnostic,
} from "../types";
import {
  FULL_SCHEMA,
  FULL_TOOL_DESCRIPTION,
  FULL_TOOL_NAME,
  PARTIAL_SCHEMA,
  PARTIAL_TOOL_DESCRIPTION,
  PARTIAL_TOOL_NAME,
} from "./schemas";
import type { Provider } from "./types";

/**
 * Anthropic provider. Uses tool_use with strict schema enforcement, which
 * is the most reliable structured-output pathway on the Anthropic API for
 * Claude 4.x.
 */

const MAX_TOKENS = 8192;

// Schemas are declared `as const` in schemas.ts to keep nested string-literal
// info. Anthropic's InputSchema type wants mutable strings — cast through
// unknown to satisfy the structural check; the runtime shape is identical.
const FULL_TOOL: Anthropic.Tool = {
  name: FULL_TOOL_NAME,
  description: FULL_TOOL_DESCRIPTION,
  strict: true,
  input_schema: FULL_SCHEMA as unknown as Anthropic.Tool.InputSchema,
};

const PARTIAL_TOOL: Anthropic.Tool = {
  name: PARTIAL_TOOL_NAME,
  description: PARTIAL_TOOL_DESCRIPTION,
  strict: true,
  input_schema: PARTIAL_SCHEMA as unknown as Anthropic.Tool.InputSchema,
};

export function createAnthropicProvider(opts: {
  id: string;
  displayName: string;
  costNote: string;
  model: string;
}): Provider {
  const { id, displayName, costNote, model } = opts;
  return {
    id,
    displayName,
    costNote,
    available() {
      return Boolean(process.env.ANTHROPIC_API_KEY);
    },
    async diagnose(text: string, mode: DiagnosticMode): Promise<SkeletonDiagnostic> {
      const isFull = mode === "full";
      const tool = isFull ? FULL_TOOL : PARTIAL_TOOL;
      const rubric = isFull ? RUBRIC_FULL : RUBRIC_PARTIAL;

      const startedAt = Date.now();
      const response = await anthropicClient().messages.create({
        model,
        max_tokens: MAX_TOKENS,
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
          `Anthropic returned no tool_use block. stop_reason=${response.stop_reason}`,
        );
      }

      const meta = {
        model,
        duration_ms: Date.now() - startedAt,
        usage: {
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens,
          cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
          cache_creation_input_tokens:
            response.usage.cache_creation_input_tokens ?? 0,
        },
      } as const;

      if (isFull) {
        const raw = toolUse.input as RawFullToolInput;
        normalizeFull(raw);
        const out: FullDiagnostic = { mode: "full", ...raw, _meta: meta };
        return out;
      } else {
        const raw = toolUse.input as RawPartialToolInput;
        const out: PartialDiagnostic = { mode: "partial", ...raw, _meta: meta };
        return out;
      }
    },
  };
}

/**
 * Schema uses empty string as the "no failure type" sentinel (Anthropic
 * strict mode rejects null in enum). Downstream code expects null.
 */
function normalizeFull(raw: RawFullToolInput): void {
  if (raw.gate && (raw.gate.if_not_story_type as unknown as string) === "") {
    raw.gate.if_not_story_type = null;
  }
}

// The default provider — what /api/diagnose and /api/dev/diagnose-by-path
// pick when no explicit provider is requested. Same model the AI-editor
// pipeline uses.
export const DEFAULT_ANTHROPIC_PROVIDER = createAnthropicProvider({
  id: "anthropic:claude-sonnet-4-6",
  displayName: "Claude Sonnet 4.6",
  costNote: "$3 / $15 per 1M",
  model: AI_EDITOR_MODEL,
});

import { jsonrepair } from "jsonrepair";

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
 * Shared OpenAI-Chat-Completions-compatible provider. DeepSeek, Qwen
 * (DashScope compatible-mode), Moonshot, Zhipu, and OpenAI itself all
 * accept this same `/chat/completions` shape with function calling.
 *
 * We don't pull in the openai npm package — the only call we need is one
 * POST per diagnose, same precedent as src/lib/openai-client.ts uses for
 * Whisper.
 */

const MAX_TOKENS = 8192;
const TIMEOUT_MS = 60_000;

interface OpenAIToolCall {
  function?: { name?: string; arguments?: string };
}
interface OpenAIChoice {
  message?: {
    tool_calls?: OpenAIToolCall[];
    content?: string | null;
  };
  finish_reason?: string;
}
interface OpenAIResponse {
  choices?: OpenAIChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: { message?: string; type?: string };
}

export interface OpenAICompatOpts {
  id: string;
  displayName: string;
  costNote: string;
  /** Env var name holding the API key. */
  apiKeyEnv: string;
  /** Base URL without trailing slash. We append `/chat/completions`. */
  baseURL: string;
  /** Provider's model identifier. */
  model: string;
}

export function createOpenAICompatProvider(opts: OpenAICompatOpts): Provider {
  const { id, displayName, costNote, apiKeyEnv, baseURL, model } = opts;
  return {
    id,
    displayName,
    costNote,
    available() {
      return Boolean(process.env[apiKeyEnv]);
    },
    async diagnose(text: string, mode: DiagnosticMode): Promise<SkeletonDiagnostic> {
      const apiKey = process.env[apiKeyEnv];
      if (!apiKey) {
        throw new Error(
          `${apiKeyEnv} is not set on the server — cannot call ${displayName}.`,
        );
      }

      const isFull = mode === "full";
      const rubric = isFull ? RUBRIC_FULL : RUBRIC_PARTIAL;
      const toolName = isFull ? FULL_TOOL_NAME : PARTIAL_TOOL_NAME;
      const toolDescription = isFull ? FULL_TOOL_DESCRIPTION : PARTIAL_TOOL_DESCRIPTION;
      const schema = isFull ? FULL_SCHEMA : PARTIAL_SCHEMA;

      const body = {
        model,
        max_tokens: MAX_TOKENS,
        messages: [
          { role: "system", content: rubric },
          { role: "user", content: text },
        ],
        tools: [
          {
            type: "function",
            function: { name: toolName, description: toolDescription, parameters: schema },
          },
        ],
        tool_choice: { type: "function", function: { name: toolName } },
      };

      const startedAt = Date.now();
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

      let resp: Response;
      try {
        resp = await fetch(`${baseURL}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(
          `${displayName} HTTP ${resp.status}: ${errText.slice(0, 280)}`,
        );
      }

      const data = (await resp.json()) as OpenAIResponse;
      if (data.error) {
        throw new Error(`${displayName} error: ${data.error.message ?? "unknown"}`);
      }

      const choice = data.choices?.[0];
      const toolCalls = choice?.message?.tool_calls;
      const argsStr = toolCalls?.[0]?.function?.arguments;
      if (!argsStr) {
        throw new Error(
          `${displayName} returned no tool call (finish_reason=${choice?.finish_reason}).`,
        );
      }
      let raw: Record<string, unknown>;
      try {
        raw = JSON.parse(argsStr);
      } catch {
        // Layered fallback for non-OpenAI providers (DeepSeek, Qwen):
        //   1. jsonrepair  — handles mid-JSON corruption that non-OpenAI
        //      models produce a lot of: unescaped ASCII quotes inside
        //      Chinese strings (`"每个"算了"的回声"`), missing commas,
        //      stray brackets. Doesn't recover from trailing-garbage.
        //   2. extractFirstJsonObject + jsonrepair  — for trailing-
        //      garbage cases: slice at the first matching close brace,
        //      then repair what remains.
        let repaired: string | null = null;
        try {
          repaired = jsonrepair(argsStr);
          raw = JSON.parse(repaired);
        } catch {
          try {
            const sliced = extractFirstJsonObject(argsStr);
            repaired = jsonrepair(sliced);
            raw = JSON.parse(repaired);
          } catch (e3) {
            throw new Error(
              `${displayName} returned unrepairable JSON in tool call: ${
                e3 instanceof Error ? e3.message : e3
              }; tail=${argsStr.slice(-200)}`,
            );
          }
        }
      }

      const meta = {
        model,
        duration_ms: Date.now() - startedAt,
        usage: {
          input_tokens: data.usage?.prompt_tokens ?? 0,
          output_tokens: data.usage?.completion_tokens ?? 0,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
      } as const;

      if (isFull) {
        const rawFull = raw as unknown as RawFullToolInput;
        // Map "" → null for the same strict-mode reason as anthropic.ts.
        if (rawFull.gate && (rawFull.gate.if_not_story_type as unknown as string) === "") {
          rawFull.gate.if_not_story_type = null;
        }
        return { mode: "full", ...rawFull, _meta: meta };
      }
      return {
        mode: "partial",
        ...(raw as unknown as RawPartialToolInput),
        _meta: meta,
      };
    },
  };
}

/**
 * Find the leading JSON object in a string and return just that substring,
 * even if the string has trailing garbage. Counts braces honoring string
 * literals and escape sequences. Throws on no `{` or unterminated object.
 */
function extractFirstJsonObject(s: string): string {
  const start = s.indexOf("{");
  if (start < 0) throw new Error("no JSON object in response");
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === "\\") {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  throw new Error("unterminated JSON object");
}

// ─── Pre-configured providers ──────────────────────────────────────────────

/**
 * DeepSeek V3.1 — OpenAI-compatible function calling.
 * https://api.deepseek.com — env: DEEPSEEK_API_KEY.
 * ~$0.27 / $1.10 per 1M (cache miss). Strong Chinese, decent English,
 * weaker on Japanese / Korean. Schema enforcement less strict than
 * Anthropic strict tool_use — may occasionally need parse fallback.
 */
export const DEEPSEEK_PROVIDER = createOpenAICompatProvider({
  id: "deepseek:deepseek-chat",
  displayName: "DeepSeek V3.1",
  costNote: "$0.27 / $1.10 per 1M",
  apiKeyEnv: "DEEPSEEK_API_KEY",
  baseURL: "https://api.deepseek.com",
  model: "deepseek-chat",
});

/**
 * Alibaba Qwen via DashScope mainland (compatible-mode endpoint). This is
 * the right endpoint for keys minted at https://dashscope.console.aliyun.com.
 * If you have an international Aliyun account, swap baseURL to
 * https://dashscope-intl.aliyuncs.com/compatible-mode/v1 — the two are not
 * cross-authenticated (a mainland key returns 401 on intl and vice versa).
 * env: DASHSCOPE_API_KEY.
 * ~$1.6 / $6.4 per 1M for qwen-max (varies by region/release).
 */
export const QWEN_PROVIDER = createOpenAICompatProvider({
  id: "alibaba:qwen3-max",
  displayName: "Qwen3 Max",
  costNote: "$1.6 / $6.4 per 1M",
  apiKeyEnv: "DASHSCOPE_API_KEY",
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  model: "qwen-max",
});

/**
 * Qwen Plus — the cheap-tier sibling. Available as a UI option for
 * any of the diagnosers, though no longer used internally by
 * center_consensus.
 */
export const QWEN_PLUS_PROVIDER = createOpenAICompatProvider({
  id: "alibaba:qwen-plus",
  displayName: "Qwen Plus",
  costNote: "$0.08 / $0.20 per 1M",
  apiKeyEnv: "DASHSCOPE_API_KEY",
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  model: "qwen-plus",
});

/**
 * Qwen Flash — cheap text-tier model. Used as one of the two families
 * inside center_consensus (multi-sample structural robustness check).
 * Roughly 1/8 the cost of qwen-plus.
 */
export const QWEN_FLASH_PROVIDER = createOpenAICompatProvider({
  id: "alibaba:qwen-flash",
  displayName: "Qwen Flash",
  costNote: "~$0.05 / $0.20 per 1M",
  apiKeyEnv: "DASHSCOPE_API_KEY",
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  model: "qwen-flash",
});

/**
 * DeepSeek V4 Flash — the cheapest production-grade DeepSeek model
 * with strong Chinese narrative reasoning. Used as the second family
 * inside center_consensus, providing cross-family bias defense
 * against qwen-flash's sticky preferences.
 *
 * NOTE: V4 defaults to thinking mode; the center_consensus diagnoser
 * disables it via extraBody when calling.
 */
export const DEEPSEEK_V4_FLASH_PROVIDER = createOpenAICompatProvider({
  id: "deepseek:deepseek-v4-flash",
  displayName: "DeepSeek V4 Flash",
  costNote: "$0.14 / $0.28 per 1M",
  apiKeyEnv: "DEEPSEEK_API_KEY",
  baseURL: "https://api.deepseek.com",
  model: "deepseek-v4-flash",
});

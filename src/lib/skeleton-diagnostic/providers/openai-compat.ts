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
      } catch (e) {
        throw new Error(
          `${displayName} returned malformed JSON in tool call: ${e instanceof Error ? e.message : e}`,
        );
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
        return {
          mode: "full",
          ...(raw as unknown as RawFullToolInput),
          _meta: meta,
        };
      }
      return {
        mode: "partial",
        ...(raw as unknown as RawPartialToolInput),
        _meta: meta,
      };
    },
  };
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

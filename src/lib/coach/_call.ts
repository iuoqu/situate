import type Anthropic from "@anthropic-ai/sdk";
import { jsonrepair } from "jsonrepair";

import { anthropicClient } from "@/lib/ai-editor/client";
import { getProviderOrDefault } from "@/lib/skeleton-diagnostic/providers/registry";

/**
 * Generic "structured Claude call with a custom prompt + tool schema."
 *
 * The skeleton-diagnostic providers (anthropic / openai-compat) each
 * implement their own diagnose() hardcoded to the master RUBRIC + the
 * full skeleton tool. Focused diagnosers need to call those same models
 * with a SMALLER prompt and a different output schema — but reusing the
 * same auth, base URLs, retry behavior, etc.
 *
 * This helper bypasses the Provider.diagnose() shape and goes one layer
 * down to the actual API call, keyed by the provider's id.
 *
 * Why not just add a method to Provider? Avoids touching three files for
 * one new feature. When we ship the second focused diagnoser this can be
 * lifted into the Provider interface proper.
 */

const MAX_TOKENS = 1500; // focused output is small
const TIMEOUT_MS = 60_000;

export interface FocusedCallResult<T> {
  result: T;
  raw: unknown;
  meta: {
    provider_id: string;
    model: string;
    duration_ms: number;
    input_tokens: number;
    output_tokens: number;
  };
}

export interface FocusedCallOpts {
  text: string;
  systemPrompt: string;
  toolName: string;
  toolDescription: string;
  inputSchema: Record<string, unknown>;
  providerId?: string;
  /**
   * Optional author-declared intent block. When present, the user
   * message is wrapped as <intent>...</intent>\n<prose>...</prose> so
   * the diagnoser can compare prose against intent. Diagnoser system
   * prompts that want to use this should explicitly handle the
   * <intent> block.
   */
  intent?: string;
}

export async function focusedCall<T>(
  opts: FocusedCallOpts,
): Promise<FocusedCallResult<T>> {
  const provider = getProviderOrDefault(opts.providerId);
  // The provider object only exposes diagnose(). We sneak around it by
  // looking at the id and routing manually. Brittle but contained.
  if (provider.id.startsWith("anthropic:")) {
    return callAnthropic<T>(opts, provider.id);
  }
  if (provider.id.startsWith("deepseek:") || provider.id.startsWith("alibaba:")) {
    return callOpenAICompat<T>(opts, provider.id);
  }
  throw new Error(`focusedCall: unknown provider family ${provider.id}`);
}

/**
 * Compose the user message. Bare prose when no intent declared; intent
 * + prose blocks when the author has declared what they're attempting.
 */
function composeUserMessage(text: string, intent: string | undefined): string {
  const trimmedIntent = intent?.trim();
  if (!trimmedIntent) return text;
  return `<intent>\n${trimmedIntent}\n</intent>\n\n<prose>\n${text}\n</prose>`;
}

async function callAnthropic<T>(
  opts: FocusedCallOpts,
  providerId: string,
): Promise<FocusedCallResult<T>> {
  const model = providerIdToAnthropicModel(providerId);
  const tool: Anthropic.Tool = {
    name: opts.toolName,
    description: opts.toolDescription,
    input_schema: opts.inputSchema as unknown as Anthropic.Tool.InputSchema,
  };

  const startedAt = Date.now();
  const response = await anthropicClient().messages.create({
    model,
    max_tokens: MAX_TOKENS,
    system: [
      {
        type: "text",
        text: opts.systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [tool],
    tool_choice: { type: "tool", name: opts.toolName },
    messages: [
      { role: "user", content: composeUserMessage(opts.text, opts.intent) },
    ],
  });

  const toolUse = response.content.find(
    (b): b is Extract<typeof b, { type: "tool_use" }> => b.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error(
      `${providerId} returned no tool_use block. stop_reason=${response.stop_reason}`,
    );
  }
  return {
    result: toolUse.input as T,
    raw: toolUse.input,
    meta: {
      provider_id: providerId,
      model,
      duration_ms: Date.now() - startedAt,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  };
}

async function callOpenAICompat<T>(
  opts: FocusedCallOpts,
  providerId: string,
): Promise<FocusedCallResult<T>> {
  const config = providerIdToOpenAICompatConfig(providerId);
  const apiKey = process.env[config.apiKeyEnv];
  if (!apiKey) {
    throw new Error(`${providerId}: ${config.apiKeyEnv} not set`);
  }

  const body = {
    model: config.model,
    max_tokens: MAX_TOKENS,
    messages: [
      { role: "system", content: opts.systemPrompt },
      { role: "user", content: composeUserMessage(opts.text, opts.intent) },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: opts.toolName,
          description: opts.toolDescription,
          parameters: opts.inputSchema,
        },
      },
    ],
    tool_choice: { type: "function", function: { name: opts.toolName } },
  };

  const startedAt = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let resp: Response;
  try {
    resp = await fetch(`${config.baseURL}/chat/completions`, {
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
      `${providerId} HTTP ${resp.status}: ${errText.slice(0, 280)}`,
    );
  }
  const data = (await resp.json()) as {
    choices?: Array<{
      message?: { tool_calls?: Array<{ function?: { arguments?: string } }> };
      finish_reason?: string;
    }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    error?: { message?: string };
  };
  if (data.error) {
    throw new Error(`${providerId}: ${data.error.message ?? "unknown"}`);
  }
  const argsStr = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!argsStr) {
    throw new Error(
      `${providerId}: no tool call (finish_reason=${data.choices?.[0]?.finish_reason})`,
    );
  }

  // Same 3-layer JSON parser as openai-compat.ts uses for diagnoseSkeleton.
  // Non-OpenAI providers produce malformed JSON often enough that we need
  // jsonrepair as a safety net.
  let parsed: unknown;
  try {
    parsed = JSON.parse(argsStr);
  } catch {
    try {
      parsed = JSON.parse(jsonrepair(argsStr));
    } catch (e) {
      throw new Error(
        `${providerId} unrepairable JSON: ${e instanceof Error ? e.message : e}; tail=${argsStr.slice(-180)}`,
      );
    }
  }

  return {
    result: parsed as T,
    raw: parsed,
    meta: {
      provider_id: providerId,
      model: config.model,
      duration_ms: Date.now() - startedAt,
      input_tokens: data.usage?.prompt_tokens ?? 0,
      output_tokens: data.usage?.completion_tokens ?? 0,
    },
  };
}

function providerIdToAnthropicModel(id: string): string {
  // anthropic:claude-sonnet-4-6 -> claude-sonnet-4-6
  return id.split(":")[1];
}

function providerIdToOpenAICompatConfig(id: string): {
  baseURL: string;
  model: string;
  apiKeyEnv: string;
} {
  if (id === "deepseek:deepseek-chat") {
    return {
      baseURL: "https://api.deepseek.com",
      model: "deepseek-chat",
      apiKeyEnv: "DEEPSEEK_API_KEY",
    };
  }
  if (id === "alibaba:qwen3-max") {
    return {
      baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      model: "qwen-max",
      apiKeyEnv: "DASHSCOPE_API_KEY",
    };
  }
  throw new Error(`Unknown openai-compat provider: ${id}`);
}

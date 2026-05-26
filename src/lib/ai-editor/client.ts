import Anthropic from "@anthropic-ai/sdk";

/**
 * Single Anthropic client shared across all principle checkers. Cached in
 * `globalThis` across hot reloads so we don't churn TCP connections in dev.
 */
declare global {
  // eslint-disable-next-line no-var
  var __situate_anthropic__: Anthropic | undefined;
}

export function anthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Set it in .env (local) or Vercel env vars (prod).",
    );
  }
  if (!globalThis.__situate_anthropic__) {
    globalThis.__situate_anthropic__ = new Anthropic({
      // The SDK retries 429 / 5xx automatically with exponential backoff.
      maxRetries: 2,
    });
  }
  return globalThis.__situate_anthropic__;
}

// One model string in one place so swapping (to claude-opus-4-7 etc.) is a
// one-line change.
export const AI_EDITOR_MODEL = "claude-sonnet-4-6";

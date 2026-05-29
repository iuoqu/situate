import { createAnthropicProvider, DEFAULT_ANTHROPIC_PROVIDER } from "./anthropic";
import {
  DEEPSEEK_PROVIDER,
  QWEN_PLUS_PROVIDER,
  QWEN_PROVIDER,
} from "./openai-compat";
import type { Provider, ProviderInfo } from "./types";

/**
 * Single source of truth for which providers exist. Anything calling
 * diagnoseSkeleton picks a provider via `getProvider(id)`; the UI gets
 * the dropdown from `listProviders()`.
 */

const OPUS_PROVIDER = createAnthropicProvider({
  id: "anthropic:claude-opus-4-7",
  displayName: "Claude Opus 4.7",
  costNote: "$5 / $25 per 1M",
  model: "claude-opus-4-7",
});

const PROVIDERS: Provider[] = [
  DEFAULT_ANTHROPIC_PROVIDER,
  OPUS_PROVIDER,
  DEEPSEEK_PROVIDER,
  QWEN_PROVIDER,
  QWEN_PLUS_PROVIDER,
];

const BY_ID = new Map(PROVIDERS.map((p) => [p.id, p]));

export const DEFAULT_PROVIDER_ID = DEFAULT_ANTHROPIC_PROVIDER.id;

export function getProvider(id: string): Provider | null {
  return BY_ID.get(id) ?? null;
}

export function getProviderOrDefault(id?: string | null): Provider {
  if (id) {
    const p = BY_ID.get(id);
    if (p) return p;
  }
  return DEFAULT_ANTHROPIC_PROVIDER;
}

export function listProviders(): ProviderInfo[] {
  return PROVIDERS.map((p) => ({
    id: p.id,
    displayName: p.displayName,
    costNote: p.costNote,
    available: p.available(),
  }));
}

import type { DiagnosticMode, SkeletonDiagnostic } from "../types";

/**
 * One model provider. Each implementation maps the unified RUBRIC + tool
 * schema onto its own API's structured-output flavor (Anthropic tool_use,
 * OpenAI / DeepSeek / Qwen function calling, etc.) and returns a
 * SkeletonDiagnostic in the same shape regardless of backend.
 */
export interface Provider {
  /** Stable identifier used in API requests and stored alongside results. */
  id: string;
  /** Human-readable name shown in the /dev/eval UI. */
  displayName: string;
  /** Short note for the UI — typically the per-1M-token cost. */
  costNote: string;
  /** True iff the required env vars are set on this server. */
  available(): boolean;
  /** Actual call. Throws on failure; the route handler wraps it. */
  diagnose(text: string, mode: DiagnosticMode): Promise<SkeletonDiagnostic>;
}

export interface ProviderInfo {
  id: string;
  displayName: string;
  costNote: string;
  available: boolean;
}

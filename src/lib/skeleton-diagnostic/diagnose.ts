import { getProviderOrDefault } from "./providers/registry";
import type { DiagnosticMode, SkeletonDiagnostic } from "./types";

/**
 * Entry point for skeleton-diagnostic Claude calls. Dispatches to the
 * named provider (or the default Anthropic one if none given). All
 * downstream code — /api/diagnose, /api/dev/diagnose-by-path, the
 * generation + revision routes — calls this rather than touching
 * provider-specific SDKs directly.
 */
export async function diagnoseSkeleton(
  text: string,
  mode: DiagnosticMode,
  providerId?: string | null,
): Promise<SkeletonDiagnostic> {
  const provider = getProviderOrDefault(providerId);
  return provider.diagnose(text, mode);
}

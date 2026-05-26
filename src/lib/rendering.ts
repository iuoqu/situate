import {
  DEFAULT_CULTURAL_RENDERING,
  type CulturalAnnotation,
  type CulturalRendering,
} from "@/db/schema";

export type RenderingPreference = CulturalRendering;

/**
 * Apply a reader's cultural-rendering preference to a stored translation.
 * Spans in `annotations` point into the canonical `content` string;
 * substitutions are applied right-to-left so earlier spans' indices stay
 * valid. Pure function — safe in client components.
 */
export function renderTranslation(
  content: string,
  annotations: CulturalAnnotation[],
  preference: CulturalRendering = DEFAULT_CULTURAL_RENDERING,
): string {
  if (annotations.length === 0) return content;

  const sorted = [...annotations].sort((a, b) => b.spanStart - a.spanStart);
  let out = content;
  for (const ann of sorted) {
    const rendering =
      ann.renderings[preference] ?? ann.renderings[ann.defaultRendering];
    if (rendering === undefined) continue;
    out = out.slice(0, ann.spanStart) + rendering + out.slice(ann.spanEnd);
  }
  return out;
}

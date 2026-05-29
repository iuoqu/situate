/**
 * Tradition profile registry — file-based, no DB.
 *
 * Tradition profiles are *coaching lenses*, not publication gates.
 * Every submission is judged by P1–P13 on its own merits regardless of
 * which tradition the author wrote in (constitution P2 cuts both ways:
 * we do not pre-filter genres).
 *
 * What a profile decides:
 *   - which template scaffold the editor presents (sections + prompts)
 *   - whether sections can be deleted (some traditions are rigid,
 *     others — Pearls — accept 1-5 sections)
 *   - whether Section 1 must have its own coordinate at submit time
 *     (anchored traditions = yes; Pearls = no)
 *   - which diagnosers the coaching engine runs (skeleton window fills)
 *   - which story-unit types the gate looks for (skeleton window fills)
 *
 * What a profile does NOT decide:
 *   - whether a submission can become a Situate publication
 *     (that is editorial discretion, principle-driven)
 *   - whether to auto-route to Pearls (only editors do that)
 *
 * The `diagnosers` and `unitTypes` arrays are intentionally
 * skeleton-shaped (empty by default). The AI-coach skeleton window
 * fills them in lockstep with the diagnoser implementations under
 * `src/lib/coach/diagnosers/`. This module agrees on the contract
 * (text identifiers, no enum lock-in); the AI window decides what
 * the strings mean.
 */

import { FLASH_SITUATE_ANCHORED } from "./flash-situate-anchored";
import { FLASH_SITUATE_PEARLS } from "./flash-situate-pearls";

export interface TraditionSection {
  /** Stable identifier — stored as `story_drafts.sections[].section_id`. */
  id: string;
  /** Section label shown in the editor header. */
  label: string;
  /** Editorial prompt — the question the author is answering in prose. */
  prompt: string;
  /** Suggested word range; guidance only, not enforced. */
  wordRange: { min: number; max: number };
  /** True if this section can carry its own coordinate (vs inheriting
   *  from the previous section). */
  canHaveOwnLocation: boolean;
  /** True if the AI hook generator appears in this section. */
  showHookSelector?: boolean;
  /** Whether this section is required in this tradition. Authors can
   *  delete optional sections; required sections stay put. Pearls makes
   *  all sections optional except the first. */
  required?: boolean;
  /** Constitutional principles this section's prompt is designed to
   *  exercise. Editorial introspection only — never enforced at write
   *  time. */
  principleAnchors?: readonly string[];
}

export interface TraditionProfile {
  /** Stable id stored in `story_drafts.tradition_profile_id`. */
  id: string;
  /** Human-facing name (e.g. "Situate Spine — anchored"). */
  name: string;
  /** One-liner shown in selectors. */
  description: string;
  /** Whether Section 1 must have its own coordinate at submit time.
   *  Anchored traditions: true. Pearls: false (the carveout). */
  placeRequired: boolean;
  /** Hard minimum number of sections at submit time. */
  minSections: number;
  /** Hard maximum number of sections at submit time. */
  maxSections: number;
  /** Whether sections beyond the required set can be deleted from the
   *  editor. When false, the template is fixed at the listed sections. */
  allowSectionDeletion: boolean;
  /** Template scaffold the editor presents. */
  sections: readonly TraditionSection[];
  /** AI coach diagnoser ids run for this tradition. Filled by the
   *  skeleton window in lockstep with implementations under
   *  `src/lib/coach/diagnosers/`. Empty array here = no coaching yet.
   *
   *  Each string is a stable diagnoser identifier. The coaching engine
   *  resolves the string to an implementation at runtime; this file
   *  only declares which ones are *enabled* for this tradition. */
  diagnosers: readonly string[];
  /** Story-unit type identifiers the gate recognises for this
   *  tradition. Filled by the skeleton window. Used by the
   *  `story_units.unit_type` column (text, no enum lock-in). */
  unitTypes: readonly string[];
}

const ALL_PROFILES: readonly TraditionProfile[] = [
  FLASH_SITUATE_ANCHORED,
  FLASH_SITUATE_PEARLS,
];

const VISIBLE_PROFILE_IDS: ReadonlySet<string> = new Set([
  "flash_situate_anchored",
  "flash_situate_pearls",
]);

export function listVisibleTraditions(): TraditionProfile[] {
  return ALL_PROFILES.filter((p) => VISIBLE_PROFILE_IDS.has(p.id));
}

export function getTradition(id: string): TraditionProfile | null {
  return ALL_PROFILES.find((p) => p.id === id) ?? null;
}

/** Default tradition for a fresh `/write` flow when the author doesn't
 *  explicitly pick one. */
export const DEFAULT_TRADITION_ID = "flash_situate_anchored";

/** True iff the tradition exists in the registry. */
export function isKnownTradition(id: string): boolean {
  return ALL_PROFILES.some((p) => p.id === id);
}

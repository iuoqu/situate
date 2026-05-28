/**
 * Template registry — file-based, no DB.
 *
 * Year 1 ships one template (`situate-spine`). Adding a Year-2+ template
 * (`vignette`, `incident`, `encounter`, `echo`, …) means adding a file
 * here and registering it; no migration, no UI rewrite — `StoryTemplate`
 * is template-agnostic.
 *
 * The shape is intentionally small. Each section is a prompt the author
 * is asked to answer in prose, optionally with its own location and
 * optionally surfacing the AI-hook generator. Examples-from-library are
 * not modelled here yet — editors will curate those into a separate
 * `template_examples` table at a later milestone.
 */

import { SITUATE_SPINE } from "./situate-spine";

export interface TemplateSection {
  /** Stable identifier — keep across template revisions. Used as the
   *  `section_id` in `story_drafts.sections[]`. */
  id: string;
  /** Short label, shown in the section header (e.g. "Arrival"). */
  label: string;
  /** The actual prompt the author sees in the editor. Multi-line OK. */
  prompt: string;
  /** Suggested word range; rendered as guidance, not enforced. */
  wordRange: { min: number; max: number };
  /** When true, this section can have its own coordinate (overriding the
   *  inherit-from-previous default). Set on the section where the
   *  narrative actually moves. */
  canHaveOwnLocation: boolean;
  /** When true, the AI hook selector appears at the top of this section.
   *  Typically Section 1 only. */
  showHookSelector?: boolean;
  /** Constitutional principles this section's prompt is designed to
   *  exercise. Editorial introspection signal, not enforced at write
   *  time — but kept here so changes to the constitution can audit
   *  template alignment. */
  principleAnchors: readonly string[];
}

export interface StoryTemplate {
  /** Stable id stored in `story_drafts.template_id`. */
  id: string;
  /** Human-facing name (e.g. "Situate Spine"). */
  name: string;
  /** One-liner used in EntryChoice and selector UIs. */
  description: string;
  /** The author's chosen language hint; passed to AI helpers for
   *  language-of-prose alignment. */
  defaultLanguage?: string;
  sections: readonly TemplateSection[];
}

const ALL_TEMPLATES: readonly StoryTemplate[] = [SITUATE_SPINE];

/** Templates exposed in the Year-1 free-tier UI. Subset of ALL_TEMPLATES.
 *  Future templates can ship as drafts (hidden) before being exposed. */
const YEAR_1_TEMPLATE_IDS: ReadonlySet<string> = new Set(["situate-spine"]);

export function listVisibleTemplates(): StoryTemplate[] {
  return ALL_TEMPLATES.filter((t) => YEAR_1_TEMPLATE_IDS.has(t.id));
}

export function getTemplate(id: string): StoryTemplate | null {
  return ALL_TEMPLATES.find((t) => t.id === id) ?? null;
}

export const DEFAULT_TEMPLATE_ID = "situate-spine";

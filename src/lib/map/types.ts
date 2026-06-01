/**
 * situate.map — shared types.
 *
 * The map module implements the architecture layer of the methodology
 * (§7): Socratic angle questions → synthesis algorithm → center named
 * by the writer.
 */

// ─── Angle questions ────────────────────────────────────────────────────────

export type AngleId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface AngleQuestion {
  angle_id: AngleId;
  angle_name: string;
  /** Instantiated in the language of the material, using names/details
   *  from the material. Never suggests a center. Plain spoken register. */
  question: string;
  /** A short lead-in that helps the writer start writing — a concrete
   *  entry point or a half-sentence to continue. Never suggests an
   *  answer; UI scaffolding only, not sent to synthesis. */
  opener: string;
}

export interface QuestionsResult {
  questions: AngleQuestion[]; // 5–6 items
  /** Internal note on why these angles were selected. Not shown to the
   *  writer — used in dev/preview only. */
  selection_note: string;
}

// ─── Synthesis ──────────────────────────────────────────────────────────────

export interface AnsweredQuestion {
  angle_id: number;
  angle_name: string;
  question: string;
  answer: string;
}

export interface ExtractedPhrase {
  angle_id: number;
  /** 1–3 key phrases from the writer's own answer. Verbatim or
   *  near-verbatim; never AI-invented. */
  phrases: string[];
}

export type SynthesisBranch =
  | "convergent"       // recurring phrases point to one thing
  | "higher_abstraction" // phrases scatter across people sharing one system/place
  | "divergent";       // no genuine convergence

export interface SynthesisResult {
  extracted_phrases: ExtractedPhrase[];
  branch: SynthesisBranch;
  /** Phrases that recur semantically across answers (empty for divergent). */
  recurring: string[];
  /** For higher_abstraction only: the shared system/place named in the
   *  writer's own phrases. Never AI-invented. */
  shared_frame: string | null;
  /** Writer-facing message. Matches branch template from §7. */
  message: string;
}

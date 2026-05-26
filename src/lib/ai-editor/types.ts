import type {
  AiUsageLabel,
  AuthorRelationship,
  ConsentStatus,
  PrincipleVerdict,
  StoryType,
  SupportedLanguage,
} from "@/db/schema";

import type { EditorialPriorityReport } from "./triage/engagement-score";

/**
 * Submission shape passed to each principle checker. This is the
 * "judgment-facing view" — fields the AI editor needs to evaluate one
 * principle. Built by the adapter in `adapter.ts` from the live DB rows.
 *
 * The shape mirrors situate-judgment-v0's `Submission` type so its
 * principle checkers port over with minimal changes.
 */
export interface JudgmentSubmission {
  meta: {
    submission_id: string;
    title: string | null;
    abstract: string | null;
    word_count: number | null;
    language: SupportedLanguage;
    author_id: string;
    author_pen_name: string | null;
  };

  // Multi-coordinate version of F1. v0 had a single coordinate; we pass the
  // route through the field as `places[]`. The relocation_test answer
  // describes the whole route ("why these places, in this order?").
  field1_route: {
    places: { latitude: number; longitude: number; ordinal: number }[];
    relocation_test: string | null;
  };

  field2_affinity: {
    relationship: AuthorRelationship | null;
    duration: string | null;
    affiliations: string[];
  };

  field3_story_type: StoryType | null;

  field4_real_people: {
    has_real_people: boolean;
    consent_status: ConsentStatus | null;
    consent_explanation: string | null;
  };

  field5_ai: {
    label: AiUsageLabel | null;
    notes: string | null;
  };

  field6_risks: {
    warnings: string[];
    explanation: string | null;
    satire: boolean;
  };

  // Full story text in narrative order. One entry per narrative_block, in the
  // submission's source language.
  story_blocks: string[];
}

// What every principle checker outputs. Mirrors v0's PrincipleJudgment with
// the addition of token-usage telemetry, so each row in `principle_judgments`
// records what it cost.
export interface PrincipleJudgment {
  principle: string;        // "P3"
  version: string;          // "v0.1"
  status: PrincipleVerdict; // "PASS" | "FAIL" | "UNCERTAIN"
  confidence: number;       // 0.0 – 1.0
  reasoning: string;
  key_quote: string;
  human_review_needed: boolean;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens: number;
    cache_creation_input_tokens: number;
  };
}

export type RoutingDecision = "AUTO_REJECT" | "HUMAN_REVIEW" | "PASS_TO_EDITOR";

export interface SubmissionReport {
  submission_id: string;
  judgments: PrincipleJudgment[];
  /**
   * Editor-side triage signal. Null when the triage call failed (API
   * unreachable, model error). Never affects routing — pure queue-sort
   * input for the human editor.
   */
  triage: EditorialPriorityReport | null;
  routing: RoutingDecision;
  routing_reason: string;
  cited_principles: string[]; // e.g. ["P3:v0.1"] — used in moderation_decisions
}

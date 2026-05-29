import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  geometry,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ─── Enums ──────────────────────────────────────────────────────────────────

// Added in 0011. Pearls (遗珠) is the editor-routed carveout for
// work whose merit is independent of geographic anchoring (Hemingway
// "Hills Like White Elephants" type pieces, or any submission from any
// tradition that doesn't satisfy P3 but otherwise passes). Authors do
// not self-route — only editors flip a piece to 'pearls'.
export const publicationSection = pgEnum("publication_section", [
  "main",
  "pearls",
]);

export const submissionStatus = pgEnum("status", [
  "draft",
  "ai_review",
  "human_review",
  "published",
  // Added in 0010: post-review tiered states + lifecycle terminal states.
  // Legacy `published` is kept so existing rows don't break, but new
  // editorial flow uses the tiered variants (L1/L2/L3) below.
  "revisions_requested",
  "accepted_pending_publish",
  "published_l1",
  "published_l2",
  "published_l3",
  "withdrawn",
]);

export const editionStatus = pgEnum("edition_status", [
  "planning", // editors curating, contents open
  "scheduled", // contents locked, awaiting publish_at
  "published", // live to readers
  "archived", // historical issue (still readable)
]);

// Phase-1 launch languages. Adding a value later is a single
// `ALTER TYPE ... ADD VALUE` migration; renaming or removing is destructive.
export const supportedLanguage = pgEnum("supported_language", [
  "en",
  "zh_CN",
  "zh_TW",
  "ja",
  "ko",
]);

export const translationMethod = pgEnum("translation_method", [
  "original",
  "ai",
  "ai_post_edited",
  "human",
]);

export const translationStatus = pgEnum("translation_status", [
  "draft",
  "ai_generated",
  "in_review",
  "published",
]);

// Pricing/gating tier for a translation row.
//   free    — open access (original text, raw AI)
//   metered — free but rate-limited per reader (AI + light human pass)
//   premium — paywalled (full human polish)
export const translationAccessTier = pgEnum("translation_access_tier", [
  "free",
  "metered",
  "premium",
]);

export const moderationLayer = pgEnum("moderation_layer", [
  "ai",
  "human",
  "legal",
]);

export const moderationDecision = pgEnum("moderation_decision", [
  "approve",
  "reject",
  "request_changes",
  "flag_for_legal",
]);

export const reportCategory = pgEnum("report_category", [
  "defamation",
  "hate_speech",
  "factual_error",
  "copyright",
  "harassment",
  "other",
]);

export const reportStatus = pgEnum("report_status", [
  "open",
  "in_review",
  "resolved",
  "dismissed",
]);

// Per the voice-to-fiction onboarding pipeline. Drafts move through this
// state machine before becoming a `submissions` row at handoff time.
export const draftStage = pgEnum("draft_stage", [
  "recording", // voice path: user is actively dictating
  "transcribed", // voice path: have a transcript, no prose yet
  "structured", // either path: prose draft exists
  "editing", // user is editing paragraphs / sections (default for template path)
  "disclosure", // DisclosureChat in progress
  "ready", // ready to submit
  "submitted", // handed off to a submission row; editor flow takes over
  "trashed", // soft-deleted; recoverable from /my Trash tab
]);

// ─── Submission form enums (per the public submission spec) ─────────────────

export const storyType = pgEnum("story_type", [
  "fiction",
  "based_on_reality",
]);

export const authorRelationship = pgEnum("author_relationship", [
  "born_there",
  "lived_there",
  "worked_there",
  "researched",
  "passing_through",
  "never_been",
]);

export const consentStatus = pgEnum("consent_status", [
  "not_applicable",
  "explicit",
  "deceased",
  "public_figure",
  "transformed",
  "no_consent",
]);

export const aiUsageLabel = pgEnum("ai_usage_label", [
  "human_written",
  "human_written_ai_translated",
  "ai_assisted",
  "ai_created",
]);

// ─── AI editor enums ────────────────────────────────────────────────────────

export const principleVerdict = pgEnum("principle_verdict", [
  "PASS",
  "FAIL",
  "UNCERTAIN",
]);

// ─── JSON shapes ────────────────────────────────────────────────────────────

export type CulturalAnnotationKind =
  | "idiom"
  | "proverb"
  | "honorific"
  | "wordplay"
  | "name"
  | "cultural_ref";

export type CulturalRendering = "literal" | "transposed" | "explained";

// Platform-wide default rendering for unauthenticated / no-preference readers.
export const DEFAULT_CULTURAL_RENDERING: CulturalRendering = "literal";

export interface CulturalAnnotation {
  spanStart: number;
  spanEnd: number;
  kind: CulturalAnnotationKind;
  source: string;
  renderings: Partial<Record<CulturalRendering, string>>;
  defaultRendering: CulturalRendering;
  note?: string;
}

// Author-declared moderation hints. Populated at submission time and used
// by the AI-review layer to seed entity-level checks.
export interface ContentFlags {
  realPlaces: string[];
  realPersons: string[];
  realOrgs: string[];
  conflictZone: boolean;
  notes?: string;
}

export interface FlaggedEntity {
  kind: string;
  value: string;
  sentiment?: number;
  span?: [number, number];
}

// ─── Tables ─────────────────────────────────────────────────────────────────

// An issue of the magazine. New Yorker model: every published piece belongs
// to one numbered issue with a cover, an editor's letter, and a release date.
// Pieces with `editionId = NULL` are "evergreen" / long-tail content not
// bound to a particular issue.
export const editions = pgTable(
  "editions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: serial("number").notNull(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    theme: text("theme"),
    // Nullable so editors can draft an edition before these are ready, but
    // the CHECK constraint below forbids transitioning past 'planning'
    // until all three are filled in.
    editorsLetter: text("editors_letter"),
    coverImageUrl: text("cover_image_url"),
    publishAt: timestamp("publish_at", { withTimezone: true }),
    status: editionStatus("status").notNull().default("planning"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    slugIdx: uniqueIndex("editions_slug_idx").on(t.slug),
    numberIdx: uniqueIndex("editions_number_idx").on(t.number),
    publishAtIdx: index("editions_publish_at_idx").on(t.publishAt),
    statusIdx: index("editions_status_idx").on(t.status),
    publishReadyCheck: check(
      "editions_publish_ready",
      sql`${t.status} IN ('planning', 'archived')
        OR (
          ${t.editorsLetter} IS NOT NULL
          AND ${t.coverImageUrl} IS NOT NULL
          AND ${t.publishAt} IS NOT NULL
        )`,
    ),
  }),
);

export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorId: text("author_id").notNull(),
    title: text("title"),
    abstract: text("abstract"),
    sourceLanguage: supportedLanguage("source_language")
      .notNull()
      .default("en"),
    status: submissionStatus("status").notNull().default("draft"),

    // Issue assignment. NULL = evergreen / not bound to an issue.
    editionId: uuid("edition_id").references(() => editions.id, {
      onDelete: "set null",
    }),
    positionInEdition: integer("position_in_edition"),

    // Moderation hints surfaced by the author at submission time.
    contentFlags: jsonb("content_flags")
      .$type<ContentFlags>()
      .notNull()
      .default(
        sql`'{"realPlaces":[],"realPersons":[],"realOrgs":[],"conflictZone":false}'::jsonb`,
      ),
    // Author's claimed relationship to the places in the piece
    // (e.g. "born:Zhengzhou", "lived:Tokyo:2015-2019", "research:Seoul").
    // Used by the "Zhengren-mai-lv three-condition" review heuristic.
    authorAffiliations: text("author_affiliations")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    satireDisclosure: boolean("satire_disclosure").notNull().default(false),
    sensitivityWarnings: text("sensitivity_warnings")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),

    // ─── Submission form fields (v1.0 spec) ───
    // The raw form payload — audit trail + editor-view source of truth.
    submissionForm: jsonb("submission_form"),
    wordCount: integer("word_count"),
    authorEmail: text("author_email"),
    authorPenName: text("author_pen_name"),
    legalAttestation: boolean("legal_attestation").notNull().default(false),
    // F1.b — "why these places, in this order?" (multi-coordinate version
    // of the original relocation test).
    relocationTest: text("relocation_test"),
    // F3 — fiction vs based_on_reality.
    storyType: storyType("story_type"),
    // F2 — author's relationship to the place(s).
    authorRelationship: authorRelationship("author_relationship"),
    relationshipDuration: text("relationship_duration"),
    // F2 — P4 confidentiality carveout. When affinityConfidential is true,
    // we display a redacted note in place of the relationship/duration and
    // hold the disclosure in confidence.
    affinityConfidential: boolean("affinity_confidential")
      .notNull()
      .default(false),
    affinityConfidentialReason: text("affinity_confidential_reason"),
    // F4 — real-person consent (only meaningful when storyType='based_on_reality').
    consentStatus: consentStatus("consent_status"),
    consentExplanation: text("consent_explanation"),
    // F5 — author-side AI usage (translator-side AI is on block_translations).
    aiUsageLabel: aiUsageLabel("ai_usage_label"),
    aiNotes: text("ai_notes"),
    // F6 — author-disclosed harm risks (free text alongside sensitivityWarnings).
    risksExplanation: text("risks_explanation"),
    // Set by the AI editor when it finishes the pipeline.
    aiReviewedAt: timestamp("ai_reviewed_at", { withTimezone: true }),

    // Editor-side triage (constitution v0.2 carveout — back-end only).
    // editorialPriorityScore is a 0-100 sort signal used by editors to
    // prioritize the queue. It is never shown to authors, never used as a
    // routing gate, and audited monthly for bias against non-English / non-
    // Western / experimental work. See docs/ai-editor-triage-rationale.md.
    editorialPriorityScore: integer("editorial_priority_score"),
    editorialPriorityPayload: jsonb("editorial_priority_payload"),
    editorialPriorityModel: text("editorial_priority_model"),
    editorialPriorityEvaluatedAt: timestamp(
      "editorial_priority_evaluated_at",
      { withTimezone: true },
    ),

    // Back-link to the story_drafts row this submission was created from.
    // NULL for legacy /submit-form submissions that pre-date the
    // template-write path. The reverse direction (draft_id on the draft
    // pointing here) is intentionally not modelled — querying
    // submissions filtered by draft_id is rare enough that the FK alone
    // is sufficient.
    draftId: uuid("draft_id"),
    // Clean Supabase auth FK for the dashboard's "Submitted" /
    // "Published" tabs. Backfilled from author_email at migration time;
    // new rows set this directly from the signed-in user. NULL allowed
    // for legacy rows whose email didn't match an auth.users entry.
    authorUserId: uuid("author_user_id"),
    // Added in 0011. 'main' = the place-anchored Situate publication
    // (P3 enforced). 'pearls' = editor-routed carveout for work whose
    // merit is independent of geographic anchoring. Defaults to 'main';
    // only editors flip it.
    publicationSection: publicationSection("publication_section")
      .notNull()
      .default("main"),
    // Added in 0011. L1/L2/L3 tier; only meaningful when status is
    // published_l1/l2/l3 (or, for the future Pearls section, accepted
    // into a Pearls tier). Nullable for in-flight + legacy published
    // rows.
    publicationTier: smallint("publication_tier"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    editionIdx: index("submissions_edition_id_idx").on(t.editionId),
    // Position only makes sense when the submission is actually in an issue.
    positionRequiresEdition: check(
      "submissions_position_requires_edition",
      sql`${t.editionId} IS NULL OR ${t.positionInEdition} IS NOT NULL`,
    ),
    // Within an issue, positions must be unique. (Partial unique index so
    // evergreen submissions with NULL/NULL aren't constrained.)
    uniqPositionInEdition: uniqueIndex("submissions_edition_position_idx")
      .on(t.editionId, t.positionInEdition)
      .where(sql`${t.editionId} IS NOT NULL`),
  }),
);

export const narrativeBlocks = pgTable(
  "narrative_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    eventDate: timestamp("event_date", { withTimezone: true }),
    location: geometry("location", {
      type: "point",
      mode: "xy",
      srid: 4326,
    }),
    sequenceNumber: serial("sequence_number").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    locationGistIdx: index("narrative_blocks_location_gist_idx").using(
      "gist",
      t.location,
    ),
    submissionIdx: index("narrative_blocks_submission_id_idx").on(
      t.submissionId,
    ),
  }),
);

export const blockTranslations = pgTable(
  "block_translations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blockId: uuid("block_id")
      .notNull()
      .references(() => narrativeBlocks.id, { onDelete: "cascade" }),
    language: supportedLanguage("language").notNull(),
    method: translationMethod("method").notNull(),
    status: translationStatus("status").notNull().default("draft"),
    content: text("content").notNull(),
    annotations: jsonb("annotations")
      .$type<CulturalAnnotation[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    translatorId: text("translator_id"),
    accessTier: translationAccessTier("access_tier").notNull().default("free"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    uniqByBlockLangMethod: uniqueIndex(
      "block_translations_block_lang_method_idx",
    ).on(t.blockId, t.language, t.method),
    blockLangIdx: index("block_translations_block_lang_idx").on(
      t.blockId,
      t.language,
    ),
  }),
);

// Audit log of every moderation decision (AI scan, human editor, legal/ops).
// One submission accumulates many rows over its lifecycle.
export const moderationDecisions = pgTable(
  "moderation_decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    layer: moderationLayer("layer").notNull(),
    reviewerId: text("reviewer_id"), // null when layer = 'ai'
    decision: moderationDecision("decision").notNull(),
    rationale: text("rationale"),
    flaggedEntities: jsonb("flagged_entities")
      .$type<FlaggedEntity[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    // Snapshot of which editorial-constitution principles were cited
    // in this decision, e.g. ["P2:v0.1", "P7:v0.1"]. Code+version is
    // stored verbatim so the audit log survives later principle edits.
    citedPrinciples: text("cited_principles")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    submissionIdx: index("moderation_decisions_submission_id_idx").on(
      t.submissionId,
    ),
    layerIdx: index("moderation_decisions_layer_idx").on(t.layer),
  }),
);

// The public "Editorial Constitution." Each principle has a code (P1, P2,
// ...) and a version (v0.1, v0.2, ...). Old versions are kept so audit
// trails remain intact when the constitution evolves; supersededBy points
// at the row that replaced this version.
export interface PrincipleExample {
  kind: "accepted" | "declined";
  text: string;
}

export const editorialPrinciples = pgTable(
  "editorial_principles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    version: text("version").notNull(),
    titleI18n: jsonb("title_i18n")
      .$type<Partial<Record<SupportedLanguage, string>>>()
      .notNull(),
    bodyI18n: jsonb("body_i18n")
      .$type<Partial<Record<SupportedLanguage, string>>>()
      .notNull(),
    examples: jsonb("examples")
      .$type<PrincipleExample[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    effectiveAt: timestamp("effective_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    supersededBy: uuid("superseded_by"),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    codeVersionIdx: uniqueIndex("editorial_principles_code_version_idx").on(
      t.code,
      t.version,
    ),
    activeIdx: index("editorial_principles_active_idx")
      .on(t.code)
      .where(sql`${t.supersededBy} IS NULL`),
  }),
);

// Reader-submitted reports. `locale` is BCP-47 so legal/ops can route by
// jurisdiction (NetzDG 24h SLA for de-*, droit de réponse for fr-*).
export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    reporterId: text("reporter_id"), // nullable for anonymous
    category: reportCategory("category").notNull(),
    body: text("body"),
    locale: text("locale").notNull(),
    status: reportStatus("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolverId: text("resolver_id"),
  },
  (t) => ({
    submissionIdx: index("reports_submission_id_idx").on(t.submissionId),
    statusIdx: index("reports_status_idx").on(t.status),
    localeIdx: index("reports_locale_idx").on(t.locale),
  }),
);

// One row per (submission, principle) AI-editor verdict. Each principle is a
// separate Claude API call (independent context, independent reasoning), so
// each judgment is logged independently. The aggregate routing decision
// (PASS_TO_EDITOR / HUMAN_REVIEW / AUTO_REJECT) is written separately to
// `moderation_decisions` with `layer='ai'`.
export const principleJudgments = pgTable(
  "principle_judgments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    principleCode: text("principle_code").notNull(),    // "P3"
    principleVersion: text("principle_version").notNull(), // "v0.1"
    verdict: principleVerdict("verdict").notNull(),
    confidence: real("confidence").notNull(),           // 0.0 – 1.0
    reasoning: text("reasoning").notNull(),
    keyQuote: text("key_quote").notNull(),
    humanReviewNeeded: boolean("human_review_needed").notNull(),
    model: text("model").notNull(),                     // "claude-sonnet-4-6"
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    cacheReadInputTokens: integer("cache_read_input_tokens"),
    cacheCreationInputTokens: integer("cache_creation_input_tokens"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    submissionIdx: index("principle_judgments_submission_id_idx").on(
      t.submissionId,
    ),
    principleIdx: index("principle_judgments_principle_code_idx").on(
      t.principleCode,
    ),
  }),
);

// ─── Invite codes (closed-signup gate) ──────────────────────────────────────
//
// Supabase is configured with "Allow new users to sign up" OFF. The only
// path for a new email → Supabase user is `/api/auth/invite`, which validates
// a code against this table then calls `supabase.auth.admin.inviteUserByEmail`
// using the service-role key. Codes are NOT email-bound — any holder of the
// string can redeem, up to `maxUses` redemptions. See
// `drizzle/0006_invite_codes.sql` for the canonical schema.
export const inviteCodes = pgTable(
  "invite_codes",
  {
    code: text("code").primaryKey(),
    note: text("note"),
    maxUses: integer("max_uses").notNull().default(1),
    usesCount: integer("uses_count").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  () => ({
    maxUsesPositive: check(
      "invite_codes_max_uses_positive",
      sql`"max_uses" >= 1`,
    ),
    usesCountNonneg: check(
      "invite_codes_uses_count_nonneg",
      sql`"uses_count" >= 0`,
    ),
    usesWithinMax: check(
      "invite_codes_uses_within_max",
      sql`"uses_count" <= "max_uses"`,
    ),
  }),
);

export const inviteCodeUses = pgTable(
  "invite_code_uses",
  {
    id: serial("id").primaryKey(),
    code: text("code")
      .notNull()
      .references(() => inviteCodes.code, { onDelete: "cascade" }),
    email: text("email").notNull(),
    usedAt: timestamp("used_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    codeIdx: index("invite_code_uses_code_idx").on(t.code),
    codeEmailUq: uniqueIndex("invite_code_uses_code_email_uq").on(
      t.code,
      t.email,
    ),
  }),
);

// Landing-page "request an invite" form drops rows here. An admin reviews
// the queue, issues a code via `npm run invite:issue`, and emails it.
// Closed-beta deliberately: no auto-issuance.
// ─── Story drafts (private per-author working state) ──────────────────────
//
// Both the Voice path (record → AI structure) and the Template path
// (5-section guided flow) land here. Submission handoff (/api/drafts/[id]
// /submit) copies fields into `submissions` + `narrative_blocks` and
// triggers the AI editor pipeline.
//
// RLS is enabled on the table itself (see drizzle/0009_story_drafts.sql);
// our backend uses the postgres-js pool with service-role credentials, so
// the policies are defence-in-depth. App-level checks in /api/drafts/*
// are the real enforcement.
export const storyDrafts = pgTable(
  "story_drafts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(), // references auth.users(id); not a Drizzle FK because auth schema lives outside ours.
    templateId: text("template_id"), // NULL = voice-freeform / no template
    // Added in 0011. File-based tradition registry id
    // (`src/lib/traditions/registry.ts`). Coaching lens, not a
    // publication gate — every submission is judged by P1–P13 regardless.
    // Default reproduces the Year-1 Situate Spine behaviour.
    traditionProfileId: text("tradition_profile_id")
      .notNull()
      .default("flash_situate_anchored"),
    sections: jsonb("sections").notNull().default(sql`'[]'::jsonb`),
    voiceTranscript: text("voice_transcript"),
    recordingDurationSec: integer("recording_duration_sec"),
    currentText: text("current_text"),
    editHistory: jsonb("edit_history").notNull().default(sql`'[]'::jsonb`),
    disclosureChat: jsonb("disclosure_chat").notNull().default(sql`'[]'::jsonb`),
    disclosures: jsonb("disclosures").notNull().default(sql`'{}'::jsonb`),
    language: supportedLanguage("language").notNull().default("en"),
    title: text("title"),
    stage: draftStage("stage").notNull().default("editing"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    userIdx: index("story_drafts_user_id_idx").on(t.userId),
    userUpdatedIdx: index("story_drafts_user_updated_idx").on(
      t.userId,
      t.updatedAt,
    ),
  }),
);

export const waitlistRequests = pgTable(
  "waitlist_requests",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    note: text("note"),
    source: text("source"),
    // 'write_invite' = high-intent author requests (manual triage,
    // admin issues an invite code in response). 'newsletter' = soft
    // signup, just wants stories in their inbox.
    kind: text("kind").notNull().default("write_invite"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    invitedAt: timestamp("invited_at", { withTimezone: true }),
    invitedCode: text("invited_code").references(() => inviteCodes.code, {
      onDelete: "set null",
    }),
  },
  (t) => ({
    createdAtIdx: index("waitlist_created_at_idx").on(t.createdAt),
    kindValid: check(
      "waitlist_kind_valid",
      sql`${t.kind} IN ('write_invite', 'newsletter')`,
    ),
  }),
);

// ─── Inferred types ─────────────────────────────────────────────────────────

export type Edition = typeof editions.$inferSelect;
export type NewEdition = typeof editions.$inferInsert;
export type Submission = typeof submissions.$inferSelect;
export type NewSubmission = typeof submissions.$inferInsert;
export type NarrativeBlock = typeof narrativeBlocks.$inferSelect;
export type NewNarrativeBlock = typeof narrativeBlocks.$inferInsert;
export type BlockTranslation = typeof blockTranslations.$inferSelect;
export type NewBlockTranslation = typeof blockTranslations.$inferInsert;
export type ModerationDecisionRow = typeof moderationDecisions.$inferSelect;
export type NewModerationDecisionRow = typeof moderationDecisions.$inferInsert;
export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
export type EditorialPrinciple = typeof editorialPrinciples.$inferSelect;
export type NewEditorialPrinciple = typeof editorialPrinciples.$inferInsert;
export type PrincipleJudgmentRow = typeof principleJudgments.$inferSelect;
export type NewPrincipleJudgmentRow = typeof principleJudgments.$inferInsert;
export type InviteCode = typeof inviteCodes.$inferSelect;
export type NewInviteCode = typeof inviteCodes.$inferInsert;
export type InviteCodeUse = typeof inviteCodeUses.$inferSelect;
export type NewInviteCodeUse = typeof inviteCodeUses.$inferInsert;
export type WaitlistRequest = typeof waitlistRequests.$inferSelect;
export type NewWaitlistRequest = typeof waitlistRequests.$inferInsert;
export type StoryDraft = typeof storyDrafts.$inferSelect;
export type NewStoryDraft = typeof storyDrafts.$inferInsert;
export type DraftStage = (typeof draftStage.enumValues)[number];

// Shape of each entry in `story_drafts.sections` jsonb. Keep in lockstep
// with the template registry's section definitions and with the migration
// header comment in drizzle/0009_story_drafts.sql.
export interface DraftSection {
  index: number;
  section_id: string;
  content: string;
  longitude?: number | null;
  latitude?: number | null;
  place_description?: string | null;
  section_metadata?: Record<string, unknown>;
}

export type StoryType = (typeof storyType.enumValues)[number];
export type AuthorRelationship = (typeof authorRelationship.enumValues)[number];
export type ConsentStatus = (typeof consentStatus.enumValues)[number];
export type AiUsageLabel = (typeof aiUsageLabel.enumValues)[number];
export type PrincipleVerdict = (typeof principleVerdict.enumValues)[number];

export type SubmissionStatus = (typeof submissionStatus.enumValues)[number];
export type PublicationSection = (typeof publicationSection.enumValues)[number];
export type EditionStatus = (typeof editionStatus.enumValues)[number];
export type SupportedLanguage = (typeof supportedLanguage.enumValues)[number];
export type TranslationMethod = (typeof translationMethod.enumValues)[number];
export type TranslationStatus = (typeof translationStatus.enumValues)[number];
export type TranslationAccessTier =
  (typeof translationAccessTier.enumValues)[number];
export type ModerationLayer = (typeof moderationLayer.enumValues)[number];
export type ModerationDecisionValue =
  (typeof moderationDecision.enumValues)[number];
export type ReportCategory = (typeof reportCategory.enumValues)[number];
export type ReportStatus = (typeof reportStatus.enumValues)[number];

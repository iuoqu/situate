import { sql } from "drizzle-orm";
import {
  boolean,
  geometry,
  index,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ─── Enums ──────────────────────────────────────────────────────────────────

export const submissionStatus = pgEnum("status", [
  "draft",
  "ai_review",
  "human_review",
  "published",
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

export const submissions = pgTable("submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  authorId: text("author_id").notNull(),
  title: text("title"),
  abstract: text("abstract"),
  sourceLanguage: supportedLanguage("source_language").notNull().default("en"),
  status: submissionStatus("status").notNull().default("draft"),

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

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

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

// ─── Inferred types ─────────────────────────────────────────────────────────

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

export type SubmissionStatus = (typeof submissionStatus.enumValues)[number];
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

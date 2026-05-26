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

export const submissionStatus = pgEnum("status", [
  "draft",
  "ai_review",
  "human_review",
  "published",
]);

export const supportedLanguage = pgEnum("supported_language", [
  "en",
  "zh",
  "ja",
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

export const submissions = pgTable("submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  authorId: text("author_id").notNull(),
  title: text("title"),
  abstract: text("abstract"),
  sourceLanguage: supportedLanguage("source_language").notNull().default("en"),
  status: submissionStatus("status").notNull().default("draft"),
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

export type CulturalAnnotationKind =
  | "idiom"
  | "proverb"
  | "honorific"
  | "wordplay"
  | "name"
  | "cultural_ref";

export type CulturalRendering = "literal" | "transposed" | "explained";

// One choice-point in a translation. Spans address the canonical
// `content` string (which is rendered using `defaultRendering`); switching
// renderings means substituting `renderings[preference]` into that span.
export interface CulturalAnnotation {
  spanStart: number;
  spanEnd: number;
  kind: CulturalAnnotationKind;
  source: string;
  renderings: Partial<Record<CulturalRendering, string>>;
  defaultRendering: CulturalRendering;
  note?: string;
}

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
    isPremium: boolean("is_premium").notNull().default(false),
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

export type Submission = typeof submissions.$inferSelect;
export type NewSubmission = typeof submissions.$inferInsert;
export type NarrativeBlock = typeof narrativeBlocks.$inferSelect;
export type NewNarrativeBlock = typeof narrativeBlocks.$inferInsert;
export type BlockTranslation = typeof blockTranslations.$inferSelect;
export type NewBlockTranslation = typeof blockTranslations.$inferInsert;
export type SubmissionStatus = (typeof submissionStatus.enumValues)[number];
export type SupportedLanguage = (typeof supportedLanguage.enumValues)[number];
export type TranslationMethod = (typeof translationMethod.enumValues)[number];
export type TranslationStatus = (typeof translationStatus.enumValues)[number];

import { sql } from "drizzle-orm";
import {
  geometry,
  index,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const submissionStatus = pgEnum("status", [
  "draft",
  "ai_review",
  "human_review",
  "published",
]);

export const submissions = pgTable("submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  authorId: text("author_id").notNull(),
  title: text("title"),
  abstract: text("abstract"),
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
    content: text("content"),
    sequenceNumber: serial("sequence_number").notNull(),
  },
  (table) => ({
    locationGistIdx: index("narrative_blocks_location_gist_idx").using(
      "gist",
      table.location,
    ),
    submissionIdx: index("narrative_blocks_submission_id_idx").on(
      table.submissionId,
    ),
  }),
);

export type Submission = typeof submissions.$inferSelect;
export type NewSubmission = typeof submissions.$inferInsert;
export type NarrativeBlock = typeof narrativeBlocks.$inferSelect;
export type NewNarrativeBlock = typeof narrativeBlocks.$inferInsert;
export type SubmissionStatus = (typeof submissionStatus.enumValues)[number];

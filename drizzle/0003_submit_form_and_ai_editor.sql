-- ════════════════════════════════════════════════════════════════════════════
-- 0003 — submission form spec v1.0 + AI editor pipeline
-- ════════════════════════════════════════════════════════════════════════════
--
-- Adds the columns the public /submit form needs on `submissions`, plus the
-- `principle_judgments` table where the AI editor logs one row per
-- principle per submission. Idempotent — safe to re-run.
--
-- How to use on Supabase:
--   Dashboard → SQL Editor → paste this file → Run
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. New enums ──────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "public"."story_type" AS ENUM ('fiction', 'based_on_reality');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."author_relationship" AS ENUM (
    'born_there', 'lived_there', 'worked_there',
    'researched', 'passing_through', 'never_been'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."consent_status" AS ENUM (
    'not_applicable', 'explicit', 'deceased',
    'public_figure', 'transformed', 'no_consent'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."ai_usage_label" AS ENUM (
    'human_written', 'human_written_ai_translated',
    'ai_assisted', 'ai_created'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."principle_verdict" AS ENUM ('PASS', 'FAIL', 'UNCERTAIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 2. New columns on `submissions` ───────────────────────────────────────

ALTER TABLE "submissions"
  ADD COLUMN IF NOT EXISTS "submission_form" jsonb,
  ADD COLUMN IF NOT EXISTS "word_count" integer,
  ADD COLUMN IF NOT EXISTS "author_email" text,
  ADD COLUMN IF NOT EXISTS "author_pen_name" text,
  ADD COLUMN IF NOT EXISTS "legal_attestation" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "relocation_test" text,
  ADD COLUMN IF NOT EXISTS "story_type" "story_type",
  ADD COLUMN IF NOT EXISTS "author_relationship" "author_relationship",
  ADD COLUMN IF NOT EXISTS "relationship_duration" text,
  ADD COLUMN IF NOT EXISTS "consent_status" "consent_status",
  ADD COLUMN IF NOT EXISTS "consent_explanation" text,
  ADD COLUMN IF NOT EXISTS "ai_usage_label" "ai_usage_label",
  ADD COLUMN IF NOT EXISTS "ai_notes" text,
  ADD COLUMN IF NOT EXISTS "risks_explanation" text,
  ADD COLUMN IF NOT EXISTS "ai_reviewed_at" timestamp with time zone;

-- ─── 3. New table: `principle_judgments` ───────────────────────────────────

CREATE TABLE IF NOT EXISTS "principle_judgments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "submission_id" uuid NOT NULL REFERENCES "submissions"("id") ON DELETE CASCADE,
  "principle_code" text NOT NULL,
  "principle_version" text NOT NULL,
  "verdict" "principle_verdict" NOT NULL,
  "confidence" real NOT NULL,
  "reasoning" text NOT NULL,
  "key_quote" text NOT NULL,
  "human_review_needed" boolean NOT NULL,
  "model" text NOT NULL,
  "input_tokens" integer,
  "output_tokens" integer,
  "cache_read_input_tokens" integer,
  "cache_creation_input_tokens" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "principle_judgments_submission_id_idx"
  ON "principle_judgments" ("submission_id");
CREATE INDEX IF NOT EXISTS "principle_judgments_principle_code_idx"
  ON "principle_judgments" ("principle_code");

-- ─── 4. Verification ───────────────────────────────────────────────────────

SELECT
  (SELECT count(*)::int FROM information_schema.columns
     WHERE table_name = 'submissions' AND column_name = 'submission_form') AS has_submission_form,
  (SELECT count(*)::int FROM information_schema.columns
     WHERE table_name = 'submissions' AND column_name = 'ai_reviewed_at') AS has_ai_reviewed_at,
  (SELECT count(*)::int FROM information_schema.tables
     WHERE table_name = 'principle_judgments') AS has_principle_judgments,
  (SELECT count(*)::int FROM pg_type WHERE typname = 'principle_verdict') AS has_verdict_enum;

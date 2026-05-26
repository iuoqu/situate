-- ════════════════════════════════════════════════════════════════════════════
-- 0005 — editorial priority score (engagement triage)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Adds the editor-side triage columns to `submissions`. The score is a
-- back-end-only sort signal — it is never displayed to authors and is
-- not used as a routing gate. See docs/ai-editor-triage-rationale.md for
-- the design rationale and the bias-monitoring commitment.
--
-- How to apply on Supabase:
--   Dashboard → SQL Editor → paste this file → Run.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE "submissions"
  ADD COLUMN IF NOT EXISTS "editorial_priority_score" integer,
  ADD COLUMN IF NOT EXISTS "editorial_priority_payload" jsonb,
  ADD COLUMN IF NOT EXISTS "editorial_priority_model" text,
  ADD COLUMN IF NOT EXISTS "editorial_priority_evaluated_at" timestamp with time zone;

-- Score must be in [0, 100] when present.
ALTER TABLE "submissions"
  DROP CONSTRAINT IF EXISTS "submissions_priority_score_range";
ALTER TABLE "submissions"
  ADD CONSTRAINT "submissions_priority_score_range"
  CHECK (editorial_priority_score IS NULL
         OR (editorial_priority_score >= 0 AND editorial_priority_score <= 100));

-- An index on score for the `/admin/queue` "sort by priority" view.
CREATE INDEX IF NOT EXISTS "submissions_editorial_priority_score_idx"
  ON "submissions" ("editorial_priority_score" DESC NULLS LAST);

-- Verification
SELECT
  (SELECT count(*)::int FROM information_schema.columns
     WHERE table_name = 'submissions'
       AND column_name = 'editorial_priority_score') AS has_score,
  (SELECT count(*)::int FROM information_schema.columns
     WHERE table_name = 'submissions'
       AND column_name = 'editorial_priority_payload') AS has_payload,
  (SELECT count(*)::int FROM information_schema.columns
     WHERE table_name = 'submissions'
       AND column_name = 'editorial_priority_evaluated_at') AS has_evaluated_at;

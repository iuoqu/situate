-- ════════════════════════════════════════════════════════════════════════════
-- 0004 — P4 confidentiality fields (constitution v0.2)
-- ════════════════════════════════════════════════════════════════════════════
--
-- v0.2 of the editorial constitution introduces a confidentiality carveout
-- on P4 (Author Affinity, Disclosed) so authors whose disclosure itself
-- could endanger them can opt out of public affinity attribution. This
-- migration adds the two columns the F2 form needs to capture that
-- election. Idempotent — safe to re-run.
--
-- How to apply on Supabase:
--   Dashboard → SQL Editor → paste this file → Run.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE "submissions"
  ADD COLUMN IF NOT EXISTS "affinity_confidential" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "affinity_confidential_reason" text;

-- Verification
SELECT
  (SELECT count(*)::int FROM information_schema.columns
     WHERE table_name = 'submissions'
       AND column_name = 'affinity_confidential') AS has_affinity_confidential,
  (SELECT count(*)::int FROM information_schema.columns
     WHERE table_name = 'submissions'
       AND column_name = 'affinity_confidential_reason') AS has_reason;

-- ════════════════════════════════════════════════════════════════════════════
-- 0010 — draft ↔ submission lifecycle
-- ════════════════════════════════════════════════════════════════════════════
--
-- One foundational change that lets the template-write path hand off to
-- the editorial pipeline:
--
--   1. story_drafts.stage gains `submitted` and `trashed`.
--   2. submissions.status gains the post-review tiered states
--      (revisions_requested, accepted_pending_publish, published_l1/2/3,
--      withdrawn).
--   3. submissions.draft_id — back-link to the draft a submission came
--      from. Nullable: legacy submissions from /submit have no draft;
--      revisions_requested → editing handoff also clears it.
--   4. submissions.author_user_id — clean FK to auth.users so the
--      author dashboard's "Submitted" + "Published" tabs can JOIN
--      reliably (author_email mismatches happen when users change their
--      email upstream of Supabase).
--
-- Apply on Supabase: SQL Editor → paste → Run.
-- ════════════════════════════════════════════════════════════════════════════

-- ── draft_stage: add submitted, trashed ────────────────────────────────────
ALTER TYPE "draft_stage" ADD VALUE IF NOT EXISTS 'submitted';
ALTER TYPE "draft_stage" ADD VALUE IF NOT EXISTS 'trashed';

-- ── status (submission enum): add tiered & lifecycle terminal states ───────
ALTER TYPE "status" ADD VALUE IF NOT EXISTS 'revisions_requested';
ALTER TYPE "status" ADD VALUE IF NOT EXISTS 'accepted_pending_publish';
ALTER TYPE "status" ADD VALUE IF NOT EXISTS 'published_l1';
ALTER TYPE "status" ADD VALUE IF NOT EXISTS 'published_l2';
ALTER TYPE "status" ADD VALUE IF NOT EXISTS 'published_l3';
ALTER TYPE "status" ADD VALUE IF NOT EXISTS 'withdrawn';

-- ── submissions: link back to draft + clean author FK ──────────────────────
ALTER TABLE "submissions"
  ADD COLUMN IF NOT EXISTS "draft_id" uuid
    REFERENCES "story_drafts"("id") ON DELETE SET NULL;

ALTER TABLE "submissions"
  ADD COLUMN IF NOT EXISTS "author_user_id" uuid
    REFERENCES auth."users"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "submissions_draft_id_idx"
  ON "submissions" ("draft_id");

CREATE INDEX IF NOT EXISTS "submissions_author_user_id_idx"
  ON "submissions" ("author_user_id");

-- ── Backfill author_user_id from author_email where possible ───────────────
-- Best-effort: emails that match an auth.users row get linked. Existing
-- rows with no email match stay NULL — the dashboard then falls back to
-- author_email matching for them.
UPDATE "submissions" s
SET "author_user_id" = u."id"
FROM auth."users" u
WHERE s."author_email" IS NOT NULL
  AND lower(s."author_email") = lower(u."email")
  AND s."author_user_id" IS NULL;

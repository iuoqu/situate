-- ════════════════════════════════════════════════════════════════════════════
-- 0008 — waitlist kinds (write-invite vs newsletter)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Adds a `kind` column to `waitlist_requests` so the same table can hold
-- two distinct intents:
--
--   - 'write_invite' (default, existing rows) — "I want to write for you;
--     please send me an invite code." High intent, low volume, manually
--     triaged.
--
--   - 'newsletter' — "Just email me a story now and then." Low commitment,
--     higher volume, no manual triage (we may auto-issue once the digest
--     pipeline exists).
--
-- Kept on one table because both are unauthenticated email captures with
-- the same operational ergonomics; splitting would duplicate the unique
-- index, the spam logic, and the queue triage UI.
--
-- How to apply on Supabase:
--   Dashboard → SQL Editor → paste this file → Run.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE "waitlist_requests"
  ADD COLUMN IF NOT EXISTS "kind" text NOT NULL DEFAULT 'write_invite';

ALTER TABLE "waitlist_requests"
  DROP CONSTRAINT IF EXISTS "waitlist_kind_valid";
ALTER TABLE "waitlist_requests"
  ADD CONSTRAINT "waitlist_kind_valid"
  CHECK ("kind" IN ('write_invite', 'newsletter'));

-- The case-insensitive uniqueness on email was created without a kind
-- dimension. The user is allowed to be on BOTH lists (e.g. newsletter
-- now, write-invite later), so we replace the unique index with one
-- that scopes per-kind.
DROP INDEX IF EXISTS "waitlist_email_uq";
CREATE UNIQUE INDEX IF NOT EXISTS "waitlist_email_kind_uq"
  ON "waitlist_requests" (lower("email"), "kind");

-- The uninvited-queue partial index also wants kind awareness — only
-- write_invite rows go through the manual triage flow.
DROP INDEX IF EXISTS "waitlist_uninvited_idx";
CREATE INDEX IF NOT EXISTS "waitlist_write_invite_pending_idx"
  ON "waitlist_requests" ("created_at" DESC)
  WHERE "invited_at" IS NULL AND "kind" = 'write_invite';

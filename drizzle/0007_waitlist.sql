-- ════════════════════════════════════════════════════════════════════════════
-- 0007 — waitlist for invite requests
-- ════════════════════════════════════════════════════════════════════════════
--
-- Closed-beta companion to `invite_codes`. The landing-page "Request an
-- invite" form drops rows here; an admin reviews them and, if approved,
-- runs `npm run invite:issue -- --note 'name@domain'` and emails the code.
--
-- Deliberately NOT auto-issuing codes from form submissions: closed-beta
-- means a human-curated supply pipeline. If demand spikes we can flip to
-- auto-approve later.
--
-- How to apply on Supabase:
--   Dashboard → SQL Editor → paste this file → Run.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "waitlist_requests" (
  "id" serial PRIMARY KEY,
  "email" text NOT NULL,
  "note" text,                                              -- "tell us about a place" — optional
  "source" text,                                            -- referrer, utm tag, or "landing"
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "invited_at" timestamptz,                                 -- set when an invite code is issued
  "invited_code" text REFERENCES "invite_codes"("code") ON DELETE SET NULL
);

-- Case-insensitive uniqueness on email — duplicates are user error and
-- should silently succeed (idempotent landing-page submission).
CREATE UNIQUE INDEX IF NOT EXISTS "waitlist_email_uq"
  ON "waitlist_requests" (lower("email"));

CREATE INDEX IF NOT EXISTS "waitlist_created_at_idx"
  ON "waitlist_requests" ("created_at" DESC);

-- Sort the unprocessed queue first when triaging.
CREATE INDEX IF NOT EXISTS "waitlist_uninvited_idx"
  ON "waitlist_requests" ("created_at" DESC)
  WHERE "invited_at" IS NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- 0006 — invite codes (closed-signup gate)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Closed-signup mode: Supabase "Allow new users to sign up" is OFF, so the
-- anon key cannot create users. The only path for a new email to become a
-- Supabase user is through our server-side `/api/auth/invite` route, which
-- validates an invite code against this table and then calls Supabase's
-- admin API to send a one-time invite email (service role key).
--
-- Codes are NOT bound to email — a code is usable by anyone who has the
-- string, up to `max_uses` total redemptions. This supports both
-- single-recipient invites (max_uses=1) and group invites
-- (max_uses=20, e.g. "lit_hub_readers_jan").
--
-- Existing-user logins (`signInWithOtp`) do not touch this table — a user
-- who already exists in `auth.users` can request a magic link without a
-- code. Codes are strictly a signup gate.
--
-- How to apply on Supabase:
--   Dashboard → SQL Editor → paste this file → Run.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "invite_codes" (
  "code" text PRIMARY KEY,
  "note" text,                                              -- private note: "michael at granta", "lithub jan batch"
  "max_uses" integer NOT NULL DEFAULT 1,
  "uses_count" integer NOT NULL DEFAULT 0,
  "expires_at" timestamptz,                                 -- NULL = never expires
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "invite_codes_max_uses_positive" CHECK ("max_uses" >= 1),
  CONSTRAINT "invite_codes_uses_count_nonneg" CHECK ("uses_count" >= 0),
  CONSTRAINT "invite_codes_uses_within_max" CHECK ("uses_count" <= "max_uses")
);

CREATE TABLE IF NOT EXISTS "invite_code_uses" (
  "id" serial PRIMARY KEY,
  "code" text NOT NULL REFERENCES "invite_codes"("code") ON DELETE CASCADE,
  "email" text NOT NULL,
  "used_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "invite_code_uses_code_idx"
  ON "invite_code_uses" ("code");

-- Optional: an idempotency guard. If the same email tries to redeem the
-- same code twice (e.g. they hit the invite endpoint twice and Supabase
-- generated two invite emails) we'd rather not double-burn the code.
CREATE UNIQUE INDEX IF NOT EXISTS "invite_code_uses_code_email_uq"
  ON "invite_code_uses" ("code", "email");

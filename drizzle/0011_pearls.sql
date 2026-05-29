-- ════════════════════════════════════════════════════════════════════════════
-- 0011 — Pearls section + tradition profile + publication tier
-- ════════════════════════════════════════════════════════════════════════════
--
-- Three additions, all backwards-compatible (every old row gets a safe
-- default at migration time):
--
--   1. submissions.publication_section enum('main', 'pearls')
--      Default 'main'. Editor-only field; authors don't self-route to
--      Pearls. Pearls bypass P3 (place-generativity) but every other
--      principle still applies.
--
--   2. submissions.publication_tier smallint (1..3, nullable)
--      L1/L2/L3 tier — only meaningful once status is published_l*.
--      Backfilled from status enum at migration time so existing
--      published rows have a consistent tier.
--
--   3. story_drafts.tradition_profile_id text
--      File-based tradition registry. Default 'flash_situate_anchored'
--      reproduces the Year-1 Situate Spine behaviour.
--
-- The tradition_profile is a *coaching lens*, not a publication gate.
-- Every submission is judged by P1–P13 on its own merits regardless of
-- which tradition the author wrote in.
-- ════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE "publication_section" AS ENUM ('main', 'pearls');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "submissions"
  ADD COLUMN IF NOT EXISTS "publication_section" "publication_section"
    NOT NULL DEFAULT 'main';

ALTER TABLE "submissions"
  ADD COLUMN IF NOT EXISTS "publication_tier" smallint
    CHECK ("publication_tier" IS NULL
           OR ("publication_tier" >= 1 AND "publication_tier" <= 3));

CREATE INDEX IF NOT EXISTS "submissions_publication_section_idx"
  ON "submissions" ("publication_section");

CREATE INDEX IF NOT EXISTS "submissions_publication_tier_idx"
  ON "submissions" ("publication_tier")
  WHERE "publication_tier" IS NOT NULL;

-- Backfill publication_tier from existing status enum.
-- 0010 added `published_l1/l2/l3` as enum values; this carries that
-- info forward into the new numeric column.
UPDATE "submissions"
SET "publication_tier" = 1
WHERE "status" = 'published_l1' AND "publication_tier" IS NULL;

UPDATE "submissions"
SET "publication_tier" = 2
WHERE "status" = 'published_l2' AND "publication_tier" IS NULL;

UPDATE "submissions"
SET "publication_tier" = 3
WHERE "status" = 'published_l3' AND "publication_tier" IS NULL;

-- Legacy 'published' (pre-tier) rows: leave NULL. Editors can backfill
-- by hand if they want to retro-tier old work.

ALTER TABLE "story_drafts"
  ADD COLUMN IF NOT EXISTS "tradition_profile_id" text
    NOT NULL DEFAULT 'flash_situate_anchored';

CREATE INDEX IF NOT EXISTS "story_drafts_tradition_profile_id_idx"
  ON "story_drafts" ("tradition_profile_id");

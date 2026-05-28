-- ════════════════════════════════════════════════════════════════════════════
-- 0009 — story_drafts (private per-author draft state)
-- ════════════════════════════════════════════════════════════════════════════
--
-- The shared spine for the AI-assisted writing pipeline. Both the voice
-- path (record → AI structure) and the template path (5-section guided
-- flow) land in this table. Submission handoff (Week 5) copies fields
-- across into `submissions` + `narrative_blocks` and triggers the AI
-- editor.
--
-- Sections shape (sections jsonb):
--   [
--     {
--       "index": 0,
--       "section_id": "arrival",
--       "content": "...",
--       "longitude": 103.85, "latitude": 1.29,
--       "place_description": "the kopitiam at 4am",
--       "section_metadata": {"hook_picked": "..."}
--     },
--     ...
--   ]
--
-- When longitude/latitude are NULL on a section, that section inherits
-- the previous section's coordinate at render/submit time.
--
-- How to apply on Supabase:
--   Dashboard → SQL Editor → paste this file → Run.
-- ════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE "draft_stage" AS ENUM (
    'recording',
    'transcribed',
    'structured',
    'editing',
    'disclosure',
    'ready'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "story_drafts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Owner. References auth.users(id). Service-role queries bypass RLS;
  -- app-level checks in /api/drafts/* enforce this too.
  "user_id" uuid NOT NULL REFERENCES auth.users("id") ON DELETE CASCADE,

  -- Template-driven path (Week 1.5). NULL = voice-freeform / no template.
  "template_id" text,

  -- Per-section content. See header comment for shape.
  "sections" jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Voice-path inputs (populated for Speak-it drafts).
  "voice_transcript" text,
  "recording_duration_sec" integer,

  -- Structured prose produced by /api/structure-draft (voice path) OR
  -- assembled from sections[] (template path). The unified editable
  -- artifact.
  "current_text" text,

  -- Edit history for paragraph co-edit (Week 3). Append-only.
  "edit_history" jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- DisclosureChat (Week 4) intermediate state + resolved disclosures.
  "disclosure_chat" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "disclosures" jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Author's preferred publication language for this draft.
  "language" "supported_language" NOT NULL DEFAULT 'en',

  -- Working title (carries through to submissions.title at handoff).
  "title" text,

  "stage" "draft_stage" NOT NULL DEFAULT 'editing',

  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "story_drafts_user_id_idx"
  ON "story_drafts" ("user_id");

CREATE INDEX IF NOT EXISTS "story_drafts_user_updated_idx"
  ON "story_drafts" ("user_id", "updated_at" DESC);

-- ── RLS ─────────────────────────────────────────────────────────────────────
--
-- Drafts are private. Service-role connections (our Drizzle pool) bypass
-- these policies, so app-level checks in /api/drafts/* are the real
-- enforcement. The policies are defence-in-depth: anyone hitting the
-- table via the anon key directly is blocked. They also make a future
-- migration to JWT-aware queries trivial (just stop using service role).

ALTER TABLE "story_drafts" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "story_drafts_select_own" ON "story_drafts";
CREATE POLICY "story_drafts_select_own" ON "story_drafts"
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "story_drafts_insert_own" ON "story_drafts";
CREATE POLICY "story_drafts_insert_own" ON "story_drafts"
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "story_drafts_update_own" ON "story_drafts";
CREATE POLICY "story_drafts_update_own" ON "story_drafts"
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "story_drafts_delete_own" ON "story_drafts";
CREATE POLICY "story_drafts_delete_own" ON "story_drafts"
  FOR DELETE USING (auth.uid() = user_id);

-- Touch `updated_at` on every UPDATE so the dashboard can sort by
-- "recently edited" without the client having to remember to bump it.
CREATE OR REPLACE FUNCTION "set_updated_at"()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "story_drafts_updated_at" ON "story_drafts";
CREATE TRIGGER "story_drafts_updated_at"
  BEFORE UPDATE ON "story_drafts"
  FOR EACH ROW
  EXECUTE FUNCTION "set_updated_at"();

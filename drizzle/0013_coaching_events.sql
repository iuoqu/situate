-- ════════════════════════════════════════════════════════════════════════════
-- 0013 — coaching_events shell
-- ════════════════════════════════════════════════════════════════════════════
--
-- Append-only log of diagnostic-engine activity. Built as a shell:
-- the table shape is fixed here, but all `*_type` / `diagnoser` /
-- `scale` columns are TEXT (no enum lock-in). The skeleton-window
-- owns the actual value space; this migration just guarantees there's
-- a sink for events from day one of the coaching engine (B.5).
--
-- Apply on Supabase: SQL Editor → paste → Run.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "coaching_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "draft_id" uuid NOT NULL REFERENCES "story_drafts"("id") ON DELETE CASCADE,
  -- Which section the diagnosis was about, if scoped. NULL = whole-draft.
  "section_id" text,
  -- The tradition under which this event was emitted. Recorded so that
  -- if the draft's tradition changes, old events stay attributable.
  "tradition_profile_id" text NOT NULL,
  -- Stable identifier for the diagnostic that fired. Lives in
  -- src/lib/coach/diagnosers/<id>.ts under skeleton-window control.
  -- TEXT (no enum), validated at insert by the registry.
  "diagnoser" text NOT NULL,
  -- Open value: skeleton-window decides what scales exist
  -- ("mechanical" / "structural" / "textural" / "scene" / "novel").
  "scale" text NOT NULL,
  -- 0-100 indicative; the engine's "highest leverage now" sort key.
  "severity_score" smallint
    CHECK ("severity_score" IS NULL OR ("severity_score" >= 0 AND "severity_score" <= 100)),
  -- The diagnostic's raw output (its description of what it saw).
  "observation" text,
  -- The Socratic-question form the coach surfaced (if surfaced).
  "socratic_question" text,
  -- True iff this was the one event the coach surfaced to the author
  -- in its "highest leverage right now" pick. Most events stay
  -- unsurfaced; they still get logged for the growth-stats engine.
  "surfaced_to_author" boolean NOT NULL DEFAULT false,
  -- What the author did. Open value:
  -- "acknowledged" / "revised" / "dismissed" / "ignored" / NULL (no
  -- reaction yet). Skeleton-window can refine.
  "author_response" text,
  "author_responded_at" timestamptz,
  -- Free-form jsonb payload from the diagnoser — anchor span, evidence
  -- references, etc. Diagnoser-specific shape, validated at usage by
  -- the engine.
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "coaching_events_draft_id_idx"
  ON "coaching_events" ("draft_id");

CREATE INDEX IF NOT EXISTS "coaching_events_draft_surfaced_idx"
  ON "coaching_events" ("draft_id", "surfaced_to_author", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "coaching_events_diagnoser_idx"
  ON "coaching_events" ("diagnoser");

-- RLS: events are private to the draft's owner.

ALTER TABLE "coaching_events" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coaching_events_owner_all" ON "coaching_events";
CREATE POLICY "coaching_events_owner_all" ON "coaching_events"
  USING (
    EXISTS (
      SELECT 1 FROM "story_drafts" d
      WHERE d."id" = "coaching_events"."draft_id"
        AND d."user_id" = auth.uid()
    )
  );

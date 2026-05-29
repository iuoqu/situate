-- ════════════════════════════════════════════════════════════════════════════
-- 0012 — Story Bible data layer
-- ════════════════════════════════════════════════════════════════════════════
--
-- Six new tables, all RLS-protected, all FK'd to story_drafts.id (bible
-- travels with the draft; submission handoff snapshots the bible into
-- submissions.submission_form jsonb).
--
-- Split into two layers by stability:
--
--   STABLE (skeleton-window will not change these):
--     - entities                  — anything with a name/referent
--     - entity_name_renderings    — per-language entity name variants
--     - relationships             — pairwise links between entities
--
--   METHOD-PLUGGABLE (skeleton-window owns the `*_type` value space;
--                     this migration only fixes the shape):
--     - story_units               — gate annotations (S0/D/T/S1/K-style)
--     - postures                  — author/character stance on a subject
--     - elisions                  — source-language omissions that
--                                   target languages must surface
--     - coaching_events           — diagnostic-engine event log (B.5)
--
-- The `*_type` columns are TEXT (not Postgres enum) on purpose: the
-- tradition registry under src/lib/traditions/ owns the canonical
-- value list, which evolves per-tradition without a migration. The
-- AI-coach skeleton window fills the actual identifiers used (e.g.
-- "kishōtenketsu/ki" for unit_type, "guarded/anguished" for posture
-- value), and the application validates at insert time rather than at
-- column-level. This is the parallel-window contract.
--
-- Apply on Supabase: SQL Editor → paste → Run.
-- ════════════════════════════════════════════════════════════════════════════

-- ── entities ───────────────────────────────────────────────────────────────
--
-- Anything with a name or stable referent. Persons, places, objects,
-- organisations, concepts. The same author can have the same name in
-- two drafts — entities are draft-scoped.

CREATE TABLE IF NOT EXISTS "entities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "draft_id" uuid NOT NULL REFERENCES "story_drafts"("id") ON DELETE CASCADE,
  -- What the author calls this entity in source language (their working
  -- name). Translation renderings live in `entity_name_renderings`.
  "canonical_name" text NOT NULL,
  -- Open value space; tradition registry suggests common values
  -- ("person" / "place" / "organisation" / "object" / "concept") but
  -- a tradition may add ("ancestor" / "spirit" / "household" / …).
  "entity_type" text NOT NULL,
  -- Other surface forms of the same entity in this draft (e.g. "Wang"
  -- and "老王" as aliases of one person). Text[] for simplicity; the
  -- canonical name is the lookup key, aliases are display variants.
  "aliases" text[] NOT NULL DEFAULT ARRAY[]::text[],
  -- Stable attributes affecting translation register (gender, age band,
  -- social role, relationship-to-narrator). Open shape; tradition
  -- registry suggests keys but doesn't enforce.
  "attributes" jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- P5 disclosure surface: when the entity is a real living person,
  -- consent_status is required at submit time. These default to NULL
  -- meaning "not yet declared / N/A"; the disclosure pass (Milestone
  -- B.3) prompts the author to fill them.
  "is_real_person" boolean,
  "consent_status" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "entities_draft_id_idx"
  ON "entities" ("draft_id");

CREATE INDEX IF NOT EXISTS "entities_draft_type_idx"
  ON "entities" ("draft_id", "entity_type");

-- ── entity_name_renderings ─────────────────────────────────────────────────
--
-- Per-language rendering of an entity name. Multiple rows per entity
-- (one per target language). The author or AI fills `literal` +
-- `transposed`; `register_default` is the resolver's hint when a
-- relationship doesn't override.
--
-- This is the table the translation engine (B.6) reads from to avoid
-- free-text-translating proper names.

CREATE TABLE IF NOT EXISTS "entity_name_renderings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entity_id" uuid NOT NULL REFERENCES "entities"("id") ON DELETE CASCADE,
  -- Uses the existing supported_language enum from earlier migrations.
  "language" "supported_language" NOT NULL,
  -- Literal romanisation / transliteration. E.g. for 老王 → "Lao Wang"
  -- in en, "Ro Ō" in ja.
  "literal" text,
  -- Localised / "transposed" rendering. E.g. for 老王 → "Old Wang" or
  -- "Mr. Wang" or just "Wang" in en depending on register.
  "transposed" text,
  -- The translation engine's default register hint when no relationship
  -- override applies. Open shape (jsonb), tradition registry suggests
  -- common keys like { "politeness": "polite", "form": "surname_first" }.
  "register_default" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "entity_name_renderings_uniq_lang"
  ON "entity_name_renderings" ("entity_id", "language");

CREATE INDEX IF NOT EXISTS "entity_name_renderings_entity_id_idx"
  ON "entity_name_renderings" ("entity_id");

-- ── relationships ──────────────────────────────────────────────────────────
--
-- Directed pairwise link between two entities. Drives translation
-- register resolution: "narrator → mentor" relationships affect how
-- the mentor is addressed/described in each language. The translator
-- (AI or human) reads from here when picking forms of address,
-- honorifics, pronouns.

CREATE TABLE IF NOT EXISTS "relationships" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "draft_id" uuid NOT NULL REFERENCES "story_drafts"("id") ON DELETE CASCADE,
  "entity_a" uuid NOT NULL REFERENCES "entities"("id") ON DELETE CASCADE,
  "entity_b" uuid NOT NULL REFERENCES "entities"("id") ON DELETE CASCADE,
  -- Open value space; tradition registry suggests common values
  -- ("mentor_of" / "child_of" / "spouse_of" / "rival_of" / …). The
  -- application validates at insert time, not at column level.
  "kind" text NOT NULL,
  -- Per-language overrides of register defaults. Shape mirrors
  -- entity_name_renderings.register_default; this row's overrides win
  -- when they exist for the language.
  "register_overrides" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  -- Prevent duplicate (A→B, kind) edges per draft. We do not enforce
  -- (a < b) ordering because relationships are directional ("A is
  -- mentor_of B" is not the same as "B is mentor_of A").
  CONSTRAINT "relationships_no_self_loop" CHECK ("entity_a" <> "entity_b")
);

CREATE UNIQUE INDEX IF NOT EXISTS "relationships_uniq_edge"
  ON "relationships" ("draft_id", "entity_a", "entity_b", "kind");

CREATE INDEX IF NOT EXISTS "relationships_draft_id_idx"
  ON "relationships" ("draft_id");

-- ── story_units ────────────────────────────────────────────────────────────
--
-- Method-pluggable: the tradition decides which unit-types exist
-- (S0/D/T/S1/K predicates, or some other formalism like
-- kishōtenketsu's ki/shō/ten/ketsu). `unit_type` is TEXT, validated
-- at insert by the tradition registry.

CREATE TABLE IF NOT EXISTS "story_units" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "draft_id" uuid NOT NULL REFERENCES "story_drafts"("id") ON DELETE CASCADE,
  -- The tradition this unit was annotated under. If the author switches
  -- traditions later, old units survive but the new tradition's gate
  -- may not recognise them — the editor surface shows them as
  -- "previous-tradition" annotations.
  "tradition_profile_id" text NOT NULL,
  -- Which section in the draft this annotation is attached to.
  -- Anchored to section_id (string), not array index, so deletions /
  -- reorderings don't break the link.
  "section_id" text,
  -- Open value space, owned by the tradition. Defines what kind of
  -- unit annotation this row is (e.g. "s0" / "disturbance" /
  -- "transformation" / "s1" / "stakes" for the S0→D→T→S1, K formalism).
  "unit_type" text NOT NULL,
  -- Free-form text describing the unit. Author writes; AI may suggest.
  "value" text,
  -- Per-unit predicates / verdicts. Open shape; the AI-coach skeleton
  -- window decides what predicates each unit_type carries (e.g.
  -- { "is_transformed": true, "is_causal": true, "has_stakes": false }).
  "predicates" jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Failure category when the gate decides this section / unit fails
  -- ("descriptive" / "essayistic" / "expository" / …). Open string;
  -- tradition registry decides allowed values.
  "failure_type" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "story_units_draft_id_idx"
  ON "story_units" ("draft_id");

CREATE INDEX IF NOT EXISTS "story_units_draft_section_idx"
  ON "story_units" ("draft_id", "section_id");

-- ── postures ───────────────────────────────────────────────────────────────
--
-- Author/character stance on a subject entity. Volatile, sticky —
-- only annotated at change points (the rest of the prose inherits the
-- last set posture for that subject). `value` is TEXT; tradition
-- decides allowed values ("guarded" / "anguished" / "resigned" / …).

CREATE TABLE IF NOT EXISTS "postures" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "draft_id" uuid NOT NULL REFERENCES "story_drafts"("id") ON DELETE CASCADE,
  "tradition_profile_id" text NOT NULL,
  -- Who the posture is about.
  "subject_entity_id" uuid NOT NULL REFERENCES "entities"("id") ON DELETE CASCADE,
  -- Where in the prose the posture takes effect. anchor_section_id +
  -- anchor_offset gives a (section, character-offset-within-content)
  -- coordinate. Both nullable for postures that apply to the whole draft.
  "anchor_section_id" text,
  "anchor_offset" integer,
  -- Tradition-defined posture value. Open string.
  "value" text NOT NULL,
  -- The "surface vs intent" pair P9 / P11 / translation engine cares
  -- about. e.g. { "surface": "polite", "intent": "icy" } — the
  -- surface form vs what the prose actually means.
  "surface_intent_pair" jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Where this posture ends (next change point). Nullable = "to end
  -- of draft".
  "expires_anchor_section_id" text,
  "expires_anchor_offset" integer,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "postures_draft_id_idx"
  ON "postures" ("draft_id");

CREATE INDEX IF NOT EXISTS "postures_subject_idx"
  ON "postures" ("draft_id", "subject_entity_id");

-- ── elisions ───────────────────────────────────────────────────────────────
--
-- Source-language omissions that target languages must surface. E.g.
-- in Chinese the subject of a sentence is often omitted; in English /
-- Japanese, the translator must surface it. `resolution_type` is TEXT
-- (open value space): "subject_omitted" / "pronoun_implicit" /
-- "honorific_implied" / etc.

CREATE TABLE IF NOT EXISTS "elisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "draft_id" uuid NOT NULL REFERENCES "story_drafts"("id") ON DELETE CASCADE,
  -- Which section the elision lives in.
  "section_id" text NOT NULL,
  -- Span within the section's content (character offsets).
  "text_span_start" integer NOT NULL,
  "text_span_end" integer NOT NULL,
  -- Open value, tradition-owned.
  "resolution_type" text NOT NULL,
  -- The entity that fills the elision (the omitted subject, the
  -- elided pronoun's referent). Nullable when the elision is
  -- non-entity (e.g. an honorific tone that doesn't point at an
  -- entity).
  "resolved_entity_id" uuid REFERENCES "entities"("id") ON DELETE SET NULL,
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "elisions_span_valid"
    CHECK ("text_span_start" >= 0 AND "text_span_end" > "text_span_start")
);

CREATE INDEX IF NOT EXISTS "elisions_draft_section_idx"
  ON "elisions" ("draft_id", "section_id");

-- ── Universal updated_at trigger reuse ─────────────────────────────────────
--
-- We already defined set_updated_at() in 0009_story_drafts.sql. Reuse
-- for the new tables.

DO $$ BEGIN
  CREATE TRIGGER "entities_updated_at"
    BEFORE UPDATE ON "entities"
    FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER "entity_name_renderings_updated_at"
    BEFORE UPDATE ON "entity_name_renderings"
    FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER "relationships_updated_at"
    BEFORE UPDATE ON "relationships"
    FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER "story_units_updated_at"
    BEFORE UPDATE ON "story_units"
    FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER "postures_updated_at"
    BEFORE UPDATE ON "postures"
    FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER "elisions_updated_at"
    BEFORE UPDATE ON "elisions"
    FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── RLS — bible is private, scoped to the draft owner ──────────────────────
--
-- Drizzle pool uses service role and bypasses these; app-level checks
-- in /api/drafts/[id]/bible/* are the real enforcement. Policies are
-- defence-in-depth — JWT-context queries (direct Supabase anon-key
-- access) honour them.

ALTER TABLE "entities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "entity_name_renderings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "relationships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "story_units" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "postures" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "elisions" ENABLE ROW LEVEL SECURITY;

-- The bible tables don't carry user_id directly; we authorise via a
-- subquery against story_drafts.user_id. One policy per (table, op).

DROP POLICY IF EXISTS "entities_owner_all" ON "entities";
CREATE POLICY "entities_owner_all" ON "entities"
  USING (
    EXISTS (
      SELECT 1 FROM "story_drafts" d
      WHERE d."id" = "entities"."draft_id" AND d."user_id" = auth.uid()
    )
  );

DROP POLICY IF EXISTS "entity_name_renderings_owner_all" ON "entity_name_renderings";
CREATE POLICY "entity_name_renderings_owner_all" ON "entity_name_renderings"
  USING (
    EXISTS (
      SELECT 1 FROM "entities" e
      JOIN "story_drafts" d ON d."id" = e."draft_id"
      WHERE e."id" = "entity_name_renderings"."entity_id"
        AND d."user_id" = auth.uid()
    )
  );

DROP POLICY IF EXISTS "relationships_owner_all" ON "relationships";
CREATE POLICY "relationships_owner_all" ON "relationships"
  USING (
    EXISTS (
      SELECT 1 FROM "story_drafts" d
      WHERE d."id" = "relationships"."draft_id" AND d."user_id" = auth.uid()
    )
  );

DROP POLICY IF EXISTS "story_units_owner_all" ON "story_units";
CREATE POLICY "story_units_owner_all" ON "story_units"
  USING (
    EXISTS (
      SELECT 1 FROM "story_drafts" d
      WHERE d."id" = "story_units"."draft_id" AND d."user_id" = auth.uid()
    )
  );

DROP POLICY IF EXISTS "postures_owner_all" ON "postures";
CREATE POLICY "postures_owner_all" ON "postures"
  USING (
    EXISTS (
      SELECT 1 FROM "story_drafts" d
      WHERE d."id" = "postures"."draft_id" AND d."user_id" = auth.uid()
    )
  );

DROP POLICY IF EXISTS "elisions_owner_all" ON "elisions";
CREATE POLICY "elisions_owner_all" ON "elisions"
  USING (
    EXISTS (
      SELECT 1 FROM "story_drafts" d
      WHERE d."id" = "elisions"."draft_id" AND d."user_id" = auth.uid()
    )
  );

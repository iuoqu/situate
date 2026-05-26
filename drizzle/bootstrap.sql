-- ════════════════════════════════════════════════════════════════════════════
-- Situate Editions — bootstrap SQL
-- ════════════════════════════════════════════════════════════════════════════
--
-- One-shot script for spinning up a fresh database (Supabase or any other
-- Postgres host). Equivalent to running migrations 0000 + 0001 + 0002 in
-- order, then `npm run db:seed`. Idempotent — safe to re-run.
--
-- How to use on Supabase:
--   1. Dashboard → SQL Editor → New query
--   2. Paste this entire file
--   3. Click Run
--   4. Switch to Table Editor and inspect: editorial_principles, editions,
--      submissions, narrative_blocks, block_translations
--
-- The final SELECT at the bottom is the viewport probe — its result rows
-- prove that PostGIS, the SRID fix, access-tier gating, and edition
-- visibility all line up.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. PostGIS ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS postgis;

-- ─── 2. Enums ───────────────────────────────────────────────────────────────
DO $$ BEGIN CREATE TYPE "public"."edition_status" AS ENUM('planning', 'scheduled', 'published', 'archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."moderation_decision" AS ENUM('approve', 'reject', 'request_changes', 'flag_for_legal'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."moderation_layer" AS ENUM('ai', 'human', 'legal'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."report_category" AS ENUM('defamation', 'hate_speech', 'factual_error', 'copyright', 'harassment', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."report_status" AS ENUM('open', 'in_review', 'resolved', 'dismissed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."status" AS ENUM('draft', 'ai_review', 'human_review', 'published'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."supported_language" AS ENUM('en', 'zh_CN', 'zh_TW', 'ja', 'ko'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."translation_access_tier" AS ENUM('free', 'metered', 'premium'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."translation_method" AS ENUM('original', 'ai', 'ai_post_edited', 'human'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."translation_status" AS ENUM('draft', 'ai_generated', 'in_review', 'published'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 3. Tables ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "editions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "number" serial NOT NULL,
  "slug" text NOT NULL,
  "title" text NOT NULL,
  "theme" text,
  "editors_letter" text,
  "cover_image_url" text,
  "publish_at" timestamp with time zone,
  "status" "edition_status" DEFAULT 'planning' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "editions_publish_ready" CHECK ("editions"."status" IN ('planning', 'archived')
    OR ("editions"."editors_letter" IS NOT NULL
      AND "editions"."cover_image_url" IS NOT NULL
      AND "editions"."publish_at" IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS "submissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "author_id" text NOT NULL,
  "title" text,
  "abstract" text,
  "source_language" "supported_language" DEFAULT 'en' NOT NULL,
  "status" "status" DEFAULT 'draft' NOT NULL,
  "edition_id" uuid REFERENCES "editions"("id") ON DELETE SET NULL,
  "position_in_edition" integer,
  "content_flags" jsonb DEFAULT '{"realPlaces":[],"realPersons":[],"realOrgs":[],"conflictZone":false}'::jsonb NOT NULL,
  "author_affiliations" text[] DEFAULT ARRAY[]::text[] NOT NULL,
  "satire_disclosure" boolean DEFAULT false NOT NULL,
  "sensitivity_warnings" text[] DEFAULT ARRAY[]::text[] NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "submissions_position_requires_edition" CHECK ("submissions"."edition_id" IS NULL OR "submissions"."position_in_edition" IS NOT NULL)
);

-- Note: geometry(Point, 4326) declared inline so we don't need the
-- separate SRID-fix migration that the schema-managed flow requires.
CREATE TABLE IF NOT EXISTS "narrative_blocks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "submission_id" uuid NOT NULL REFERENCES "submissions"("id") ON DELETE CASCADE,
  "event_date" timestamp with time zone,
  "location" geometry(Point, 4326),
  "sequence_number" serial NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "block_translations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "block_id" uuid NOT NULL REFERENCES "narrative_blocks"("id") ON DELETE CASCADE,
  "language" "supported_language" NOT NULL,
  "method" "translation_method" NOT NULL,
  "status" "translation_status" DEFAULT 'draft' NOT NULL,
  "content" text NOT NULL,
  "annotations" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "translator_id" text,
  "access_tier" "translation_access_tier" DEFAULT 'free' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "moderation_decisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "submission_id" uuid NOT NULL REFERENCES "submissions"("id") ON DELETE CASCADE,
  "layer" "moderation_layer" NOT NULL,
  "reviewer_id" text,
  "decision" "moderation_decision" NOT NULL,
  "rationale" text,
  "flagged_entities" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "cited_principles" text[] DEFAULT ARRAY[]::text[] NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "submission_id" uuid NOT NULL REFERENCES "submissions"("id") ON DELETE CASCADE,
  "reporter_id" text,
  "category" "report_category" NOT NULL,
  "body" text,
  "locale" text NOT NULL,
  "status" "report_status" DEFAULT 'open' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "resolved_at" timestamp with time zone,
  "resolver_id" text
);

CREATE TABLE IF NOT EXISTS "editorial_principles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL,
  "version" text NOT NULL,
  "title_i18n" jsonb NOT NULL,
  "body_i18n" jsonb NOT NULL,
  "examples" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "effective_at" timestamp with time zone DEFAULT now() NOT NULL,
  "superseded_by" uuid,
  "superseded_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- ─── 4. Indexes ─────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS "editions_slug_idx" ON "editions" ("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "editions_number_idx" ON "editions" ("number");
CREATE INDEX IF NOT EXISTS "editions_publish_at_idx" ON "editions" ("publish_at");
CREATE INDEX IF NOT EXISTS "editions_status_idx" ON "editions" ("status");

CREATE INDEX IF NOT EXISTS "submissions_edition_id_idx" ON "submissions" ("edition_id");
CREATE UNIQUE INDEX IF NOT EXISTS "submissions_edition_position_idx" ON "submissions" ("edition_id", "position_in_edition") WHERE "edition_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "narrative_blocks_location_gist_idx" ON "narrative_blocks" USING gist ("location");
CREATE INDEX IF NOT EXISTS "narrative_blocks_submission_id_idx" ON "narrative_blocks" ("submission_id");

CREATE UNIQUE INDEX IF NOT EXISTS "block_translations_block_lang_method_idx" ON "block_translations" ("block_id", "language", "method");
CREATE INDEX IF NOT EXISTS "block_translations_block_lang_idx" ON "block_translations" ("block_id", "language");

CREATE INDEX IF NOT EXISTS "moderation_decisions_submission_id_idx" ON "moderation_decisions" ("submission_id");
CREATE INDEX IF NOT EXISTS "moderation_decisions_layer_idx" ON "moderation_decisions" ("layer");

CREATE INDEX IF NOT EXISTS "reports_submission_id_idx" ON "reports" ("submission_id");
CREATE INDEX IF NOT EXISTS "reports_status_idx" ON "reports" ("status");
CREATE INDEX IF NOT EXISTS "reports_locale_idx" ON "reports" ("locale");

CREATE UNIQUE INDEX IF NOT EXISTS "editorial_principles_code_version_idx" ON "editorial_principles" ("code", "version");
CREATE INDEX IF NOT EXISTS "editorial_principles_active_idx" ON "editorial_principles" ("code") WHERE "superseded_by" IS NULL;

-- ─── 5. Seed: editorial constitution (3 principles, v0.1) ───────────────────
-- Static UUIDs so re-runs are idempotent — ON CONFLICT DO NOTHING skips them
-- on a second run instead of erroring out.
INSERT INTO "editorial_principles" ("id", "code", "version", "title_i18n", "body_i18n", "examples") VALUES
  ('11111111-0000-0000-0000-000000000001', 'P1', 'v0.1',
   '{"en":"Place as Inhabited Space","zh_CN":"地点即栖居者的空间"}'::jsonb,
   '{"en":"A story set in a real location must treat that place as inhabited by real people whose dignity is at stake. We do not publish work that reduces a place to a stereotype, a backdrop, or a punchline.","zh_CN":"以真实地点为背景的小说,必须把该地点视为有血有肉者所栖居之处。我们不发表把地点简化为刻板印象、布景或笑料的作品。"}'::jsonb,
   '[]'::jsonb),
  ('11111111-0000-0000-0000-000000000002', 'P2', 'v0.1',
   '{"en":"Specificity over Category","zh_CN":"具体优先于类别"}'::jsonb,
   '{"en":"We publish fiction that names specific real places. We do not publish fiction whose argument is ''people in [X] are [negative characteristic].'' Specificity earns its place through individuality, not category.","zh_CN":"我们发表写明真实地名的虚构作品。我们不发表论点为「[X 地]人都是[某种负面特征]」的作品。具体性通过个体获得正当性,而不是类别。"}'::jsonb,
   '[{"kind":"accepted","text":"A 1,200-word story about one shoe-seller in modern Zhengzhou whose obsession with rulebooks costs him a sale."},{"kind":"declined","text":"A sketch portraying Zhengzhou residents collectively as inflexible bureaucrats."}]'::jsonb),
  ('11111111-0000-0000-0000-000000000003', 'P7', 'v0.1',
   '{"en":"Translation Fidelity","zh_CN":"翻译的忠实"}'::jsonb,
   '{"en":"Cultural-loaded phrases use the literal/transposed/explained mechanism rather than silent substitution. Translators sign their rows; AI translations are clearly marked. Reverse-translation review verifies that satire survives or is annotated when it doesn''t.","zh_CN":"文化负载词使用「直译/本土化/带注释」机制,而非静默替换。译者署名;AI 译本明确标记。反向翻译审核用以验证讽刺是否在译文中存活,否则加注。"}'::jsonb,
   '[]'::jsonb)
ON CONFLICT ("code", "version") DO NOTHING;

-- ─── 6. Seed: Issue #1 "After Midnight" ─────────────────────────────────────
INSERT INTO "editions" ("id", "slug", "title", "theme", "editors_letter", "cover_image_url", "publish_at", "status") VALUES
  ('22222222-0000-0000-0000-000000000001',
   'issue-1-after-midnight',
   'After Midnight',
   'Stories set between midnight and dawn',
   'Welcome to the first issue of Situate Editions. We open after midnight — the hour when cities reveal who they really are. Six writers across five languages take you from a Tokyo taxi stand to a Seoul convenience store, a São Paulo bus terminal, a Reykjavík fishing pier. The map is a clock; each pin is a moment that could only have happened there, then.',
   'https://images.example.com/situate/issues/1/cover.jpg',
   now(),
   'published')
ON CONFLICT ("slug") DO NOTHING;

-- ─── 7. Seed: one submission + two Tokyo-anchored blocks ────────────────────
INSERT INTO "submissions" ("id", "author_id", "title", "abstract", "source_language", "status", "edition_id", "position_in_edition", "content_flags", "author_affiliations") VALUES
  ('33333333-0000-0000-0000-000000000001',
   'author_kawakami',
   '出租车司机的最后一程',
   '深夜东京,一名出租车司机接到一位说要去明天的乘客。',
   'zh_CN',
   'published',
   '22222222-0000-0000-0000-000000000001',
   1,
   '{"realPlaces":["Shibuya Crossing","Shinjuku Station"],"realPersons":[],"realOrgs":[],"conflictZone":false}'::jsonb,
   ARRAY['lived:Tokyo:2010-2020'])
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "narrative_blocks" ("id", "submission_id", "event_date", "location") VALUES
  ('44444444-0000-0000-0000-000000000001',
   '33333333-0000-0000-0000-000000000001',
   '2023-08-15T14:30:00Z',
   ST_SetSRID(ST_MakePoint(139.7005, 35.6595), 4326)),  -- Shibuya Crossing
  ('44444444-0000-0000-0000-000000000002',
   '33333333-0000-0000-0000-000000000001',
   '2023-08-15T15:45:00Z',
   ST_SetSRID(ST_MakePoint(139.7006, 35.6896), 4326))   -- Shinjuku Station
ON CONFLICT ("id") DO NOTHING;

-- ─── 8. Seed: translations (original + AI + premium human) ──────────────────
-- block 1 (Shibuya): zh_CN original (free) + en AI (free) + ko human (premium)
INSERT INTO "block_translations" ("block_id", "language", "method", "status", "access_tier", "translator_id", "content", "annotations") VALUES
  ('44444444-0000-0000-0000-000000000001', 'zh_CN', 'original', 'published', 'free', NULL,
   '凌晨两点的涩谷十字路口空荡得像被遗忘的剧场。司机熄了引擎,等最后一位乘客。', '[]'::jsonb),
  ('44444444-0000-0000-0000-000000000001', 'en', 'ai', 'published', 'free', NULL,
   'At two in the morning the Shibuya Crossing felt as empty as a theater everyone had forgotten. The driver killed the engine and waited for his last passenger.', '[]'::jsonb),
  ('44444444-0000-0000-0000-000000000001', 'ko', 'human', 'published', 'premium', 'translator_park_jihye',
   '새벽 두 시의 시부야 횡단보도는 모두가 잊어버린 극장처럼 텅 비어 있었다. 운전사는 엔진을 끄고 마지막 손님을 기다렸다.', '[]'::jsonb),
-- block 2 (Shinjuku): zh_CN original (free) + en AI (free) — annotated on the "明天" wordplay
  ('44444444-0000-0000-0000-000000000002', 'zh_CN', 'original', 'published', 'free', NULL,
   '乘客上车时只说一句:请送我去明天。司机看了他一眼,默默打了表。',
   '[{"spanStart":22,"spanEnd":32,"kind":"wordplay","source":"明天","defaultRendering":"literal","renderings":{"literal":"\"tomorrow\"","transposed":"the next life","explained":"\"tomorrow\" (a colloquial euphemism for the next life)"},"note":"The passenger''s destination is a Chinese euphemism; literal rendering preserves the ambiguity, transposed clarifies."}]'::jsonb),
  ('44444444-0000-0000-0000-000000000002', 'en', 'ai', 'published', 'free', NULL,
   'When the passenger got in he said only this: please take me to "tomorrow". The driver glanced at him and quietly started the meter.',
   '[{"spanStart":22,"spanEnd":32,"kind":"wordplay","source":"明天","defaultRendering":"literal","renderings":{"literal":"\"tomorrow\"","transposed":"the next life","explained":"\"tomorrow\" (a colloquial euphemism for the next life)"},"note":"The passenger''s destination is a Chinese euphemism; literal rendering preserves the ambiguity, transposed clarifies."}]'::jsonb)
ON CONFLICT ("block_id", "language", "method") DO NOTHING;

-- ─── 9. Verification: viewport probe (Tokyo bbox, free 'en' reader) ─────────
-- This is exactly what the app server action does. You should see 2 rows —
-- both English AI translations (free tier). The premium Korean human row
-- is correctly hidden behind the access gate.
SELECT DISTINCT ON (nb.id)
  nb.id                AS block_id,
  ROUND(ST_X(nb.location)::numeric, 4) AS lon,
  ROUND(ST_Y(nb.location)::numeric, 4) AS lat,
  bt.language          AS language,
  bt.method            AS method,
  bt.access_tier       AS access_tier,
  bt.content           AS content
FROM narrative_blocks nb
INNER JOIN submissions s          ON s.id = nb.submission_id
INNER JOIN block_translations bt  ON bt.block_id = nb.id
LEFT  JOIN editions e             ON e.id = s.edition_id
WHERE
  nb.location IS NOT NULL
  AND ST_Intersects(
    nb.location,
    ST_MakeEnvelope(139.65, 35.60, 139.75, 35.72, 4326)
  )
  AND s.status = 'published'
  AND (s.edition_id IS NULL OR e.status = 'published')
  AND bt.status = 'published'
  AND (bt.language = 'en' OR bt.method = 'original')
  AND CASE bt.access_tier
        WHEN 'free' THEN 0 WHEN 'metered' THEN 1 WHEN 'premium' THEN 2
      END <= 0  -- free reader
ORDER BY
  nb.id,
  CASE
    WHEN bt.language = 'en' AND bt.method = 'human'          THEN 1
    WHEN bt.language = 'en' AND bt.method = 'ai_post_edited' THEN 2
    WHEN bt.language = 'en' AND bt.method = 'ai'             THEN 3
    WHEN bt.method = 'original'                              THEN 4
    ELSE 5
  END;

-- ════════════════════════════════════════════════════════════════════════════
-- seed_constitution_p3_v021.sql — amend P3 to v0.2.1
-- ════════════════════════════════════════════════════════════════════════════
--
-- P3 (Place Is Generative) gets a textual revision that:
--   1. Splits dependence into "explicit" and "implicit" — implicit
--      sensory/cultural/environmental dependence is now admissible if it
--      structurally constitutes the story's central insight or
--      transformation (this opens the door to Dillard / Lispector /
--      zuihitsu-style work that v0.2 over-rejected).
--   2. Adds a "structural argument vs atmospheric appeal" operational
--      guardrail so the door does not become a loophole.
--   3. Restores the v0.2 flagship sentence "we are not a publication of
--      well-written stories" as the principle's closing line.
--
-- All other v0.2 principles (P1, P2, P4–P13) remain at v0.2.
--
-- How to apply on Supabase:
--   Dashboard → SQL Editor → paste this file → Run.
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO "editorial_principles"
  ("id", "code", "version", "title_i18n", "body_i18n", "examples")
VALUES (
  '22222222-0000-0000-0000-000003000201', 'P3', 'v0.2.1',
  '{"en":"Place Is Generative","zh_CN":"地点是生成性的"}'::jsonb,
  $${"en":"A story must depend on its coordinates in a way another setting could not replicate. The dependence can be explicit (the story's central event requires this place — a specific architectural feature, a local custom, a geography-determined plot point) or implicit (the place's sensory texture, cultural weight, or environmental quality structurally constitutes the story's central insight or transformation). Move the pin and the story should break. Implicit dependence requires structural argument, not atmospheric appeal. If the story's meaning would survive transplant to another setting — even if the surface description loses something — the dependence is decorative, not structural. Test: does this story's central tension, insight, or transformation depend on something only this place provides? Not ''could a similar story happen elsewhere,'' but ''could this exact story''s exact meaning emerge elsewhere.'' We are not a publication of well-written stories. We are a publication of stories that owe their existence to where they are set.","zh_CN":"故事必须以一种别处无法替代的方式依赖它的坐标。这种依赖可以是显式的(故事的中心事件需要这个地点——特定的建筑、本地习俗、地理决定的情节点),也可以是隐式的(地点的感官质感、文化承载、环境特质在结构上构成了故事的中心洞察或转折)。把钉挪走,故事应该会损坏。隐式依赖要的是结构论证,不是氛围观感。如果一个故事的意义能整体移植到别的地方——哪怕表层描写有所损失——那种依赖就是装饰性的,不是结构性的。测试:这个故事的中心张力、洞察或转折是否依赖于只有这个地点提供的某种东西?不是问「类似的故事能否在别处发生」,而是问「这个具体故事的具体意义能否在别处涌现」。我们刊登的不是写得好的故事,是因这个地点而存在的故事。"}$$::jsonb,
  '[]'::jsonb
)
ON CONFLICT ("code", "version") DO UPDATE SET
  "title_i18n" = EXCLUDED."title_i18n",
  "body_i18n"  = EXCLUDED."body_i18n",
  "examples"   = EXCLUDED."examples";

-- Supersede P3 v0.2 → P3 v0.2.1
UPDATE "editorial_principles"
SET "superseded_by" = '22222222-0000-0000-0000-000003000201',
    "superseded_at" = now()
WHERE "code" = 'P3' AND "version" = 'v0.2' AND "superseded_by" IS NULL;

-- Verification
SELECT
  code,
  version,
  title_i18n->>'en' AS title_en,
  CASE WHEN superseded_by IS NULL THEN 'active' ELSE 'superseded' END AS status
FROM editorial_principles
WHERE code = 'P3'
ORDER BY version;

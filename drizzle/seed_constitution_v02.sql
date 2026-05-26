-- ════════════════════════════════════════════════════════════════════════════
-- seed_constitution_v02.sql — publish the editorial constitution v0.2.
-- ════════════════════════════════════════════════════════════════════════════
--
-- Inserts 13 principles at version v0.2, then marks the v0.1 rows as
-- superseded. Where a v0.1 → v0.2 mapping isn't 1:1 (because v0.2 split
-- and renumbered), the supersession follows the semantic equivalent:
--
--   v0.1 → v0.2
--   P1   → P1   (Place as Inhabited Space)
--   P2   → P2   (Specificity over Category)
--   —    → P3   (Place Is Generative — split out of v0.1 P2)
--   P3   → P4   (Author Affinity)
--   P4   → P5   (Fiction Is Not a License)
--   P5   → P6   (renamed: Mass Suffering, not Historical Atrocities)
--   —    → P7   (The Gaze, Not the Topic — new)
--   P6   → P8   (Map Truth)
--   P7   → P9   (Translation Fidelity)
--   P8   → P10  (AI Disclosure)
--   —    → P11  (Reality, Disclosed — new)
--   P9   → P12  (Editorial Independence)
--   P10  → P13  (This Constitution Is a Draft)
--
-- Idempotent on re-run (ON CONFLICT (code, version) DO UPDATE; supersession
-- updates only fire when the v0.1 row isn't already linked).
--
-- How to apply on Supabase:
--   Dashboard → SQL Editor → paste this file → Run.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. Insert v0.2 principles ─────────────────────────────────────────────
-- Static UUIDs (range `22222222-...`) so we can reference them in the
-- supersession UPDATEs below without an extra round-trip.

INSERT INTO "editorial_principles"
  ("id", "code", "version", "title_i18n", "body_i18n", "examples")
VALUES

-- ─── P1 ─────────────────────────────────────────────────────────────────────
(
  '22222222-0000-0000-0000-000000000001', 'P1', 'v0.2',
  '{"en":"Place as Inhabited Space","zh_CN":"地点作为有人居住的空间"}'::jsonb,
  $${"en":"A real place is not a setting; it is somewhere people are. If a story names a city, a province, a village, that name belongs to the people who live there as much as to the writer. We do not publish work that empties a real place of its inhabitants, uses it as a thesis-stage, or treats it as a punchline. The story does not have to feature local characters. It does have to know it is not alone there.","zh_CN":"真实地点不只是故事的场景,更是有人生活的地方。一篇故事若提及某座城市、某个省份、某个村庄,那地名既属于作者,也属于在那里生活的人。我们不刊登把真实地点清空人烟、当作论点舞台、或作为笑料结尾的作品。故事中不必出现本地人物。但故事必须明白:在那个地方,它并非独自存在。"}$$::jsonb,
  '[]'::jsonb
),

-- ─── P2 ─────────────────────────────────────────────────────────────────────
(
  '22222222-0000-0000-0000-000000000002', 'P2', 'v0.2',
  '{"en":"Specificity over Category","zh_CN":"具体性胜过类别"}'::jsonb,
  $${"en":"We publish fiction about specific people in specific places. Specificity is the price of being on the map — and the courtesy we owe to the people the map names. We do not publish work that uses one individual's story as a verdict on the people of a place. A farmer waiting beside a tree stump is a story. ''The people of Song had a farmer who…'' is a verdict, and the grammar betrays it. We publish the former. We decline the latter, however ancient the form, however well-turned the joke. Institutions and governments are not populations; they may be satirised.","zh_CN":"我们刊登具体之人在具体之地的故事。具体性是上图的代价——也是我们对地图所标地名上的居民应尽的礼数。我们不刊登把一个人的故事用作对某地民众之判词的作品。一个守在树桩旁的农夫,是一则故事;「宋人有耕者……」,是一份判词,语法本身就泄露了底色。我们刊登前者,谢绝后者——无论其体式多么古老,无论玩笑多么精巧。机构与政府并非民众;它们可以被讽刺。"}$$::jsonb,
  '[
    {"kind":"accepted","text":"A character study of one Lagos software engineer whose particular vanity costs him a relationship."},
    {"kind":"declined","text":"A sketch in which ''Lagosians'' collectively represent some social failing."}
  ]'::jsonb
),

-- ─── P3 ─────────────────────────────────────────────────────────────────────
(
  '22222222-0000-0000-0000-000000000003', 'P3', 'v0.2',
  '{"en":"Place Is Generative","zh_CN":"地点是生成性的"}'::jsonb,
  $${"en":"A story must depend on its coordinates in a way another setting could not replicate. Move the pin and the story should break. Geographic accuracy and stylistic polish are not enough: a universal drama dressed in local occupation, dialect, or scenery is still a universal drama. The test asks whether the story''s central events and tensions need this place — not whether the protagonist carries a local biography. Aesthetic and lyrical attention to a place is not itself an event; a work that only describes the beauty of a place, without anything happening there, is not for us. We are not a publication of well-written stories. We are a publication of stories that owe their existence to where they are set.","zh_CN":"故事必须以一种别处无法替代的方式依赖它的坐标。把钉挪走,故事应该会损坏。地理准确和文笔漂亮不够:给普世故事穿上职业、方言、风物的地方衣服,本质上仍是普世故事。测试问的是故事的中心事件和张力是否需要这个地点——不是主角是否带地方履历。审美和抒情本身不是事件——一篇只描写某地之美而不在那里发生什么的作品,再美也不在我们这里发。我们刊登的不是写得好的故事,是因这个地点而存在的故事。"}$$::jsonb,
  '[]'::jsonb
),

-- ─── P4 ─────────────────────────────────────────────────────────────────────
(
  '22222222-0000-0000-0000-000000000004', 'P4', 'v0.2',
  '{"en":"Author Affinity, Disclosed"}'::jsonb,
  $${"en":"Authors tell us their relationship to the places they write about: born there, lived there, worked there, researched there, passing through, never been. The disclosure runs beside the published story. Outsider work is welcome and often necessary — but the further an author stands from a place, the more closely the writing must look. Brilliance does not waive this; we will sometimes decline elegant work by writers who have not done the seeing. When disclosure itself could endanger an author, the editors hold the affinity in confidence and publish a redacted note in its place."}$$::jsonb,
  '[]'::jsonb
),

-- ─── P5 ─────────────────────────────────────────────────────────────────────
(
  '22222222-0000-0000-0000-000000000005', 'P5', 'v0.2',
  '{"en":"Fiction Is Not a License"}'::jsonb,
  $${"en":"Real living people appear in our fiction only with their consent, as public figures depicted in their public conduct, or so transformed they cannot be recognised. The same applies to named businesses and small institutions where the staff are identifiable. Historical or fictional masks do not lift this protection: if contemporary readers in the work''s geographic context would recognise the target, the principle applies as if the target were named. The point is not legal cover. The form does not, by itself, license what would otherwise be a trespass on a stranger''s life. The recently deceased (≤ 10 years) count as living; the long dead do not."}$$::jsonb,
  '[]'::jsonb
),

-- ─── P6 ─────────────────────────────────────────────────────────────────────
(
  '22222222-0000-0000-0000-000000000006', 'P6', 'v0.2',
  '{"en":"Mass Suffering Is Not Material for Satire"}'::jsonb,
  $${"en":"Mass suffering — the Shoah, the Cultural Revolution, the Rwandan genocide, the Trail of Tears, the Nakba; the Tangshan earthquake, the Great Chinese Famine, the 2004 Indian Ocean tsunami, the AIDS pandemic, COVID-19; any documented catastrophe whose suffering memory remains load-bearing for living survivors and contemporary communities, whether caused by humans, by nature, or by disease — is not material for satire, counterfactual revisionism, or formal play. The protection is for the dead and the survivors, not for the event''s category. Fiction set during, after, or in the long shadow of these events is welcome and necessary, including satire of those who failed the moment — negligent officials, exploitative profiteers, denialists. Fiction that treats the suffering itself as raw material for cleverness is not. The list is illustrative; we extend it in public as cases arise."}$$::jsonb,
  '[]'::jsonb
),

-- ─── P7 ─────────────────────────────────────────────────────────────────────
(
  '22222222-0000-0000-0000-000000000007', 'P7', 'v0.2',
  '{"en":"The Gaze, Not the Topic"}'::jsonb,
  $${"en":"Crime, violence, sex, addiction, abuse — all are subjects literature has always engaged, and they are welcome here. What we decline is work in which the depiction serves the reader''s appetite rather than the work''s purpose. Violence as spectacle, sex as titillation, drug use as cost-free transcendence, suffering as scenery — these we refuse, however polished the surrounding craft. The test is the gaze, not the topic. A war story can be either. A scene of sexual violence can be either. The work itself shows which."}$$::jsonb,
  '[]'::jsonb
),

-- ─── P8 ─────────────────────────────────────────────────────────────────────
(
  '22222222-0000-0000-0000-000000000008', 'P8', 'v0.2',
  '{"en":"Map Truth"}'::jsonb,
  $${"en":"Coordinates must point to a real place where the story could plausibly be set. We do not pin to private homes, places of worship, schools, clinics, or any address whose exposure could harm its occupants. We will move a pin to a nearby public landmark when the story is otherwise sound, and we will note in the publication that we have done so. The map is a claim; we are careful what we claim."}$$::jsonb,
  '[]'::jsonb
),

-- ─── P9 ─────────────────────────────────────────────────────────────────────
(
  '22222222-0000-0000-0000-000000000009', 'P9', 'v0.2',
  '{"en":"Translation Fidelity","zh_CN":"翻译保真度"}'::jsonb,
  $${"en":"Culturally loaded phrases are handled by a literal / transposed / explained mechanism rather than silent substitution. Translators sign their work. AI translations are labelled as such. Any work whose effect depends on irony — satire, dark comedy, unreliable narration, deadpan — passes a reverse-translation review by a human translator in each published language before publication, regardless of how it was translated. We trigger this review broadly: when the author marks the piece as satirical, when the piece carries cultural-rendering annotations, when automated detection surfaces ironic signals, when the work exceeds 1,500 words, and when the author''s relationship to the place is ''passing through'' or ''never been''. We would rather over-trigger this review than let irony die in translation. Irony is the first thing a machine loses, and the last thing a reader notices is gone.","zh_CN":"文化承载的词句采用「直译/本土化/带注释」机制,而非静默替换。译者署名。AI 译本明确标记。任何效果依赖反讽的作品——讽刺、黑色幽默、不可靠叙事、冷面笑话——无论以何种方式翻译,发表前都须经各发表语言的人类译者进行回译审阅。我们的回译触发条件刻意宽松:作者标记为讽刺、作品带文化标注、自动检测出反讽信号、长度超过 1500 字、作者与地点的关系为「路过」或「从未去过」——满足任一即触发。我们宁可多做回译,也不让反讽在翻译中死去。反讽是机器最先丢掉的东西,也是读者最后才察觉已不在的东西。"}$$::jsonb,
  '[]'::jsonb
),

-- ─── P10 ────────────────────────────────────────────────────────────────────
(
  '22222222-0000-0000-0000-000000000010', 'P10', 'v0.2',
  '{"en":"AI Disclosure"}'::jsonb,
  $${"en":"We do not publish fiction whose composition or substantive revision was done by AI, presented as if written by a human. AI translation, AI copy-editing, and AI-assisted research are different categories with different labels. The line is not ''no AI ever''. The line is no deception about who wrote the sentences. We do not auto-decline submissions on the basis of statistical AI-detection alone. Such classifiers carry documented bias against non-native English writing (Stanford, 2023), against minoritised dialects and registers, and against writers whose first drafts read as unusually formal. Where an automated check raises a flag, a human editor reads the piece and the author''s Field 5 disclosure together. The verdict is not delegated to detectors."}$$::jsonb,
  '[]'::jsonb
),

-- ─── P11 ────────────────────────────────────────────────────────────────────
(
  '22222222-0000-0000-0000-000000000011', 'P11', 'v0.2',
  '{"en":"Reality, Disclosed"}'::jsonb,
  $${"en":"Work submitted as fiction must be fiction in a meaningful sense: invented, composited, or transformed. If a piece is substantially a true account of a real event — whether the people in it are identifiable or not, whether the author was there or only heard — the author tells us. ''I only heard it'' does not lift the obligation; if the work treats a rumoured event as roughly factual, the reliance is real. We may publish disclosed work; we may publish it unchanged; we will not publish it under the wrong label. The map already invites the reader to believe; we will not cash in that belief without warning. Where a single piece appears to engage both real persons (P5) and real events (P11), the editorial citation defaults to P5. Consent for individual depiction takes precedence as the primary principle. P11 applies independently when the labelling concern is the event itself and no identifiable real person is at stake."}$$::jsonb,
  '[]'::jsonb
),

-- ─── P12 ────────────────────────────────────────────────────────────────────
(
  '22222222-0000-0000-0000-000000000012', 'P12', 'v0.2',
  '{"en":"Editorial Independence"}'::jsonb,
  $${"en":"No advertiser, sponsor, or tourism partner influences which stories we publish, or how a place is framed within them. Money may buy a banner; it does not buy a verdict on a place, or the absence of one. When we accept partnerships, we say so on the page. When we decline them, we usually do not announce it — but we keep the list."}$$::jsonb,
  '[]'::jsonb
),

-- ─── P13 ────────────────────────────────────────────────────────────────────
(
  '22222222-0000-0000-0000-000000000013', 'P13', 'v0.2',
  '{"en":"This Constitution Is a Draft"}'::jsonb,
  $${"en":"Version 0.2. Prior versions live in our public archive. When a principle changes, decisions made under the prior principle remain interpretable by their code. We expect to be wrong about something here. We expect a reader to point it out before we notice. We commit to updating in public when that happens."}$$::jsonb,
  '[]'::jsonb
)

ON CONFLICT ("code", "version") DO UPDATE SET
  "title_i18n" = EXCLUDED."title_i18n",
  "body_i18n"  = EXCLUDED."body_i18n",
  "examples"   = EXCLUDED."examples";

-- ─── 2. Supersede the v0.1 rows ────────────────────────────────────────────

-- Update each v0.1 principle's superseded_by pointer to the corresponding
-- v0.2 row. We use the (code, version) unique index to locate the v0.1
-- rows and the static UUIDs declared above for the v0.2 targets.

-- v0.1 P1 → v0.2 P1
UPDATE "editorial_principles"
SET "superseded_by" = '22222222-0000-0000-0000-000000000001',
    "superseded_at" = now()
WHERE "code" = 'P1' AND "version" = 'v0.1' AND "superseded_by" IS NULL;

-- v0.1 P2 → v0.2 P2
UPDATE "editorial_principles"
SET "superseded_by" = '22222222-0000-0000-0000-000000000002',
    "superseded_at" = now()
WHERE "code" = 'P2' AND "version" = 'v0.1' AND "superseded_by" IS NULL;

-- v0.1 P3 (Author Affinity) → v0.2 P4
UPDATE "editorial_principles"
SET "superseded_by" = '22222222-0000-0000-0000-000000000004',
    "superseded_at" = now()
WHERE "code" = 'P3' AND "version" = 'v0.1' AND "superseded_by" IS NULL;

-- v0.1 P4 (Fiction Is Not a License) → v0.2 P5
UPDATE "editorial_principles"
SET "superseded_by" = '22222222-0000-0000-0000-000000000005',
    "superseded_at" = now()
WHERE "code" = 'P4' AND "version" = 'v0.1' AND "superseded_by" IS NULL;

-- v0.1 P5 (Historical Atrocities) → v0.2 P6 (Mass Suffering)
UPDATE "editorial_principles"
SET "superseded_by" = '22222222-0000-0000-0000-000000000006',
    "superseded_at" = now()
WHERE "code" = 'P5' AND "version" = 'v0.1' AND "superseded_by" IS NULL;

-- v0.1 P6 (Map Truth) → v0.2 P8
UPDATE "editorial_principles"
SET "superseded_by" = '22222222-0000-0000-0000-000000000008',
    "superseded_at" = now()
WHERE "code" = 'P6' AND "version" = 'v0.1' AND "superseded_by" IS NULL;

-- v0.1 P7 (Translation Fidelity) → v0.2 P9
UPDATE "editorial_principles"
SET "superseded_by" = '22222222-0000-0000-0000-000000000009',
    "superseded_at" = now()
WHERE "code" = 'P7' AND "version" = 'v0.1' AND "superseded_by" IS NULL;

-- v0.1 P8 (AI Disclosure) → v0.2 P10
UPDATE "editorial_principles"
SET "superseded_by" = '22222222-0000-0000-0000-000000000010',
    "superseded_at" = now()
WHERE "code" = 'P8' AND "version" = 'v0.1' AND "superseded_by" IS NULL;

-- v0.1 P9 (Editorial Independence) → v0.2 P12
UPDATE "editorial_principles"
SET "superseded_by" = '22222222-0000-0000-0000-000000000012',
    "superseded_at" = now()
WHERE "code" = 'P9' AND "version" = 'v0.1' AND "superseded_by" IS NULL;

-- v0.1 P10 (This Constitution Is a Draft) → v0.2 P13
UPDATE "editorial_principles"
SET "superseded_by" = '22222222-0000-0000-0000-000000000013',
    "superseded_at" = now()
WHERE "code" = 'P10' AND "version" = 'v0.1' AND "superseded_by" IS NULL;

-- ─── 3. Verification ───────────────────────────────────────────────────────

SELECT
  code,
  version,
  title_i18n->>'en' AS title_en,
  CASE WHEN superseded_by IS NULL THEN 'active' ELSE 'superseded' END AS status
FROM editorial_principles
ORDER BY version DESC, (substring(code from 2))::int;

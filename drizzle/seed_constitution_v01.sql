-- ════════════════════════════════════════════════════════════════════════════
-- Seed: Editorial Constitution v0.1
-- ════════════════════════════════════════════════════════════════════════════
--
-- Inserts (or refreshes, on re-run) all ten principles of v0.1. The
-- bootstrap.sql script already seeded P1/P2/P7 with abbreviated text — this
-- file overrides their bodies with the polished v0.1 wording and adds P3-P6
-- and P8-P10.
--
-- Idempotent: ON CONFLICT (code, version) DO UPDATE keeps existing rows in
-- place (preserving their UUIDs and any FKs from moderation_decisions.cited_
-- principles) and just refreshes content.
--
-- How to use:
--   1. Supabase Dashboard → SQL Editor → New query
--   2. Paste this entire file
--   3. Click Run
--   4. Visit /about/constitution on your deployment to verify rendering
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO "editorial_principles"
  ("code", "version", "title_i18n", "body_i18n", "examples")
VALUES

-- ─── P1 ─────────────────────────────────────────────────────────────────────
(
  'P1', 'v0.1',
  '{"en":"Place as Inhabited Space","zh_CN":"地点即栖居者的空间"}'::jsonb,
  $${"en":"A story set in a real location must treat that place as inhabited by real people whose dignity is at stake. We do not publish work that reduces a place to a stereotype, a backdrop for a thesis, or a punchline. The story must owe something to the people who live there, even if they never appear in the text.","zh_CN":"以真实地点为背景的小说,必须把该地点视为有血有肉者所栖居之处。我们不发表把地点简化为刻板印象、论点的布景或笑料的作品。故事必须对生活在那里的人有所承担,即使他们从未在文本中出场。"}$$::jsonb,
  '[
    {"kind":"accepted","text":"A 1,400-word story about one specific morning at the Tijuana–San Ysidro border, told through one named character whose details are invented but whose moral stakes are not."},
    {"kind":"declined","text":"A travel-essay-flavored sketch in which a Tijuana neighborhood functions as a metaphor for despair, with no specific inhabitant on the page."}
  ]'::jsonb
),

-- ─── P2 ─────────────────────────────────────────────────────────────────────
(
  'P2', 'v0.1',
  '{"en":"Specificity over Category","zh_CN":"具体优先于类别"}'::jsonb,
  $${"en":"We publish fiction that names specific real places — Zhengzhou, Tijuana, Lagos — and treats each as singular. We do not publish fiction whose argument is ''people in [X] are [negative trait].'' Specificity earns its right to be on the map. Category does not. The classical Chinese parables of 守株待兔 (the man from Zheng who waited by a tree stump for a rabbit) and 邯郸学步 (the visitor to Handan who lost the ability to walk) target real geographic populations. They survived two thousand years because of the literary stature of Han Feizi and Zhuangzi. We do not have that stature. We will not manufacture the modern equivalent.","zh_CN":"我们发表写明真实地名的虚构作品——郑州、提华纳、拉各斯——并把每一处视为独一无二。我们不发表论点为「[X 地]人都是[某种负面特征]」的作品。具体性通过个体获得在地图上的正当性。类别没有这个资格。《韩非子》中的「守株待兔」与《庄子》中的「邯郸学步」直指真实地名上的人群。它们能存活两千年,是因为韩非与庄周的文学体量。我们没有这个体量。我们不会制造现代版本。"}$$::jsonb,
  '[
    {"kind":"accepted","text":"A character study of one Lagos software engineer whose particular vanity costs him a relationship."},
    {"kind":"declined","text":"A sketch in which ''Lagosians'' collectively represent some social failing."}
  ]'::jsonb
),

-- ─── P3 ─────────────────────────────────────────────────────────────────────
(
  'P3', 'v0.1',
  '{"en":"Author Affinity, Disclosed"}'::jsonb,
  '{"en":"Authors disclose their relationship to the places they write about — born there, lived there from year X to year Y, researched there, or outside observer. The disclosure appears alongside the published story. Outsider perspectives are welcome and necessary; they are also held to a higher specificity bar (see P2)."}'::jsonb,
  '[]'::jsonb
),

-- ─── P4 ─────────────────────────────────────────────────────────────────────
(
  'P4', 'v0.1',
  '{"en":"Fiction Is Not a License"}'::jsonb,
  $${"en":"Living persons named in fiction must either consent to depiction, be public figures whose depicted conduct relates to their public role, or be unidentifiable. Private living persons — your neighbor, your barista, your mother''s friend — may not be depicted in identifiable ways, no matter how thin the fictional veneer. Named real businesses are held to the same standard."}$$::jsonb,
  $$[
    {"kind":"declined","text":"A 'fictional' portrait of a specific, identifiable, living restaurateur whose food is described with contempt."}
  ]$$::jsonb
),

-- ─── P5 ─────────────────────────────────────────────────────────────────────
(
  'P5', 'v0.1',
  '{"en":"Historical Atrocities Are Not Source Material for Satire"}'::jsonb,
  '{"en":"The Holocaust, the Rwandan genocide, the Cultural Revolution, the Trail of Tears, the Nakba, and other documented atrocities of organized violence are not material for satire, counterfactual revisionism, or play. Fiction set during or after these events is welcome — fiction that diminishes them is not."}'::jsonb,
  '[]'::jsonb
),

-- ─── P6 ─────────────────────────────────────────────────────────────────────
(
  'P6', 'v0.1',
  '{"en":"Map Truth"}'::jsonb,
  '{"en":"A story''s coordinates must correspond to a real location where the story could plausibly be set. We do not anchor stories to private residences, places of worship, schools, or other specific addresses whose precise location could harm the people associated with them. When in doubt, we anchor to the nearest landmark or city block."}'::jsonb,
  '[
    {"kind":"accepted","text":"A story anchored to Shibuya Crossing, or block 4 of Yoyogi Park."},
    {"kind":"declined","text":"A story anchored to a particular apartment building where an imagined murder takes place."}
  ]'::jsonb
),

-- ─── P7 ─────────────────────────────────────────────────────────────────────
(
  'P7', 'v0.1',
  '{"en":"Translation Fidelity","zh_CN":"翻译的忠实"}'::jsonb,
  $${"en":"Cultural-loaded phrases — idioms, honorifics, untranslatable verbs, wordplay — use our literal/transposed/explained mechanism, never silent substitution. Translators sign their work. AI translations are labeled. We run a reverse-translation review on satirical work to verify that the irony survives the journey, or is annotated where it doesn''t.","zh_CN":"文化负载词——成语、敬语、不可直译的动词、双关——使用我们的「直译/本土化/带注释」机制,而非静默替换。译者署名。AI 译本明确标记。对讽刺类作品,我们运行反向翻译审核,以验证反讽是否在翻译过程中存活,否则在标注中说明。"}$$::jsonb,
  '[
    {"kind":"accepted","text":"守株待兔 rendered as ''wait by a tree stump for a rabbit'' (literal), with ''wait for lightning to strike twice'' available at reader choice (transposed)."}
  ]'::jsonb
),

-- ─── P8 ─────────────────────────────────────────────────────────────────────
(
  'P8', 'v0.1',
  '{"en":"AI Disclosure"}'::jsonb,
  '{"en":"We do not publish fiction that has been authored or substantially revised by AI as if it were human-written. The act of imagining the story is the act that earns publication. AI translation, AI copy-editing on the language layer, and AI-assisted research are different categories — each labeled accordingly when present."}'::jsonb,
  '[]'::jsonb
),

-- ─── P9 ─────────────────────────────────────────────────────────────────────
(
  'P9', 'v0.1',
  '{"en":"Editorial Independence"}'::jsonb,
  $${"en":"No advertiser, sponsor, institutional partner, or tourism board influences which stories we publish or how they are framed. Sponsored content, when it exists, is labeled with the sponsor''s name above the headline. Tourism partnerships are disclosed in the editorial chain. We will publish work that disappoints our partners when the work earns it."}$$::jsonb,
  '[]'::jsonb
),

-- ─── P10 ────────────────────────────────────────────────────────────────────
(
  'P10', 'v0.1',
  '{"en":"This Constitution Is a Draft"}'::jsonb,
  '{"en":"What you are reading is version 0.1. We expect to be wrong about something here, and we are willing to say so. When a principle changes, the prior version remains in our public archive; every decision made under the old version remains interpretable. We commit to publishing changelogs at every revision and to soliciting public comment on proposed changes."}'::jsonb,
  '[]'::jsonb
)

ON CONFLICT ("code", "version") DO UPDATE SET
  "title_i18n" = EXCLUDED."title_i18n",
  "body_i18n"  = EXCLUDED."body_i18n",
  "examples"   = EXCLUDED."examples";

-- ─── Verification ───────────────────────────────────────────────────────────
SELECT
  code,
  version,
  title_i18n->>'en' AS title_en,
  CASE WHEN body_i18n ? 'zh_CN' THEN 'yes' ELSE 'no' END AS has_zh_CN,
  jsonb_array_length(examples) AS example_count
FROM editorial_principles
WHERE superseded_by IS NULL
ORDER BY code;

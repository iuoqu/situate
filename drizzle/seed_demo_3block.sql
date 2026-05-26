-- ════════════════════════════════════════════════════════════════════════════
-- seed_demo_3block.sql — replace the demo submission with a 3-stop story.
-- ════════════════════════════════════════════════════════════════════════════
--
-- Refreshes "出租车司机的最后一程" from a thin 2-block sketch (Shibuya →
-- Shinjuku) into a fuller ~1000-char three-act flash fiction:
--   01  Shinjuku  00:30  the passenger gets in
--   02  Shibuya   01:05  passing through the empty crossing
--   03  Asakusa   02:40  Kaminarimon, the omamori
--
-- Idempotent: DELETE narrative_blocks for this submission first (cascade
-- removes block_translations), then UPDATE the submission row and INSERT
-- the new blocks + their translations. Re-running gives you back exactly
-- the same end state.
--
-- How to use on Supabase:
--   1. Dashboard → SQL Editor → New query
--   2. Paste this file
--   3. Click Run
-- ════════════════════════════════════════════════════════════════════════════

DELETE FROM narrative_blocks
WHERE submission_id = '33333333-0000-0000-0000-000000000001';

UPDATE submissions SET
  abstract = '深夜东京。一名出租车司机接到一位说要去「明天」的乘客。从新宿到涩谷,到浅草雷门。',
  content_flags = '{"realPlaces":["Shinjuku Station","Shibuya Crossing","Asakusa Sensoji"],"realPersons":[],"realOrgs":[],"conflictZone":false}'::jsonb
WHERE id = '33333333-0000-0000-0000-000000000001';

-- ─── Narrative blocks ──────────────────────────────────────────────────────
INSERT INTO narrative_blocks (id, submission_id, event_date, location) VALUES
  ('44444444-0000-0000-0000-000000000001',
   '33333333-0000-0000-0000-000000000001',
   '2023-08-15T15:30:00Z',                                     -- 00:30 JST
   ST_SetSRID(ST_MakePoint(139.7006, 35.6896), 4326)),         -- Shinjuku
  ('44444444-0000-0000-0000-000000000002',
   '33333333-0000-0000-0000-000000000001',
   '2023-08-15T16:05:00Z',                                     -- 01:05 JST
   ST_SetSRID(ST_MakePoint(139.7005, 35.6595), 4326)),         -- Shibuya
  ('44444444-0000-0000-0000-000000000003',
   '33333333-0000-0000-0000-000000000001',
   '2023-08-15T17:40:00Z',                                     -- 02:40 JST
   ST_SetSRID(ST_MakePoint(139.7967, 35.7148), 4326));         -- Asakusa

-- ─── Translations ──────────────────────────────────────────────────────────
-- Block 1: Shinjuku
INSERT INTO block_translations (block_id, language, method, status, access_tier, content, annotations) VALUES
('44444444-0000-0000-0000-000000000001', 'zh_CN', 'original', 'published', 'free',
$$凌晨十二点半,新宿东口的出租车排了一长溜,等不到客人。第三位的司机熄了引擎,把收音机调到一个反复放老唱片的台。
过了几分钟,一个穿米色风衣的男人沿着站口的台阶走下来,径直拉开后门坐了进去。司机从反光镜里看了他一眼——胡子刚刮过,头发整齐,衬衫的领子像是熨过。男人没说话,只是看着窗外那块亮了二十年的「新宿」霓虹。
大约二十秒之后,他才开口:
「请送我去明天。」
司机愣了一下。这种夜里他什么都听过,只是没听过这一种。他没问,只是把手伸过去按下「实车」,再把车慢慢驶进青梅街道。雨刚停过,路面泛着一种闪闪的黑。$$,
$$[{"spanStart":176,"spanEnd":178,"kind":"wordplay","source":"明天","defaultRendering":"literal","renderings":{"literal":"明天","transposed":"另一个明天","explained":"明天(在中文里也是「来世」的委婉说法)"},"note":"乘客的目的地是一种委婉说法;直译保留歧义,本土化将之明示。"}]$$::jsonb),

('44444444-0000-0000-0000-000000000001', 'en', 'ai', 'published', 'free',
$$At half past midnight the line of taxis at the east exit of Shinjuku Station could not find a single passenger. The third in line cut the engine and tuned the radio to a station that played the same old records over and over.
A few minutes later a man in a beige raincoat came down the steps from the station entrance, opened the rear door, and sat down without a word. The driver glanced at him in the mirror — clean-shaven, neatly combed, the collar of his shirt pressed flat. The man did not speak; he was looking at the twenty-year-old Shinjuku neon outside the window.
After perhaps twenty seconds he said:
"Please take me to \"tomorrow\"."
The driver hesitated. On nights like this he had heard everything, but he had not heard this. He asked nothing. He reached forward and pressed the meter and eased the car into Ome-kaidō. The rain had only just stopped; the road shone an unsteady black.$$,
$$[{"spanStart":631,"spanEnd":641,"kind":"wordplay","source":"明天","defaultRendering":"literal","renderings":{"literal":"\"tomorrow\"","transposed":"the next life","explained":"\"tomorrow\" (a Chinese euphemism for the next life)"},"note":"The passenger's destination is a Chinese euphemism; literal rendering preserves the ambiguity, transposed clarifies."}]$$::jsonb),

-- Block 2: Shibuya
('44444444-0000-0000-0000-000000000002', 'zh_CN', 'original', 'published', 'free',
$$凌晨一点零五分,车穿过涩谷十字路口。
五个方向的红绿灯按部就班地变换,但路口是空的,只有他们这一辆车通过。司机想起女儿——六年前她去了巴西,刚下飞机时给他发的最后一张照片是圣保罗机场夜里的指示牌。
她要是看到此刻——空荡的十字路口、沉默的乘客、那句「送我去明天」——一定会笑的。他在反光镜里发现自己也笑了起来,只是没有声音。
后座的男人转头看了一眼窗外,什么也没说。他闭上了眼睛。$$,
'[]'::jsonb),

('44444444-0000-0000-0000-000000000002', 'en', 'ai', 'published', 'free',
$$At five past one in the morning the car crossed the Shibuya intersection.
The five-way lights cycled with their usual obedience, but the crossing was empty — only their one car passing through. The driver thought of his daughter. Six years ago she had gone to Brazil; the last photograph she had sent him, just after landing, was of the airport signage in São Paulo at night.
If she could see this — the empty crossing, the silent passenger, that strange request: "take me to tomorrow" — she would have laughed. The driver found himself smiling, in the mirror, soundlessly.
The passenger glanced once out the window and closed his eyes again.$$,
'[]'::jsonb),

-- Block 3: Asakusa
('44444444-0000-0000-0000-000000000003', 'zh_CN', 'original', 'published', 'free',
$$凌晨两点四十,车在浅草雷门前停下。
男人没说话。他从口袋里掏出一沓整齐的钞票,放在后座的皮垫上,旁边压着一个用了很久的小御守。御守的红线已经磨白,边角发亮。
「这个给您,」男人说,「我用不着了。」
他下了车,朝着雷门走去,没有回头。
司机伸手把御守翻过来,小布袋上绣着两个字——「安产」。他把它握在手里,布袋还微微温热,像还留着别人的体温。
计价器的数字还在跳。他没去按停。他坐了很久。终于明白乘客是去哪里,也终于明白「明天」是什么意思。
他没有跟过去。$$,
'[]'::jsonb),

('44444444-0000-0000-0000-000000000003', 'en', 'ai', 'published', 'free',
$$At two forty in the morning the car stopped before Asakusa's Kaminarimon.
The man said nothing. He drew a neat stack of bills from his pocket, placed them on the leather of the rear seat, and beside them set a small, well-worn omamori. The red thread of the charm had faded almost to white; its edges shone with the gloss of use.
"For you," the man said. "I won't be needing it."
He stepped out and walked toward the gate. He did not turn back.
The driver took the small charm in his hand and turned it. Embroidered on it were two characters: 安産 — safe childbirth. He held it for a while. The fabric was slightly warm, as though it still carried someone else's body heat.
The meter was still running. He did not turn it off. He sat there a long time. He understood, at last, where his passenger was going; he understood, at last, what "tomorrow" had meant.
He did not follow.$$,
'[]'::jsonb);

-- ─── Verification ──────────────────────────────────────────────────────────
SELECT
  nb.id::text AS block_id,
  ROUND(ST_X(nb.location)::numeric, 4) AS lon,
  ROUND(ST_Y(nb.location)::numeric, 4) AS lat,
  nb.event_date AT TIME ZONE 'Asia/Tokyo' AS jst,
  (SELECT count(*) FROM block_translations bt WHERE bt.block_id = nb.id) AS translations
FROM narrative_blocks nb
WHERE nb.submission_id = '33333333-0000-0000-0000-000000000001'
ORDER BY nb.sequence_number;

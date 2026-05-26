/**
 * Idempotent demo seed for local + Supabase smoke testing.
 *
 *   npm run db:seed
 *
 * Reads DATABASE_URL from the environment, wipes the editorial tables, then
 * lays down:
 *   - 3 editorial-constitution principles (P1, P2, P7) v0.1
 *   - 1 edition "After Midnight" (#1, published)
 *   - 1 zh_CN submission with 2 narrative blocks anchored in Tokyo
 *   - per block: original (zh_CN, free), AI translation (en, free),
 *     human translation (ko, premium) with a cultural annotation
 *   - then runs the bbox + access-tier viewport query as a free `en` reader
 *     and prints the result so you can eyeball it.
 */
import { sql } from "drizzle-orm";

import { db } from "../src/db";
import {
  blockTranslations,
  editions,
  editorialPrinciples,
  moderationDecisions,
  narrativeBlocks,
  reports,
  submissions,
  type CulturalAnnotation,
} from "../src/db/schema";

async function clean() {
  // Cascade deletes handle narrative_blocks → block_translations, so we only
  // need to truncate the roots.
  await db.delete(reports);
  await db.delete(moderationDecisions);
  await db.delete(submissions);
  await db.delete(editions);
  await db.delete(editorialPrinciples);
}

async function seedPrinciples() {
  await db.insert(editorialPrinciples).values([
    {
      code: "P1",
      version: "v0.1",
      titleI18n: {
        en: "Place as Inhabited Space",
        zh_CN: "地点即栖居者的空间",
      },
      bodyI18n: {
        en:
          "A story set in a real location must treat that place as inhabited by real people whose dignity is at stake. We do not publish work that reduces a place to a stereotype, a backdrop, or a punchline.",
        zh_CN:
          "以真实地点为背景的小说,必须把该地点视为有血有肉者所栖居之处。我们不发表把地点简化为刻板印象、布景或笑料的作品。",
      },
    },
    {
      code: "P2",
      version: "v0.1",
      titleI18n: {
        en: "Specificity over Category",
        zh_CN: "具体优先于类别",
      },
      bodyI18n: {
        en:
          "We publish fiction that names specific real places. We do not publish fiction whose argument is 'people in [X] are [negative characteristic].' Specificity earns its place through individuality, not category.",
        zh_CN:
          "我们发表写明真实地名的虚构作品。我们不发表论点为「[X 地]人都是[某种负面特征]」的作品。具体性通过个体获得正当性,而不是类别。",
      },
      examples: [
        {
          kind: "accepted",
          text:
            "A 1,200-word story about one shoe-seller in modern Zhengzhou whose obsession with rulebooks costs him a sale.",
        },
        {
          kind: "declined",
          text:
            "A sketch portraying Zhengzhou residents collectively as inflexible bureaucrats.",
        },
      ],
    },
    {
      code: "P7",
      version: "v0.1",
      titleI18n: {
        en: "Translation Fidelity",
        zh_CN: "翻译的忠实",
      },
      bodyI18n: {
        en:
          "Cultural-loaded phrases use the literal/transposed/explained mechanism rather than silent substitution. Translators sign their rows; AI translations are clearly marked. Reverse-translation review verifies that satire survives or is annotated when it doesn't.",
        zh_CN:
          "文化负载词使用「直译/本土化/带注释」机制,而非静默替换。译者署名;AI 译本明确标记。反向翻译审核用以验证讽刺是否在译文中存活,否则加注。",
      },
    },
  ]);
}

async function seedEdition() {
  const [edition] = await db
    .insert(editions)
    .values({
      slug: "issue-1-after-midnight",
      title: "After Midnight",
      theme: "Stories set between midnight and dawn",
      editorsLetter:
        "Welcome to the first issue of Situate Editions. We open after midnight — the hour when cities reveal who they really are. Six writers across five languages take you from a Tokyo taxi stand to a Seoul convenience store, a São Paulo bus terminal, a Reykjavík fishing pier. The map is a clock; each pin is a moment that could only have happened there, then.",
      coverImageUrl:
        "https://images.example.com/situate/issues/1/cover.jpg",
      publishAt: new Date(),
      status: "published",
    })
    .returning();
  return edition;
}

async function seedSubmission(editionId: string) {
  const [submission] = await db
    .insert(submissions)
    .values({
      authorId: "author_kawakami",
      title: "出租车司机的最后一程",
      abstract: "深夜东京,一名出租车司机接到一位说要去明天的乘客。",
      sourceLanguage: "zh_CN",
      status: "published",
      editionId,
      positionInEdition: 1,
      contentFlags: {
        realPlaces: ["Shibuya Crossing", "Shinjuku Station"],
        realPersons: [],
        realOrgs: [],
        conflictZone: false,
      },
      authorAffiliations: ["lived:Tokyo:2010-2020"],
      satireDisclosure: false,
      sensitivityWarnings: [],
    })
    .returning();
  return submission;
}

async function seedBlocks(submissionId: string) {
  // Shibuya Crossing
  const [block1] = await db
    .insert(narrativeBlocks)
    .values({
      submissionId,
      eventDate: new Date("2023-08-15T14:30:00Z"), // 23:30 JST
      location: { x: 139.7005, y: 35.6595 },
    })
    .returning();

  // Shinjuku Station (the "destination")
  const [block2] = await db
    .insert(narrativeBlocks)
    .values({
      submissionId,
      eventDate: new Date("2023-08-15T15:45:00Z"), // 00:45 JST next day
      location: { x: 139.7006, y: 35.6896 },
    })
    .returning();

  return [block1, block2] as const;
}

async function seedTranslations(blockIds: readonly [string, string]) {
  // Demonstrate annotations: 明天 ("tomorrow") used metaphorically. Three
  // renderings let the reader pick literal / transposed / explained.
  const block2Annotations: CulturalAnnotation[] = [
    {
      spanStart: 22,
      spanEnd: 32,
      kind: "wordplay",
      source: "明天",
      defaultRendering: "literal",
      renderings: {
        literal: '"tomorrow"',
        transposed: "the next life",
        explained: '"tomorrow" (a colloquial euphemism for "the next life")',
      },
      note: "The passenger's destination is a Chinese euphemism; literal rendering preserves the ambiguity, transposed clarifies.",
    },
  ];

  await db.insert(blockTranslations).values([
    // ─── Block 1 (Shibuya) ───
    {
      blockId: blockIds[0],
      language: "zh_CN",
      method: "original",
      status: "published",
      accessTier: "free",
      content:
        "凌晨两点的涩谷十字路口空荡得像被遗忘的剧场。司机熄了引擎,等最后一位乘客。",
    },
    {
      blockId: blockIds[0],
      language: "en",
      method: "ai",
      status: "published",
      accessTier: "free",
      content:
        "At two in the morning the Shibuya Crossing felt as empty as a theater everyone had forgotten. The driver killed the engine and waited for his last passenger.",
    },
    {
      blockId: blockIds[0],
      language: "ko",
      method: "human",
      status: "published",
      accessTier: "premium",
      translatorId: "translator_park_jihye",
      content:
        "새벽 두 시의 시부야 횡단보도는 모두가 잊어버린 극장처럼 텅 비어 있었다. 운전사는 엔진을 끄고 마지막 손님을 기다렸다.",
    },
    // ─── Block 2 (Shinjuku) ───
    {
      blockId: blockIds[1],
      language: "zh_CN",
      method: "original",
      status: "published",
      accessTier: "free",
      content:
        "乘客上车时只说一句:请送我去明天。司机看了他一眼,默默打了表。",
      annotations: block2Annotations,
    },
    {
      blockId: blockIds[1],
      language: "en",
      method: "ai",
      status: "published",
      accessTier: "free",
      content:
        'When the passenger got in he said only this: please take me to "tomorrow". The driver glanced at him and quietly started the meter.',
      annotations: block2Annotations,
    },
  ]);
}

async function runViewportProbe() {
  // Tokyo bbox covering both Shibuya and Shinjuku. As a free 'en' reader.
  const result = await db.execute<{
    block_id: string;
    lon: number;
    lat: number;
    language: string;
    method: string;
    content: string;
    access_tier: string;
  }>(sql`
    SELECT DISTINCT ON (nb.id)
      nb.id                AS block_id,
      ST_X(nb.location)    AS lon,
      ST_Y(nb.location)    AS lat,
      bt.language          AS language,
      bt.method            AS method,
      bt.content           AS content,
      bt.access_tier       AS access_tier
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
          END <= 0
    ORDER BY
      nb.id,
      CASE
        WHEN bt.language = 'en' AND bt.method = 'human'          THEN 1
        WHEN bt.language = 'en' AND bt.method = 'ai_post_edited' THEN 2
        WHEN bt.language = 'en' AND bt.method = 'ai'             THEN 3
        WHEN bt.method = 'original'                              THEN 4
        ELSE 5
      END
  `);
  return result;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  console.log("→ cleaning previous demo data");
  await clean();

  console.log("→ seeding editorial constitution (3 principles)");
  await seedPrinciples();

  console.log("→ seeding Issue #1 'After Midnight'");
  const edition = await seedEdition();
  console.log(`  edition.id = ${edition.id}, number = #${edition.number}`);

  console.log("→ seeding 1 submission, 2 blocks, 5 translation rows");
  const submission = await seedSubmission(edition.id);
  const blocks = await seedBlocks(submission.id);
  await seedTranslations([blocks[0].id, blocks[1].id]);

  console.log("\n→ viewport probe: Tokyo bbox as free 'en' reader");
  const rows = await runViewportProbe();
  for (const r of rows) {
    console.log(
      `  [${r.method.padEnd(14)} ${r.language}] (${r.lon.toFixed(4)}, ${r.lat.toFixed(4)}) ${r.access_tier}: ${r.content}`,
    );
  }
  console.log(`\n✓ seed complete — ${rows.length} block(s) visible.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("seed failed:", err);
  process.exit(1);
});

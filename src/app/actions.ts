"use server";

import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  blockTranslations,
  narrativeBlocks,
  submissions,
  type BlockTranslation,
  type CulturalAnnotation,
  type CulturalRendering,
  type NarrativeBlock,
  type SupportedLanguage,
  type TranslationMethod,
  type TranslationStatus,
} from "@/db/schema";

export interface CreateNarrativeBlockInput {
  submissionId: string;
  eventDate: Date;
  longitude: number;
  latitude: number;
  content: string;
  /**
   * Optional override of the submission's source language. Defaults to the
   * value stored on `submissions.source_language`.
   */
  sourceLanguage?: SupportedLanguage;
  annotations?: CulturalAnnotation[];
}

/**
 * Insert a new narrative block AND its `method='original'` translation row in a
 * single transaction. Location uses Drizzle's `{ x, y }` geometry syntax.
 */
export async function createNarrativeBlock(
  input: CreateNarrativeBlockInput,
): Promise<{ block: NarrativeBlock; original: BlockTranslation }> {
  const {
    submissionId,
    eventDate,
    longitude,
    latitude,
    content,
    sourceLanguage,
    annotations = [],
  } = input;

  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error("longitude must be a finite number in [-180, 180]");
  }
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error("latitude must be a finite number in [-90, 90]");
  }

  return db.transaction(async (tx) => {
    let language = sourceLanguage;
    if (!language) {
      const [parent] = await tx
        .select({ sourceLanguage: submissions.sourceLanguage })
        .from(submissions)
        .where(eq(submissions.id, submissionId))
        .limit(1);
      if (!parent) {
        throw new Error(`submission ${submissionId} not found`);
      }
      language = parent.sourceLanguage;
    }

    const [block] = await tx
      .insert(narrativeBlocks)
      .values({
        submissionId,
        eventDate,
        location: { x: longitude, y: latitude },
      })
      .returning();

    const [original] = await tx
      .insert(blockTranslations)
      .values({
        blockId: block.id,
        language,
        method: "original",
        status: "published",
        content,
        annotations,
      })
      .returning();

    return { block, original };
  });
}

export interface AddTranslationInput {
  blockId: string;
  language: SupportedLanguage;
  method: Exclude<TranslationMethod, "original">;
  content: string;
  annotations?: CulturalAnnotation[];
  translatorId?: string;
  isPremium?: boolean;
  status?: TranslationStatus;
}

/**
 * Upsert an AI or human translation for an existing block. Uniqueness is on
 * (block_id, language, method) — re-running the AI translator overwrites the
 * previous AI row in place; the human row is kept separate.
 */
export async function addTranslation(
  input: AddTranslationInput,
): Promise<BlockTranslation> {
  const isHuman = input.method === "human";
  const defaultStatus: TranslationStatus = isHuman ? "in_review" : "ai_generated";

  const [row] = await db
    .insert(blockTranslations)
    .values({
      blockId: input.blockId,
      language: input.language,
      method: input.method,
      content: input.content,
      annotations: input.annotations ?? [],
      translatorId: input.translatorId,
      isPremium: input.isPremium ?? isHuman,
      status: input.status ?? defaultStatus,
    })
    .onConflictDoUpdate({
      target: [
        blockTranslations.blockId,
        blockTranslations.language,
        blockTranslations.method,
      ],
      set: {
        content: input.content,
        annotations: input.annotations ?? [],
        translatorId: input.translatorId,
        isPremium: input.isPremium ?? isHuman,
        status: input.status ?? defaultStatus,
        updatedAt: sql`now()`,
      },
    })
    .returning();

  return row;
}

export interface BoundingBox {
  minLong: number;
  minLat: number;
  maxLong: number;
  maxLat: number;
}

export interface ViewportBlock {
  blockId: string;
  submissionId: string;
  sequenceNumber: number;
  eventDate: Date | null;
  longitude: number;
  latitude: number;
  language: SupportedLanguage;
  method: TranslationMethod;
  content: string;
  annotations: CulturalAnnotation[];
  isPremium: boolean;
}

export interface ViewportQueryOptions {
  readerLanguage: SupportedLanguage;
  /** When false (default), premium / paywalled translations are excluded. */
  includePremium?: boolean;
  submissionId?: string;
  limit?: number;
}

/**
 * Return one row per narrative block intersecting the viewport, picking the
 * best available published translation for the reader's language using this
 * priority:
 *   1. human translation in reader_language
 *   2. ai_post_edited in reader_language
 *   3. ai in reader_language
 *   4. original (in the piece's source language)
 *
 * Coordinates are bound through Drizzle's `sql` tagged template — no string
 * interpolation — so this is safe against injection.
 */
export async function getNarrativeBlocksInBoundingBox(
  bbox: BoundingBox,
  options: ViewportQueryOptions,
): Promise<ViewportBlock[]> {
  for (const [name, value] of Object.entries(bbox)) {
    if (!Number.isFinite(value)) {
      throw new Error(`bounding box value '${name}' must be a finite number`);
    }
  }
  const { minLong, minLat, maxLong, maxLat } = bbox;
  const { readerLanguage, includePremium = false, submissionId, limit } = options;

  const envelope = sql`ST_MakeEnvelope(${minLong}, ${minLat}, ${maxLong}, ${maxLat}, 4326)`;

  const priority = sql`
    CASE
      WHEN ${blockTranslations.language} = ${readerLanguage}
           AND ${blockTranslations.method} = 'human'          THEN 1
      WHEN ${blockTranslations.language} = ${readerLanguage}
           AND ${blockTranslations.method} = 'ai_post_edited' THEN 2
      WHEN ${blockTranslations.language} = ${readerLanguage}
           AND ${blockTranslations.method} = 'ai'             THEN 3
      WHEN ${blockTranslations.method} = 'original'           THEN 4
      ELSE 5
    END
  `;

  const premiumFilter = includePremium
    ? sql`TRUE`
    : sql`${blockTranslations.isPremium} = FALSE`;

  const submissionFilter = submissionId
    ? sql`AND ${narrativeBlocks.submissionId} = ${submissionId}`
    : sql``;

  const limitClause = limit ? sql`LIMIT ${limit}` : sql``;

  const rows = await db.execute<{
    block_id: string;
    submission_id: string;
    sequence_number: number;
    event_date: Date | null;
    longitude: number;
    latitude: number;
    language: SupportedLanguage;
    method: TranslationMethod;
    content: string;
    annotations: CulturalAnnotation[] | null;
    is_premium: boolean;
  }>(sql`
    SELECT DISTINCT ON (${narrativeBlocks.id})
      ${narrativeBlocks.id}             AS block_id,
      ${narrativeBlocks.submissionId}   AS submission_id,
      ${narrativeBlocks.sequenceNumber} AS sequence_number,
      ${narrativeBlocks.eventDate}      AS event_date,
      ST_X(${narrativeBlocks.location}) AS longitude,
      ST_Y(${narrativeBlocks.location}) AS latitude,
      ${blockTranslations.language}     AS language,
      ${blockTranslations.method}       AS method,
      ${blockTranslations.content}      AS content,
      ${blockTranslations.annotations}  AS annotations,
      ${blockTranslations.isPremium}    AS is_premium
    FROM ${narrativeBlocks}
    INNER JOIN ${blockTranslations}
      ON ${blockTranslations.blockId} = ${narrativeBlocks.id}
    WHERE
      ${narrativeBlocks.location} IS NOT NULL
      AND ST_Intersects(${narrativeBlocks.location}, ${envelope})
      AND ${blockTranslations.status} = 'published'
      AND (
        ${blockTranslations.language} = ${readerLanguage}
        OR ${blockTranslations.method} = 'original'
      )
      AND ${premiumFilter}
      ${submissionFilter}
    ORDER BY
      ${narrativeBlocks.id},
      ${priority}
    ${limitClause}
  `);

  return rows.map((r) => ({
    blockId: r.block_id,
    submissionId: r.submission_id,
    sequenceNumber: r.sequence_number,
    eventDate: r.event_date,
    longitude: Number(r.longitude),
    latitude: Number(r.latitude),
    language: r.language,
    method: r.method,
    content: r.content,
    annotations: r.annotations ?? [],
    isPremium: r.is_premium,
  }));
}

/**
 * Apply a reader's cultural-rendering preference to a stored translation.
 * `content` is the canonical default rendering; spans in `annotations` point
 * into that string. Substitutions are applied right-to-left so earlier spans'
 * indices remain valid.
 *
 * Pure function — safe to call in client components.
 */
export function renderTranslation(
  content: string,
  annotations: CulturalAnnotation[],
  preference: CulturalRendering,
): string {
  if (annotations.length === 0) return content;

  const sorted = [...annotations].sort((a, b) => b.spanStart - a.spanStart);
  let out = content;
  for (const ann of sorted) {
    const rendering =
      ann.renderings[preference] ?? ann.renderings[ann.defaultRendering];
    if (rendering === undefined) continue;
    out = out.slice(0, ann.spanStart) + rendering + out.slice(ann.spanEnd);
  }
  return out;
}

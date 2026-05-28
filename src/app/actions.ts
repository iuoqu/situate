"use server";

import { and, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { evaluateSubmission } from "@/lib/ai-editor/engine";
import type { JudgmentSubmission, SubmissionReport } from "@/lib/ai-editor/types";
import {
  blockTranslations,
  editions,
  editorialPrinciples,
  moderationDecisions,
  narrativeBlocks,
  principleJudgments,
  reports,
  storyDrafts,
  submissions,
  type DraftSection,
  type AiUsageLabel,
  type AuthorRelationship,
  type BlockTranslation,
  type ConsentStatus,
  type CulturalAnnotation,
  type Edition,
  type EditorialPrinciple,
  type FlaggedEntity,
  type ModerationDecisionRow,
  type ModerationDecisionValue,
  type ModerationLayer,
  type NarrativeBlock,
  type PrincipleExample,
  type PrincipleJudgmentRow,
  type Report,
  type ReportCategory,
  type StoryType,
  type Submission,
  type SubmissionStatus,
  type SupportedLanguage,
  type TranslationAccessTier,
  type TranslationMethod,
  type TranslationStatus,
} from "@/db/schema";

// ─── Editions ───────────────────────────────────────────────────────────────

export interface CreateEditionInput {
  slug: string;
  title: string;
  theme?: string;
  editorsLetter?: string;
  coverImageUrl?: string;
  publishAt?: Date;
}

/**
 * Create a new edition in `planning` status. The CHECK constraint allows
 * editor's letter / cover / publish date to be filled in later, but they
 * must all be present before `publishEdition()` will succeed.
 */
export async function createEdition(
  input: CreateEditionInput,
): Promise<Edition> {
  const [row] = await db
    .insert(editions)
    .values({
      slug: input.slug,
      title: input.title,
      theme: input.theme,
      editorsLetter: input.editorsLetter,
      coverImageUrl: input.coverImageUrl,
      publishAt: input.publishAt,
    })
    .returning();
  return row;
}

export type UpdateEditionPatch = Partial<
  Pick<
    Edition,
    "slug" | "title" | "theme" | "editorsLetter" | "coverImageUrl" | "publishAt"
  >
>;

export async function updateEdition(
  id: string,
  patch: UpdateEditionPatch,
): Promise<Edition> {
  const [row] = await db
    .update(editions)
    .set(patch)
    .where(eq(editions.id, id))
    .returning();
  if (!row) throw new Error(`edition ${id} not found`);
  return row;
}

export interface AssignSubmissionToEditionInput {
  submissionId: string;
  editionId: string;
  positionInEdition: number;
}

export async function assignSubmissionToEdition(
  input: AssignSubmissionToEditionInput,
): Promise<Submission> {
  if (!Number.isInteger(input.positionInEdition) || input.positionInEdition < 1) {
    throw new Error("positionInEdition must be a positive integer");
  }
  const [row] = await db
    .update(submissions)
    .set({
      editionId: input.editionId,
      positionInEdition: input.positionInEdition,
    })
    .where(eq(submissions.id, input.submissionId))
    .returning();
  if (!row) throw new Error(`submission ${input.submissionId} not found`);
  return row;
}

/**
 * Unassign a submission from its issue, leaving it as "evergreen" content.
 */
export async function unassignSubmissionFromEdition(
  submissionId: string,
): Promise<Submission> {
  const [row] = await db
    .update(submissions)
    .set({ editionId: null, positionInEdition: null })
    .where(eq(submissions.id, submissionId))
    .returning();
  if (!row) throw new Error(`submission ${submissionId} not found`);
  return row;
}

/**
 * Lock contents and schedule an edition for publication. Validates that the
 * issue has an editor's letter, cover image, and a publish date, and that at
 * least one submission is assigned. Doesn't flip individual submissions'
 * editorial status — that's the moderation pipeline's job.
 */
export async function scheduleEdition(editionId: string): Promise<Edition> {
  return db.transaction(async (tx) => {
    const [edition] = await tx
      .select()
      .from(editions)
      .where(eq(editions.id, editionId))
      .limit(1);
    if (!edition) throw new Error(`edition ${editionId} not found`);
    if (!edition.editorsLetter)
      throw new Error("editor's letter is required before scheduling");
    if (!edition.coverImageUrl)
      throw new Error("cover image is required before scheduling");
    if (!edition.publishAt)
      throw new Error("publish_at is required before scheduling");

    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(submissions)
      .where(eq(submissions.editionId, editionId));
    if (count < 1) {
      throw new Error("at least one submission must be assigned before scheduling");
    }

    const [updated] = await tx
      .update(editions)
      .set({ status: "scheduled" })
      .where(eq(editions.id, editionId))
      .returning();
    return updated;
  });
}

/**
 * Flip an edition to `published`. Idempotent; if already published, returns
 * the existing row.
 */
export async function publishEdition(editionId: string): Promise<Edition> {
  return db.transaction(async (tx) => {
    const [edition] = await tx
      .select()
      .from(editions)
      .where(eq(editions.id, editionId))
      .limit(1);
    if (!edition) throw new Error(`edition ${editionId} not found`);
    if (edition.status === "published") return edition;
    if (!edition.editorsLetter || !edition.coverImageUrl) {
      throw new Error(
        "edition is missing editor's letter or cover image; cannot publish",
      );
    }
    const publishAt = edition.publishAt ?? new Date();
    const [updated] = await tx
      .update(editions)
      .set({ status: "published", publishAt })
      .where(eq(editions.id, editionId))
      .returning();
    return updated;
  });
}

// ─── Narrative block insertion ──────────────────────────────────────────────

export interface CreateNarrativeBlockInput {
  submissionId: string;
  eventDate: Date;
  longitude: number;
  latitude: number;
  content: string;
  /** Override the parent submission's `source_language`. */
  sourceLanguage?: SupportedLanguage;
  annotations?: CulturalAnnotation[];
}

/**
 * Insert a new narrative block AND its `method='original'` translation row in a
 * single transaction. Location uses Drizzle's `{ x, y }` geometry syntax.
 * The original row is always `accessTier='free'` and `status='published'`.
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
        accessTier: "free",
      })
      .returning();

    return { block, original };
  });
}

// ─── Translation upsert ─────────────────────────────────────────────────────

// Method → default access tier (overridable per call).
//   ai             → free       (always open)
//   ai_post_edited → metered    (free, but quota-limited app-side)
//   human          → premium    (paywalled)
const DEFAULT_ACCESS_TIER: Record<
  Exclude<TranslationMethod, "original">,
  TranslationAccessTier
> = {
  ai: "free",
  ai_post_edited: "metered",
  human: "premium",
};

const DEFAULT_TRANSLATION_STATUS: Record<
  Exclude<TranslationMethod, "original">,
  TranslationStatus
> = {
  ai: "ai_generated",
  ai_post_edited: "in_review",
  human: "in_review",
};

export interface AddTranslationInput {
  blockId: string;
  language: SupportedLanguage;
  method: Exclude<TranslationMethod, "original">;
  content: string;
  annotations?: CulturalAnnotation[];
  translatorId?: string;
  accessTier?: TranslationAccessTier;
  status?: TranslationStatus;
}

export async function addTranslation(
  input: AddTranslationInput,
): Promise<BlockTranslation> {
  const accessTier = input.accessTier ?? DEFAULT_ACCESS_TIER[input.method];
  const status = input.status ?? DEFAULT_TRANSLATION_STATUS[input.method];

  const [row] = await db
    .insert(blockTranslations)
    .values({
      blockId: input.blockId,
      language: input.language,
      method: input.method,
      content: input.content,
      annotations: input.annotations ?? [],
      translatorId: input.translatorId,
      accessTier,
      status,
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
        accessTier,
        status,
        updatedAt: sql`now()`,
      },
    })
    .returning();

  return row;
}

// ─── Viewport query ─────────────────────────────────────────────────────────

export interface BoundingBox {
  minLong: number;
  minLat: number;
  maxLong: number;
  maxLat: number;
}

export interface ViewportBlock {
  blockId: string;
  submissionId: string;
  editionId: string | null;
  sequenceNumber: number;
  eventDate: Date | null;
  longitude: number;
  latitude: number;
  language: SupportedLanguage;
  method: TranslationMethod;
  content: string;
  annotations: CulturalAnnotation[];
  accessTier: TranslationAccessTier;
}

export type ReaderAccessLevel = "free" | "metered" | "premium";

const ACCESS_LEVEL_ORDER: Record<ReaderAccessLevel, number> = {
  free: 0,
  metered: 1,
  premium: 2,
};

export interface ViewportQueryOptions {
  readerLanguage: SupportedLanguage;
  accessLevel?: ReaderAccessLevel;
  submissionId?: string;
  /** Restrict to a specific issue (e.g. "browse Issue #12"). */
  editionId?: string;
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
 * Visibility gates (all must pass):
 *   - block has a location and intersects the bbox
 *   - submission.status = 'published'
 *   - submission.edition_id IS NULL OR its edition.status = 'published'
 *   - chosen translation has status='published' and access_tier ≤ reader's level
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
  const {
    readerLanguage,
    accessLevel = "free",
    submissionId,
    editionId,
    limit,
  } = options;

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

  const accessFilter = sql`
    CASE ${blockTranslations.accessTier}
      WHEN 'free'    THEN 0
      WHEN 'metered' THEN 1
      WHEN 'premium' THEN 2
    END <= ${ACCESS_LEVEL_ORDER[accessLevel]}
  `;

  const submissionFilter = submissionId
    ? sql`AND ${submissions.id} = ${submissionId}`
    : sql``;

  const editionFilter = editionId
    ? sql`AND ${submissions.editionId} = ${editionId}`
    : sql``;

  const limitClause = limit ? sql`LIMIT ${limit}` : sql``;

  const rows = await db.execute<{
    block_id: string;
    submission_id: string;
    edition_id: string | null;
    sequence_number: number;
    event_date: Date | null;
    longitude: number;
    latitude: number;
    language: SupportedLanguage;
    method: TranslationMethod;
    content: string;
    annotations: CulturalAnnotation[] | null;
    access_tier: TranslationAccessTier;
  }>(sql`
    SELECT DISTINCT ON (${narrativeBlocks.id})
      ${narrativeBlocks.id}             AS block_id,
      ${narrativeBlocks.submissionId}   AS submission_id,
      ${submissions.editionId}          AS edition_id,
      ${narrativeBlocks.sequenceNumber} AS sequence_number,
      ${narrativeBlocks.eventDate}      AS event_date,
      ST_X(${narrativeBlocks.location}) AS longitude,
      ST_Y(${narrativeBlocks.location}) AS latitude,
      ${blockTranslations.language}     AS language,
      ${blockTranslations.method}       AS method,
      ${blockTranslations.content}      AS content,
      ${blockTranslations.annotations}  AS annotations,
      ${blockTranslations.accessTier}   AS access_tier
    FROM ${narrativeBlocks}
    INNER JOIN ${submissions}
      ON ${submissions.id} = ${narrativeBlocks.submissionId}
    INNER JOIN ${blockTranslations}
      ON ${blockTranslations.blockId} = ${narrativeBlocks.id}
    LEFT JOIN ${editions}
      ON ${editions.id} = ${submissions.editionId}
    WHERE
      ${narrativeBlocks.location} IS NOT NULL
      AND ST_Intersects(${narrativeBlocks.location}, ${envelope})
      AND ${submissions.status} = 'published'
      AND (${submissions.editionId} IS NULL OR ${editions.status} = 'published')
      AND ${blockTranslations.status} = 'published'
      AND (
        ${blockTranslations.language} = ${readerLanguage}
        OR ${blockTranslations.method} = 'original'
      )
      AND ${accessFilter}
      ${submissionFilter}
      ${editionFilter}
    ORDER BY
      ${narrativeBlocks.id},
      ${priority}
    ${limitClause}
  `);

  return rows.map((r) => ({
    blockId: r.block_id,
    submissionId: r.submission_id,
    editionId: r.edition_id,
    sequenceNumber: r.sequence_number,
    eventDate: r.event_date,
    longitude: Number(r.longitude),
    latitude: Number(r.latitude),
    language: r.language,
    method: r.method,
    content: r.content,
    annotations: r.annotations ?? [],
    accessTier: r.access_tier,
  }));
}

// ─── Moderation ─────────────────────────────────────────────────────────────

export interface RecordModerationDecisionInput {
  submissionId: string;
  layer: ModerationLayer;
  decision: ModerationDecisionValue;
  reviewerId?: string;
  rationale?: string;
  flaggedEntities?: FlaggedEntity[];
  /**
   * Editorial-constitution principles cited, e.g. ["P2:v0.1", "P7:v0.1"].
   * Stored verbatim as a snapshot so the audit log survives later edits.
   */
  citedPrinciples?: string[];
  /**
   * Optional: advance the submission's editorial status in the same
   * transaction. Typical mapping:
   *   ai/approve              → 'human_review'
   *   ai/reject               → 'draft' (returned to author)
   *   human/approve           → 'published'
   *   human/reject            → 'draft'
   *   human/request_changes   → 'draft'
   */
  advanceSubmissionStatusTo?: SubmissionStatus;
}

export async function recordModerationDecision(
  input: RecordModerationDecisionInput,
): Promise<ModerationDecisionRow> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(moderationDecisions)
      .values({
        submissionId: input.submissionId,
        layer: input.layer,
        decision: input.decision,
        reviewerId: input.reviewerId,
        rationale: input.rationale,
        flaggedEntities: input.flaggedEntities ?? [],
        citedPrinciples: input.citedPrinciples ?? [],
      })
      .returning();

    if (input.advanceSubmissionStatusTo) {
      await tx
        .update(submissions)
        .set({ status: input.advanceSubmissionStatusTo })
        .where(eq(submissions.id, input.submissionId));
    }
    return row;
  });
}

// ─── Reader reports ─────────────────────────────────────────────────────────

export interface FileReportInput {
  submissionId: string;
  category: ReportCategory;
  /** BCP-47 locale, e.g. "de-DE" — used by ops to route by jurisdiction. */
  locale: string;
  body?: string;
  reporterId?: string;
}

export async function fileReport(input: FileReportInput): Promise<Report> {
  const [row] = await db
    .insert(reports)
    .values({
      submissionId: input.submissionId,
      category: input.category,
      locale: input.locale,
      body: input.body,
      reporterId: input.reporterId,
    })
    .returning();
  return row;
}

// ─── Editorial Constitution ─────────────────────────────────────────────────

export interface PublishPrincipleInput {
  code: string;                            // "P2"
  version: string;                         // "v0.1"
  titleI18n: Partial<Record<SupportedLanguage, string>>;
  bodyI18n: Partial<Record<SupportedLanguage, string>>;
  examples?: PrincipleExample[];
  effectiveAt?: Date;
  /**
   * If supplied, marks an existing principle row as superseded by the new
   * one in the same transaction. Pass the *id* of the row being replaced.
   */
  supersedes?: string;
}

/**
 * Publish a new version of an editorial principle. When `supersedes` is
 * provided, the prior row is marked superseded in the same transaction so
 * a reader querying "current constitution" always gets a coherent snapshot.
 */
export async function publishPrinciple(
  input: PublishPrincipleInput,
): Promise<EditorialPrinciple> {
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(editorialPrinciples)
      .values({
        code: input.code,
        version: input.version,
        titleI18n: input.titleI18n,
        bodyI18n: input.bodyI18n,
        examples: input.examples ?? [],
        effectiveAt: input.effectiveAt ?? new Date(),
      })
      .returning();

    if (input.supersedes) {
      await tx
        .update(editorialPrinciples)
        .set({ supersededBy: created.id, supersededAt: new Date() })
        .where(eq(editorialPrinciples.id, input.supersedes));
    }
    return created;
  });
}

/**
 * Return the active editorial constitution — one row per principle code, in
 * numeric code order (P1, P2, … P9, P10, P11, …). Active = not superseded.
 * We sort by the integer suffix, not the raw code string, so P10 sits after
 * P9 instead of between P1 and P2.
 */
export async function getActivePrinciples(): Promise<EditorialPrinciple[]> {
  return db
    .select()
    .from(editorialPrinciples)
    .where(isNull(editorialPrinciples.supersededBy))
    .orderBy(sql`(substring(${editorialPrinciples.code} from 2))::int`);
}

/**
 * Return a specific principle version verbatim — used by the audit-log
 * rendering to show readers exactly which version of P2 was cited when a
 * particular submission was decided.
 */
export async function getPrincipleVersion(
  code: string,
  version: string,
): Promise<EditorialPrinciple | null> {
  const [row] = await db
    .select()
    .from(editorialPrinciples)
    .where(
      and(
        eq(editorialPrinciples.code, code),
        eq(editorialPrinciples.version, version),
      ),
    )
    .limit(1);
  return row ?? null;
}

// ─── Single-submission read for permalink pages ─────────────────────────────

export interface SubmissionDetail {
  submission: Submission;
  edition: Edition | null;
  blocks: ViewportBlock[];
}

/**
 * Fetch one submission's full story, with its blocks resolved to the best
 * available translation for the reader. Used by `/stories/[id]` and the
 * back-end of `/editions/[slug]`. Returns null if the submission doesn't
 * exist or isn't visible at the reader's access level (so 404 logic is
 * handled in the page).
 */
export async function getSubmissionForReader(
  submissionId: string,
  options: {
    readerLanguage: SupportedLanguage;
    accessLevel?: ReaderAccessLevel;
  },
): Promise<SubmissionDetail | null> {
  const { readerLanguage, accessLevel = "free" } = options;

  const [row] = await db
    .select()
    .from(submissions)
    .where(eq(submissions.id, submissionId))
    .limit(1);
  if (!row) return null;
  if (row.status !== "published") return null;

  let edition: Edition | null = null;
  if (row.editionId) {
    const [e] = await db
      .select()
      .from(editions)
      .where(eq(editions.id, row.editionId))
      .limit(1);
    if (!e || e.status !== "published") return null;
    edition = e;
  }

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
  const accessFilter = sql`
    CASE ${blockTranslations.accessTier}
      WHEN 'free' THEN 0 WHEN 'metered' THEN 1 WHEN 'premium' THEN 2
    END <= ${ACCESS_LEVEL_ORDER[accessLevel]}
  `;

  const blockRows = await db.execute<{
    block_id: string;
    sequence_number: number;
    event_date: Date | null;
    longitude: number;
    latitude: number;
    language: SupportedLanguage;
    method: TranslationMethod;
    content: string;
    annotations: CulturalAnnotation[] | null;
    access_tier: TranslationAccessTier;
  }>(sql`
    SELECT DISTINCT ON (${narrativeBlocks.id})
      ${narrativeBlocks.id}             AS block_id,
      ${narrativeBlocks.sequenceNumber} AS sequence_number,
      ${narrativeBlocks.eventDate}      AS event_date,
      ST_X(${narrativeBlocks.location}) AS longitude,
      ST_Y(${narrativeBlocks.location}) AS latitude,
      ${blockTranslations.language}     AS language,
      ${blockTranslations.method}       AS method,
      ${blockTranslations.content}      AS content,
      ${blockTranslations.annotations}  AS annotations,
      ${blockTranslations.accessTier}   AS access_tier
    FROM ${narrativeBlocks}
    INNER JOIN ${blockTranslations}
      ON ${blockTranslations.blockId} = ${narrativeBlocks.id}
    WHERE
      ${narrativeBlocks.submissionId} = ${submissionId}
      AND ${blockTranslations.status} = 'published'
      AND (
        ${blockTranslations.language} = ${readerLanguage}
        OR ${blockTranslations.method} = 'original'
      )
      AND ${accessFilter}
    ORDER BY
      ${narrativeBlocks.id},
      ${priority}
  `);

  // Re-sort the rows we got by the block's sequence_number — DISTINCT ON gave
  // us one row per block but in block-id order, not narrative order.
  const blocks: ViewportBlock[] = blockRows
    .map((r) => ({
      blockId: r.block_id,
      submissionId,
      editionId: row.editionId,
      sequenceNumber: r.sequence_number,
      eventDate: r.event_date,
      longitude: Number(r.longitude),
      latitude: Number(r.latitude),
      language: r.language,
      method: r.method,
      content: r.content,
      annotations: r.annotations ?? [],
      accessTier: r.access_tier,
    }))
    .sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  return { submission: row, edition, blocks };
}

// ─── Edition read (for /editions/[slug]) ────────────────────────────────────

export interface EditionWithPieces {
  edition: Edition;
  pieces: { submission: Submission; firstBlock: ViewportBlock | null }[];
}

export async function getEditionBySlug(
  slug: string,
  options: {
    readerLanguage: SupportedLanguage;
    accessLevel?: ReaderAccessLevel;
  },
): Promise<EditionWithPieces | null> {
  const [edition] = await db
    .select()
    .from(editions)
    .where(eq(editions.slug, slug))
    .limit(1);
  if (!edition || edition.status !== "published") return null;

  const pieceSubmissions = await db
    .select()
    .from(submissions)
    .where(
      and(
        eq(submissions.editionId, edition.id),
        eq(submissions.status, "published"),
      ),
    )
    .orderBy(submissions.positionInEdition);

  const pieces = await Promise.all(
    pieceSubmissions.map(async (s) => {
      const detail = await getSubmissionForReader(s.id, options);
      return {
        submission: s,
        firstBlock: detail?.blocks[0] ?? null,
      };
    }),
  );

  return { edition, pieces };
}

// ─── Submission form ────────────────────────────────────────────────────────

export interface SubmitFormScene {
  longitude: number;
  latitude: number;
  eventDate: string | null;  // ISO 8601 or null
  content: string;           // the scene's story text
  ordinal: number;            // 1-indexed display ordinal
}

export interface SubmitFormPayload {
  // F7
  title: string;
  abstract: string | null;
  wordCount: number;
  language: SupportedLanguage;
  authorEmail: string;
  authorPenName: string | null;
  authorId: string;           // for now, derived from email — auth comes later

  // F1
  scenes: SubmitFormScene[];  // 1..6 entries
  relocationTest: string;     // ≥ 50 words

  // F2
  relationship: AuthorRelationship;
  relationshipDuration: string | null;
  authorAffiliations: string[];
  // P4 confidentiality carveout (constitution v0.2). When true, the
  // affinity disclosure is held in confidence and a redacted note is
  // published in its place.
  affinityConfidential: boolean;
  affinityConfidentialReason: string | null;

  // F3
  storyType: StoryType;

  // F4 (only meaningful when storyType === 'based_on_reality' AND has real people)
  hasRealPeople: boolean;
  consentStatus: ConsentStatus;
  consentExplanation: string | null;
  realPersonsList: string[];

  // F5
  aiUsageLabel: AiUsageLabel;
  aiNotes: string | null;

  // F6
  sensitivityWarnings: string[];
  risksExplanation: string | null;
  satireDisclosure: boolean;

  // F7
  legalAttestation: boolean;
}

export interface SubmitFormResult {
  submissionId: string;
  report: SubmissionReport;
  status: SubmissionStatus;
}

export async function submitFromForm(
  input: SubmitFormPayload,
): Promise<SubmitFormResult> {
  if (input.scenes.length < 1) throw new Error("at least one scene required");
  if (input.scenes.length > 6) throw new Error("at most six scenes allowed");
  for (const scene of input.scenes) {
    if (!Number.isFinite(scene.longitude) || scene.longitude < -180 || scene.longitude > 180)
      throw new Error("scene longitude out of range");
    if (!Number.isFinite(scene.latitude) || scene.latitude < -90 || scene.latitude > 90)
      throw new Error("scene latitude out of range");
    if (!scene.content || scene.content.trim().length === 0)
      throw new Error("scene content cannot be empty");
  }
  if (input.wordCount < 800 || input.wordCount > 2500)
    throw new Error("word_count must be between 800 and 2500");
  if (countWords(input.relocationTest) < 50)
    throw new Error("relocation test must be at least 50 words");
  if (!input.legalAttestation)
    throw new Error("legal attestation must be accepted");
  if (!isValidEmail(input.authorEmail))
    throw new Error("invalid author email");

  const submissionId = await db.transaction(async (tx) => {
    const [submission] = await tx
      .insert(submissions)
      .values({
        authorId: input.authorId,
        title: input.title,
        abstract: input.abstract,
        sourceLanguage: input.language,
        status: "ai_review",
        contentFlags: {
          realPlaces: [],
          realPersons: input.realPersonsList,
          realOrgs: [],
          conflictZone: false,
        },
        authorAffiliations: input.authorAffiliations,
        satireDisclosure: input.satireDisclosure,
        sensitivityWarnings: input.sensitivityWarnings,
        submissionForm: input as unknown as Record<string, unknown>,
        wordCount: input.wordCount,
        authorEmail: input.authorEmail,
        authorPenName: input.authorPenName,
        legalAttestation: input.legalAttestation,
        relocationTest: input.relocationTest,
        storyType: input.storyType,
        authorRelationship: input.relationship,
        relationshipDuration: input.relationshipDuration,
        affinityConfidential: input.affinityConfidential,
        affinityConfidentialReason: input.affinityConfidentialReason,
        consentStatus: input.hasRealPeople ? input.consentStatus : "not_applicable",
        consentExplanation: input.consentExplanation,
        aiUsageLabel: input.aiUsageLabel,
        aiNotes: input.aiNotes,
        risksExplanation: input.risksExplanation,
      })
      .returning({ id: submissions.id });

    for (const scene of input.scenes) {
      const [block] = await tx
        .insert(narrativeBlocks)
        .values({
          submissionId: submission.id,
          eventDate: scene.eventDate ? new Date(scene.eventDate) : null,
          location: { x: scene.longitude, y: scene.latitude },
        })
        .returning({ id: narrativeBlocks.id });

      await tx.insert(blockTranslations).values({
        blockId: block.id,
        language: input.language,
        method: "original",
        status: "draft",
        accessTier: "free",
        content: scene.content,
        annotations: [],
      });
    }

    return submission.id;
  });

  // AI review runs outside the transaction — a slow Anthropic call
  // shouldn't hold a DB connection.
  const report = await runAiReviewInternal(submissionId);

  const [post] = await db
    .select({ status: submissions.status })
    .from(submissions)
    .where(eq(submissions.id, submissionId))
    .limit(1);

  return { submissionId, report, status: post?.status ?? "ai_review" };
}

// ─── Draft → submission handoff (template / voice write path) ──────────────

function hasOwnCoord(section: DraftSection): boolean {
  return (
    typeof section.longitude === "number" &&
    Number.isFinite(section.longitude) &&
    section.longitude >= -180 &&
    section.longitude <= 180 &&
    typeof section.latitude === "number" &&
    Number.isFinite(section.latitude) &&
    section.latitude >= -90 &&
    section.latitude <= 90
  );
}

export interface SubmitDraftPayload {
  draftId: string;
  userId: string;
  /** Caller-provided author email (defaults to auth user's email upstream). */
  authorEmail: string;
  /** Display name on the submission. We don't enforce uniqueness or
   *  policy here — the editor flow handles that. */
  authorPenName: string;
  /** F1.b — required by submissions table at ≥50 words. We surface the
   *  same field on the AssemblyView so the template path produces a
   *  submission that the existing editorial pipeline can consume. */
  relocationTest: string;
  /** F7 — required to be true. */
  legalAttestation: boolean;
}

export interface SubmitDraftResult {
  submissionId: string;
  report: SubmissionReport;
  status: SubmissionStatus;
}

/**
 * Hand a `story_drafts` row off to the editorial pipeline.
 *
 *   1. Validate the draft is owned by `userId` and in a submittable
 *      stage (anything except already-submitted / trashed).
 *   2. Validate the caller-supplied fields the draft doesn't store
 *      (coordinate, relocation test, attestation).
 *   3. Concatenate sections[].content into a single submission_form
 *      snapshot AND into a per-section narrative_block stream.
 *   4. In one transaction: insert the submission, insert one
 *      narrative_block + original block_translation per non-empty
 *      section, mark the draft `stage='submitted'` and set its
 *      `submission_id` analogue via submissions.draft_id.
 *   5. Run the AI editor outside the transaction (slow Anthropic call;
 *      same pattern as `submitFromForm`).
 *
 * Word-count rule is the same as /submit: 800–2500. The relocation
 * test minimum (50 words) is also identical — keeps both write paths
 * landing in the same editorial constraints.
 */
export async function submitFromDraft(
  input: SubmitDraftPayload,
): Promise<SubmitDraftResult> {
  if (countWords(input.relocationTest) < 50)
    throw new Error("relocation test must be at least 50 words");
  if (!input.legalAttestation)
    throw new Error("legal attestation must be accepted");
  if (!isValidEmail(input.authorEmail))
    throw new Error("invalid author email");

  const [draft] = await db
    .select()
    .from(storyDrafts)
    .where(and(eq(storyDrafts.id, input.draftId), eq(storyDrafts.userId, input.userId)))
    .limit(1);
  if (!draft) throw new Error("draft not found");
  if (draft.stage === "submitted")
    throw new Error("draft already submitted");
  if (draft.stage === "trashed")
    throw new Error("draft is in trash");

  // Section content is the authoritative source for the prose. We trust
  // the per-section validation done at edit time; here we just slim it
  // down to non-empty sections (so an unfinished section doesn't become
  // an empty narrative_block).
  const sections = (draft.sections as DraftSection[]).filter(
    (s) => typeof s?.content === "string" && s.content.trim().length > 0,
  );
  if (sections.length === 0) throw new Error("draft has no content");

  // Locations: every section ends up with a coordinate, either its own
  // or the most recent upstream one. The first section MUST have its
  // own — there's nothing to inherit from. If the user only set a pin
  // on, say, Section 3, then Sections 1-2 have no upstream coord and
  // we reject the submit. UX-side they should never reach here without
  // at least Section 1 set (review page gates), but defence in depth.
  if (!hasOwnCoord(sections[0])) {
    throw new Error(
      "section 1 must have a location — drop a pin in the editor",
    );
  }
  let runningLon = sections[0].longitude as number;
  let runningLat = sections[0].latitude as number;
  let runningPlace = sections[0].place_description ?? null;
  const resolvedSections = sections.map((s) => {
    if (hasOwnCoord(s)) {
      runningLon = s.longitude as number;
      runningLat = s.latitude as number;
      runningPlace = s.place_description ?? null;
    }
    return {
      ...s,
      _longitude: runningLon,
      _latitude: runningLat,
      _placeDescription: runningPlace,
    };
  });

  // Total word count across all sections. Same 800–2500 envelope as
  // /submit. We use the shared countWords helper so CJK + Latin scripts
  // are counted consistently.
  const totalWords = sections.reduce(
    (acc, s) => acc + countWords(s.content),
    0,
  );
  if (totalWords < 800 || totalWords > 2500)
    throw new Error("word_count must be between 800 and 2500");

  const title =
    typeof draft.title === "string" && draft.title.trim().length > 0
      ? draft.title.trim()
      : "Untitled";

  // submission_form is an audit-trail snapshot — capture both the draft
  // shape AND the final form payload so editors can replay what was
  // submitted even if we change the draft format later.
  const submissionFormSnapshot = {
    source: "template" as const,
    templateId: draft.templateId,
    draftId: draft.id,
    title,
    sections,
    resolvedLocations: resolvedSections.map((s) => ({
      section_id: s.section_id,
      longitude: s._longitude,
      latitude: s._latitude,
      placeDescription: s._placeDescription,
    })),
    relocationTest: input.relocationTest,
    authorEmail: input.authorEmail,
    authorPenName: input.authorPenName,
    legalAttestation: input.legalAttestation,
    capturedAt: new Date().toISOString(),
  };

  const submissionId = await db.transaction(async (tx) => {
    const [submission] = await tx
      .insert(submissions)
      .values({
        authorId: input.userId, // Keep the existing string field populated.
        authorUserId: input.userId,
        draftId: draft.id,
        title,
        sourceLanguage: draft.language,
        status: "ai_review",
        submissionForm: submissionFormSnapshot,
        wordCount: totalWords,
        authorEmail: input.authorEmail,
        authorPenName: input.authorPenName,
        legalAttestation: true,
        relocationTest: input.relocationTest,
        // Defaults for fields the template path doesn't yet collect.
        // Editors / future slices will surface these; for now we ship
        // the most conservative values so AI editor + moderation
        // pipeline has something to work with.
        contentFlags: {
          realPlaces: [],
          realPersons: [],
          realOrgs: [],
          conflictZone: false,
        },
        authorAffiliations: [],
        satireDisclosure: false,
        sensitivityWarnings: [],
        consentStatus: "not_applicable",
      })
      .returning({ id: submissions.id });

    for (const section of resolvedSections) {
      const [block] = await tx
        .insert(narrativeBlocks)
        .values({
          submissionId: submission.id,
          location: { x: section._longitude, y: section._latitude },
          eventDate: null,
        })
        .returning({ id: narrativeBlocks.id });
      await tx.insert(blockTranslations).values({
        blockId: block.id,
        language: draft.language,
        method: "original",
        status: "draft",
        accessTier: "free",
        content: section.content,
        annotations: [],
      });
    }

    await tx
      .update(storyDrafts)
      .set({ stage: "submitted" })
      .where(eq(storyDrafts.id, draft.id));

    return submission.id;
  });

  // AI review runs outside the transaction.
  const report = await runAiReviewInternal(submissionId);
  const [post] = await db
    .select({ status: submissions.status })
    .from(submissions)
    .where(eq(submissions.id, submissionId))
    .limit(1);
  return { submissionId, report, status: post?.status ?? "ai_review" };
}

export async function runAiReview(submissionId: string): Promise<SubmissionReport> {
  return runAiReviewInternal(submissionId);
}

async function runAiReviewInternal(submissionId: string): Promise<SubmissionReport> {
  const judgmentInput = await buildJudgmentSubmission(submissionId);
  const report = await evaluateSubmission(judgmentInput);

  if (report.judgments.length > 0) {
    await db.insert(principleJudgments).values(
      report.judgments.map((j) => ({
        submissionId,
        principleCode: j.principle,
        principleVersion: j.version,
        verdict: j.status,
        confidence: j.confidence,
        reasoning: j.reasoning,
        keyQuote: j.key_quote,
        humanReviewNeeded: j.human_review_needed,
        model: "claude-sonnet-4-6",
        inputTokens: j.usage.input_tokens,
        outputTokens: j.usage.output_tokens,
        cacheReadInputTokens: j.usage.cache_read_input_tokens,
        cacheCreationInputTokens: j.usage.cache_creation_input_tokens,
      })),
    );
  }

  const decision: ModerationDecisionValue =
    report.routing === "AUTO_REJECT"
      ? "reject"
      : report.routing === "PASS_TO_EDITOR"
        ? "approve"
        : "request_changes";
  const nextStatus: SubmissionStatus =
    report.routing === "AUTO_REJECT" ? "draft" : "human_review";

  await db.transaction(async (tx) => {
    await tx.insert(moderationDecisions).values({
      submissionId,
      layer: "ai",
      decision,
      rationale: report.routing_reason,
      flaggedEntities: report.judgments.map((j) => ({
        kind: `${j.principle}:${j.version}`,
        value: j.key_quote,
        sentiment: j.confidence,
      })),
      citedPrinciples: report.cited_principles,
    });

    // Editor-side triage: stored on submissions, separate from
    // moderation_decisions. Never affects routing — pure queue sort.
    // See docs/ai-editor-triage-rationale.md.
    const triageUpdate: Partial<typeof submissions.$inferInsert> = {
      status: nextStatus,
      aiReviewedAt: new Date(),
    };
    if (report.triage) {
      triageUpdate.editorialPriorityScore = report.triage.score;
      triageUpdate.editorialPriorityPayload = report.triage as unknown as Record<
        string,
        unknown
      >;
      triageUpdate.editorialPriorityModel = report.triage.model;
      triageUpdate.editorialPriorityEvaluatedAt = new Date();
    }
    await tx
      .update(submissions)
      .set(triageUpdate)
      .where(eq(submissions.id, submissionId));
  });

  return report;
}

async function buildJudgmentSubmission(
  submissionId: string,
): Promise<JudgmentSubmission> {
  const [row] = await db
    .select()
    .from(submissions)
    .where(eq(submissions.id, submissionId))
    .limit(1);
  if (!row) throw new Error(`submission ${submissionId} not found`);

  const blocks = await db.execute<{
    longitude: number;
    latitude: number;
    sequence_number: number;
    content: string;
  }>(sql`
    SELECT
      ST_X(${narrativeBlocks.location}) AS longitude,
      ST_Y(${narrativeBlocks.location}) AS latitude,
      ${narrativeBlocks.sequenceNumber}  AS sequence_number,
      ${blockTranslations.content}       AS content
    FROM ${narrativeBlocks}
    INNER JOIN ${blockTranslations}
      ON ${blockTranslations.blockId} = ${narrativeBlocks.id}
    WHERE ${narrativeBlocks.submissionId} = ${submissionId}
      AND ${blockTranslations.method} = 'original'
    ORDER BY ${narrativeBlocks.sequenceNumber} ASC
  `);

  return {
    meta: {
      submission_id: submissionId,
      title: row.title,
      abstract: row.abstract,
      word_count: row.wordCount,
      language: row.sourceLanguage,
      author_id: row.authorId,
      author_pen_name: row.authorPenName,
    },
    field1_route: {
      places: blocks.map((b, idx) => ({
        longitude: Number(b.longitude),
        latitude: Number(b.latitude),
        ordinal: idx + 1,
      })),
      relocation_test: row.relocationTest,
    },
    field2_affinity: {
      relationship: row.authorRelationship,
      duration: row.relationshipDuration,
      affiliations: row.authorAffiliations,
    },
    field3_story_type: row.storyType,
    field4_real_people: {
      has_real_people:
        (row.contentFlags?.realPersons?.length ?? 0) > 0,
      consent_status: row.consentStatus,
      consent_explanation: row.consentExplanation,
    },
    field5_ai: {
      label: row.aiUsageLabel,
      notes: row.aiNotes,
    },
    field6_risks: {
      warnings: row.sensitivityWarnings,
      explanation: row.risksExplanation,
      satire: row.satireDisclosure,
    },
    story_blocks: blocks.map((b) => b.content),
  };
}

function countWords(s: string): number {
  const trimmed = s.trim();
  if (!trimmed) return 0;
  const latinWords = trimmed
    .split(/\s+/)
    .filter((w) => /[A-Za-zÀ-ÿ]/.test(w)).length;
  const cjkChars = (trimmed.match(/[一-鿿぀-ヿ가-힯]/g) ?? []).length;
  return latinWords + cjkChars;
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

"use server";

import { and, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  blockTranslations,
  editions,
  editorialPrinciples,
  moderationDecisions,
  narrativeBlocks,
  reports,
  submissions,
  type BlockTranslation,
  type CulturalAnnotation,
  type Edition,
  type EditorialPrinciple,
  type FlaggedEntity,
  type ModerationDecisionRow,
  type ModerationDecisionValue,
  type ModerationLayer,
  type NarrativeBlock,
  type PrincipleExample,
  type Report,
  type ReportCategory,
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

// Note: the pure-function `renderTranslation` helper lives at
// `@/lib/rendering` so it can be imported from client components without
// pulling the server-action bundle. Re-import from there.

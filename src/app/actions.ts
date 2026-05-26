"use server";

import { and, sql } from "drizzle-orm";

import { db } from "@/db";
import { narrativeBlocks, type NarrativeBlock } from "@/db/schema";

export interface CreateNarrativeBlockInput {
  submissionId: string;
  eventDate: Date;
  longitude: number;
  latitude: number;
  content: string;
}

/**
 * Insert a new narrative block. `location` is written using Drizzle's
 * `{ x, y }` geometry syntax (configured via `mode: "xy"` on the column).
 */
export async function createNarrativeBlock(
  input: CreateNarrativeBlockInput,
): Promise<NarrativeBlock> {
  const { submissionId, eventDate, longitude, latitude, content } = input;

  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error("longitude must be a finite number in [-180, 180]");
  }
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error("latitude must be a finite number in [-90, 90]");
  }

  const [block] = await db
    .insert(narrativeBlocks)
    .values({
      submissionId,
      eventDate,
      content,
      location: { x: longitude, y: latitude },
    })
    .returning();

  return block;
}

export interface BoundingBox {
  minLong: number;
  minLat: number;
  maxLong: number;
  maxLat: number;
}

/**
 * Return every narrative block whose location intersects the supplied Mapbox
 * viewport. Coordinates are passed as bound parameters via Drizzle's `sql`
 * tagged template — never interpolated as raw strings — so this is safe
 * against SQL injection.
 */
export async function getNarrativeBlocksInBoundingBox(
  bbox: BoundingBox,
  options?: { submissionId?: string; limit?: number },
): Promise<NarrativeBlock[]> {
  const { minLong, minLat, maxLong, maxLat } = bbox;

  for (const [name, value] of Object.entries(bbox)) {
    if (!Number.isFinite(value)) {
      throw new Error(`bounding box value '${name}' must be a finite number`);
    }
  }

  const envelope = sql`ST_MakeEnvelope(${minLong}, ${minLat}, ${maxLong}, ${maxLat}, 4326)`;
  const inViewport = sql`ST_Intersects(${narrativeBlocks.location}, ${envelope})`;

  const whereClause = options?.submissionId
    ? and(inViewport, sql`${narrativeBlocks.submissionId} = ${options.submissionId}`)
    : inViewport;

  const query = db
    .select()
    .from(narrativeBlocks)
    .where(whereClause)
    .orderBy(narrativeBlocks.sequenceNumber);

  return options?.limit ? query.limit(options.limit) : query;
}

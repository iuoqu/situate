import { and, asc, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/db";
import { entities, relationships, storyDrafts } from "@/db/schema";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Bible relationships CRUD — collection endpoints.
 *
 *   GET  /api/drafts/[id]/bible/relationships
 *   POST /api/drafts/[id]/bible/relationships
 *
 * Both endpoints require the caller to own the parent draft. Each
 * relationship row is a directed edge (entity_a → entity_b) with a
 * tradition-defined `kind` (text). The DB enforces uniqueness on
 * (draft, a, b, kind) and forbids self-loops via CHECK; we don't
 * duplicate those rules here.
 */

export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  const { id: draftId } = await ctx.params;
  const owner = await requireOwner(draftId);
  if (owner instanceof NextResponse) return owner;

  const rows = await db
    .select()
    .from(relationships)
    .where(eq(relationships.draftId, draftId))
    .orderBy(asc(relationships.createdAt));
  return NextResponse.json({ relationships: rows });
}

interface CreateBody {
  entityA?: unknown;
  entityB?: unknown;
  kind?: unknown;
  registerOverrides?: unknown;
  notes?: unknown;
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const { id: draftId } = await ctx.params;
  const owner = await requireOwner(draftId);
  if (owner instanceof NextResponse) return owner;

  const body = (await safeJson(req)) as CreateBody | null;
  if (
    !body ||
    typeof body.entityA !== "string" ||
    typeof body.entityB !== "string" ||
    typeof body.kind !== "string"
  ) {
    return NextResponse.json(
      { error: "entityA, entityB, and kind are required" },
      { status: 400 },
    );
  }
  if (body.entityA === body.entityB) {
    return NextResponse.json(
      { error: "self-loop not allowed" },
      { status: 400 },
    );
  }

  // Verify both endpoints exist within the same draft so we don't
  // accidentally let an author wire an entity to one from another
  // draft. Cheap pair-of-existence query.
  const present = await db
    .select({ id: entities.id })
    .from(entities)
    .where(eq(entities.draftId, draftId));
  const presentIds = new Set(present.map((p) => p.id));
  if (!presentIds.has(body.entityA) || !presentIds.has(body.entityB)) {
    return NextResponse.json(
      { error: "both entities must belong to this draft" },
      { status: 400 },
    );
  }

  const registerOverrides =
    body.registerOverrides &&
    typeof body.registerOverrides === "object" &&
    !Array.isArray(body.registerOverrides)
      ? (body.registerOverrides as Record<string, unknown>)
      : {};

  try {
    const [row] = await db
      .insert(relationships)
      .values({
        draftId,
        entityA: body.entityA,
        entityB: body.entityB,
        kind: body.kind.trim(),
        registerOverrides,
        notes:
          typeof body.notes === "string" ? body.notes.trim() || null : null,
      })
      .returning();
    return NextResponse.json({ relationship: row }, { status: 201 });
  } catch (err) {
    // Unique constraint violation on (draft, a, b, kind) — already exists.
    const message = err instanceof Error ? err.message : "insert failed";
    if (message.includes("relationships_uniq_edge")) {
      return NextResponse.json(
        { error: "that relationship already exists" },
        { status: 409 },
      );
    }
    throw err;
  }
}

async function requireOwner(
  draftId: string,
): Promise<string | NextResponse> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const [row] = await db
    .select({ id: storyDrafts.id })
    .from(storyDrafts)
    .where(
      and(eq(storyDrafts.id, draftId), eq(storyDrafts.userId, user.id)),
    )
    .limit(1);
  if (!row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return user.id;
}

async function safeJson(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

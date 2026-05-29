import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/db";
import { entities, storyDrafts } from "@/db/schema";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Bible entities CRUD — single-entity endpoints.
 *
 *   PATCH  /api/drafts/[id]/bible/entities/[entityId]  — partial update
 *   DELETE /api/drafts/[id]/bible/entities/[entityId]  — remove
 *
 * Ownership check via parent draft (same pattern as the collection
 * route). The entity is verified to belong to the draft so a stray
 * entityId from a different draft produces a 404.
 */

export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ id: string; entityId: string }> };

interface PatchBody {
  canonicalName?: unknown;
  entityType?: unknown;
  aliases?: unknown;
  attributes?: unknown;
  isRealPerson?: unknown;
  consentStatus?: unknown;
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const { id: draftId, entityId } = await ctx.params;
  const owner = await requireOwnerAndEntity(draftId, entityId);
  if (owner instanceof NextResponse) return owner;

  const body = (await safeJson(req)) as PatchBody | null;
  if (!body) {
    return NextResponse.json({ error: "expected JSON body" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.canonicalName === "string") {
    const t = body.canonicalName.trim();
    if (!t) {
      return NextResponse.json(
        { error: "canonicalName cannot be empty" },
        { status: 400 },
      );
    }
    patch.canonicalName = t;
  }
  if (typeof body.entityType === "string") {
    const t = body.entityType.trim();
    if (!t) {
      return NextResponse.json(
        { error: "entityType cannot be empty" },
        { status: 400 },
      );
    }
    patch.entityType = t;
  }
  if (Array.isArray(body.aliases)) {
    patch.aliases = body.aliases
      .filter((a): a is string => typeof a === "string")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (
    body.attributes &&
    typeof body.attributes === "object" &&
    !Array.isArray(body.attributes)
  ) {
    patch.attributes = body.attributes as Record<string, unknown>;
  }
  if (typeof body.isRealPerson === "boolean") {
    patch.isRealPerson = body.isRealPerson;
  } else if (body.isRealPerson === null) {
    patch.isRealPerson = null;
  }
  if (typeof body.consentStatus === "string") {
    patch.consentStatus = body.consentStatus.trim() || null;
  } else if (body.consentStatus === null) {
    patch.consentStatus = null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "no recognised fields in patch" },
      { status: 400 },
    );
  }

  const [row] = await db
    .update(entities)
    .set(patch)
    .where(and(eq(entities.id, entityId), eq(entities.draftId, draftId)))
    .returning();
  return NextResponse.json({ entity: row });
}

export async function DELETE(_req: NextRequest, ctx: RouteCtx) {
  const { id: draftId, entityId } = await ctx.params;
  const owner = await requireOwnerAndEntity(draftId, entityId);
  if (owner instanceof NextResponse) return owner;

  // Cascading FK on entity_name_renderings + relationships +
  // postures + elisions (resolved_entity_id is ON DELETE SET NULL on
  // elisions) takes care of dependents.
  await db
    .delete(entities)
    .where(and(eq(entities.id, entityId), eq(entities.draftId, draftId)));
  return NextResponse.json({ status: "deleted" });
}

async function requireOwnerAndEntity(
  draftId: string,
  entityId: string,
): Promise<string | NextResponse> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // Single query verifying both that the caller owns the draft AND
  // the entity belongs to that draft.
  const [row] = await db
    .select({ entityId: entities.id })
    .from(entities)
    .innerJoin(storyDrafts, eq(storyDrafts.id, entities.draftId))
    .where(
      and(
        eq(entities.id, entityId),
        eq(entities.draftId, draftId),
        eq(storyDrafts.userId, user.id),
      ),
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

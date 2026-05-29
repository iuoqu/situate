import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/db";
import { relationships, storyDrafts } from "@/db/schema";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Bible relationships CRUD — single-relationship endpoints.
 *
 *   PATCH  /api/drafts/[id]/bible/relationships/[relId]
 *   DELETE /api/drafts/[id]/bible/relationships/[relId]
 */

export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ id: string; relId: string }> };

interface PatchBody {
  kind?: unknown;
  registerOverrides?: unknown;
  notes?: unknown;
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const { id: draftId, relId } = await ctx.params;
  const owner = await requireOwnerAndRel(draftId, relId);
  if (owner instanceof NextResponse) return owner;

  const body = (await safeJson(req)) as PatchBody | null;
  if (!body) {
    return NextResponse.json({ error: "expected JSON body" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.kind === "string") {
    const t = body.kind.trim();
    if (!t) {
      return NextResponse.json(
        { error: "kind cannot be empty" },
        { status: 400 },
      );
    }
    patch.kind = t;
  }
  if (
    body.registerOverrides &&
    typeof body.registerOverrides === "object" &&
    !Array.isArray(body.registerOverrides)
  ) {
    patch.registerOverrides = body.registerOverrides as Record<string, unknown>;
  }
  if (typeof body.notes === "string") {
    patch.notes = body.notes.trim() || null;
  } else if (body.notes === null) {
    patch.notes = null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "no recognised fields in patch" },
      { status: 400 },
    );
  }

  const [row] = await db
    .update(relationships)
    .set(patch)
    .where(
      and(eq(relationships.id, relId), eq(relationships.draftId, draftId)),
    )
    .returning();
  return NextResponse.json({ relationship: row });
}

export async function DELETE(_req: NextRequest, ctx: RouteCtx) {
  const { id: draftId, relId } = await ctx.params;
  const owner = await requireOwnerAndRel(draftId, relId);
  if (owner instanceof NextResponse) return owner;

  await db
    .delete(relationships)
    .where(
      and(eq(relationships.id, relId), eq(relationships.draftId, draftId)),
    );
  return NextResponse.json({ status: "deleted" });
}

async function requireOwnerAndRel(
  draftId: string,
  relId: string,
): Promise<string | NextResponse> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const [row] = await db
    .select({ id: relationships.id })
    .from(relationships)
    .innerJoin(storyDrafts, eq(storyDrafts.id, relationships.draftId))
    .where(
      and(
        eq(relationships.id, relId),
        eq(relationships.draftId, draftId),
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

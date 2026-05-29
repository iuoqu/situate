import { and, asc, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/db";
import { entities, storyDrafts } from "@/db/schema";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Bible entities CRUD — collection endpoints.
 *
 * Authorisation: the caller must own the parent draft. We don't model
 * a separate "bible owner" because the bible is conceptually part of
 * the draft (it travels with it through submission and gets snapshotted
 * into submission_form). The skeleton-window's AI extraction inserts
 * via the same endpoint with the caller's session — there's no
 * separate "AI service" identity to maintain.
 *
 * Value spaces (entity_type, attributes shape) are intentionally
 * open. The tradition registry suggests sensible defaults; this API
 * accepts anything stringy. Tighter validation lives at insert sites
 * where the calling code knows the tradition.
 */

export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  const { id: draftId } = await ctx.params;
  const userId = await requireOwner(draftId);
  if (userId instanceof NextResponse) return userId;

  const rows = await db
    .select()
    .from(entities)
    .where(eq(entities.draftId, draftId))
    .orderBy(asc(entities.createdAt));
  return NextResponse.json({ entities: rows });
}

interface CreateBody {
  canonicalName?: unknown;
  entityType?: unknown;
  aliases?: unknown;
  attributes?: unknown;
  isRealPerson?: unknown;
  consentStatus?: unknown;
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const { id: draftId } = await ctx.params;
  const userId = await requireOwner(draftId);
  if (userId instanceof NextResponse) return userId;

  const body = (await safeJson(req)) as CreateBody | null;
  if (
    !body ||
    typeof body.canonicalName !== "string" ||
    typeof body.entityType !== "string"
  ) {
    return NextResponse.json(
      { error: "canonicalName and entityType are required" },
      { status: 400 },
    );
  }
  const canonicalName = body.canonicalName.trim();
  const entityType = body.entityType.trim();
  if (!canonicalName || !entityType) {
    return NextResponse.json(
      { error: "canonicalName and entityType must be non-empty" },
      { status: 400 },
    );
  }

  const aliases = Array.isArray(body.aliases)
    ? body.aliases
        .filter((a): a is string => typeof a === "string")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const attributes =
    body.attributes && typeof body.attributes === "object" && !Array.isArray(body.attributes)
      ? (body.attributes as Record<string, unknown>)
      : {};

  const [row] = await db
    .insert(entities)
    .values({
      draftId,
      canonicalName,
      entityType,
      aliases,
      attributes,
      isRealPerson:
        typeof body.isRealPerson === "boolean" ? body.isRealPerson : null,
      consentStatus:
        typeof body.consentStatus === "string"
          ? body.consentStatus.trim() || null
          : null,
    })
    .returning();

  return NextResponse.json({ entity: row }, { status: 201 });
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
    // Return 404 (not 403) so a stray id from another user can't probe
    // existence. Same pattern as /api/drafts/[id]/route.ts.
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

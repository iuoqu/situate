import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/db";
import { storyDrafts } from "@/db/schema";
import { getServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ draftId: string }> };

/**
 * PATCH /api/write/project/[draftId]/map
 *
 * Body: { mapData: Partial<MapData> }
 * Merges the given fields into the existing map_data jsonb column (shallow merge).
 * Returns 200 { ok: true } on success.
 */
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { draftId } = await ctx.params;

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body: { mapData?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.mapData || typeof body.mapData !== "object") {
    return NextResponse.json({ error: "mapData_required" }, { status: 400 });
  }

  // Fetch current map_data so we can shallow-merge
  const [existing] = await db
    .select({ mapData: storyDrafts.mapData, userId: storyDrafts.userId })
    .from(storyDrafts)
    .where(and(eq(storyDrafts.id, draftId), eq(storyDrafts.userId, user.id)))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const merged = {
    ...(existing.mapData as object ?? {}),
    ...body.mapData,
  };

  await db
    .update(storyDrafts)
    .set({ mapData: merged as unknown as object })
    .where(and(eq(storyDrafts.id, draftId), eq(storyDrafts.userId, user.id)));

  return NextResponse.json({ ok: true });
}

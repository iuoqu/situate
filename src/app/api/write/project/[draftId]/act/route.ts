import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/db";
import { storyDrafts } from "@/db/schema";
import { getServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ draftId: string }> };

/**
 * PATCH /api/write/project/[draftId]/act
 *
 * Body: { actData: Partial<ActData> }
 * Shallow-merges the given fields into act_data.
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

  let body: { actData?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.actData || typeof body.actData !== "object") {
    return NextResponse.json({ error: "actData_required" }, { status: 400 });
  }

  const [existing] = await db
    .select({ actData: storyDrafts.actData, userId: storyDrafts.userId })
    .from(storyDrafts)
    .where(and(eq(storyDrafts.id, draftId), eq(storyDrafts.userId, user.id)))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const merged = {
    ...(existing.actData as object ?? {}),
    ...body.actData,
  };

  await db
    .update(storyDrafts)
    .set({ actData: merged as unknown as object })
    .where(and(eq(storyDrafts.id, draftId), eq(storyDrafts.userId, user.id)));

  return NextResponse.json({ ok: true });
}

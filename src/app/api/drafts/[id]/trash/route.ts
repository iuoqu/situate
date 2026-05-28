import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/db";
import { storyDrafts } from "@/db/schema";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * POST /api/drafts/[id]/trash — soft-delete a draft.
 *
 * Sets stage='trashed' so the row stops appearing in "In progress" and
 * appears in the Trash tab. Reversible via /restore. A future cron
 * will hard-delete rows trashed > 30 days.
 *
 * Submitted drafts can't be trashed — once handed off to the
 * editorial pipeline, the submission is the authoritative entity and
 * the draft row is a read-only audit record.
 *
 * Form-post target (HTML <form> from /my). Returns a 303 redirect
 * back to /my so the dashboard updates without JS.
 */

export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const { id } = await ctx.params;
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(
      new URL("/auth/login?next=/my", req.url),
      { status: 303 },
    );
  }

  const [existing] = await db
    .select({ stage: storyDrafts.stage })
    .from(storyDrafts)
    .where(and(eq(storyDrafts.id, id), eq(storyDrafts.userId, user.id)))
    .limit(1);
  if (!existing) {
    return NextResponse.redirect(new URL("/my", req.url), { status: 303 });
  }
  if (existing.stage === "submitted") {
    return NextResponse.redirect(
      new URL("/my?tab=submitted", req.url),
      { status: 303 },
    );
  }

  await db
    .update(storyDrafts)
    .set({ stage: "trashed" })
    .where(and(eq(storyDrafts.id, id), eq(storyDrafts.userId, user.id)));

  return NextResponse.redirect(new URL("/my", req.url), { status: 303 });
}

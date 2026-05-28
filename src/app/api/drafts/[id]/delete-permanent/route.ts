import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/db";
import { storyDrafts } from "@/db/schema";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * POST /api/drafts/[id]/delete-permanent — hard-delete a draft.
 *
 * Only works on drafts currently in `trashed`, so the author has to
 * trash first, then visit the Trash tab to permanently delete. This
 * two-step gate is the equivalent of WordPress's "Delete Permanently"
 * action — one accidental click on the dashboard can never destroy
 * work.
 *
 * If the draft has been submitted (FK on submissions.draft_id ON
 * DELETE SET NULL), the submission row stays — the editorial record
 * survives the author's draft deletion.
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
      new URL("/auth/login?next=/my?tab=trash", req.url),
      { status: 303 },
    );
  }

  await db
    .delete(storyDrafts)
    .where(
      and(
        eq(storyDrafts.id, id),
        eq(storyDrafts.userId, user.id),
        eq(storyDrafts.stage, "trashed"),
      ),
    );

  return NextResponse.redirect(
    new URL("/my?tab=trash", req.url),
    { status: 303 },
  );
}

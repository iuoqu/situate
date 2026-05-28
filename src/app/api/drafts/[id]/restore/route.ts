import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/db";
import { storyDrafts } from "@/db/schema";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * POST /api/drafts/[id]/restore — pull a soft-deleted draft back into
 * "In progress".
 *
 * Only operates on rows currently in `trashed`; restoring a
 * non-trashed draft is a no-op so a stray form post can't accidentally
 * change an active draft's stage.
 *
 * Restored drafts go to `stage='editing'` (not the original stage they
 * were trashed from — we don't track that). This means a draft that
 * was in 'disclosure' or 'ready' before being trashed comes back as
 * editable; the author can advance again from there.
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
    .update(storyDrafts)
    .set({ stage: "editing" })
    .where(
      and(
        eq(storyDrafts.id, id),
        eq(storyDrafts.userId, user.id),
        eq(storyDrafts.stage, "trashed"),
      ),
    );

  return NextResponse.redirect(new URL("/my", req.url), { status: 303 });
}

import { and, eq, inArray, or } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/db";
import { submissions, type SubmissionStatus } from "@/db/schema";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * POST /api/submissions/[id]/withdraw — author yanks their own
 * submission from the editorial queue.
 *
 * Only allowed from non-terminal states (anything that isn't already
 * published or already withdrawn). The editor flow treats `withdrawn`
 * as a final state — re-submitting requires the author to start a
 * fresh submission from a draft.
 *
 * Ownership is enforced by matching author_user_id OR author_email
 * (same OR pattern as the /my dashboard for legacy /submit-form rows).
 *
 * If the submission has a linked draft (`draft_id`), we flip the draft
 * back to `editing` so the author can revise and resubmit without
 * starting over. The submission row stays put (audit trail) but with
 * status='withdrawn'.
 */

export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ id: string }> };

const ALLOWED_FROM: SubmissionStatus[] = [
  "draft",
  "ai_review",
  "human_review",
  "revisions_requested",
  "accepted_pending_publish",
];

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const { id } = await ctx.params;

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(
      new URL(
        `/auth/login?next=${encodeURIComponent(`/my/submissions/${id}`)}`,
        req.url,
      ),
      { status: 303 },
    );
  }

  const userEmail = user.email ?? "";
  const ownerMatch = or(
    eq(submissions.authorUserId, user.id),
    userEmail ? eq(submissions.authorEmail, userEmail) : undefined,
  );

  const result = await db
    .update(submissions)
    .set({ status: "withdrawn" })
    .where(
      and(
        eq(submissions.id, id),
        ownerMatch,
        inArray(submissions.status, ALLOWED_FROM),
      ),
    )
    .returning({ id: submissions.id, draftId: submissions.draftId });

  if (result.length === 0) {
    // Either not found, not owned, or already in a terminal state.
    // Redirect back; the status page reflects whatever the real state
    // is, so the author sees an honest picture either way.
    return NextResponse.redirect(
      new URL(`/my/submissions/${id}`, req.url),
      { status: 303 },
    );
  }

  // Reopen the linked draft if there is one. Imported inline here so
  // we only touch story_drafts when we actually have a linkage.
  const draftId = result[0].draftId;
  if (draftId) {
    const { storyDrafts } = await import("@/db/schema");
    await db
      .update(storyDrafts)
      .set({ stage: "editing" })
      .where(
        and(
          eq(storyDrafts.id, draftId),
          eq(storyDrafts.userId, user.id),
        ),
      );
  }

  return NextResponse.redirect(new URL("/my?tab=submitted", req.url), {
    status: 303,
  });
}

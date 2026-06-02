import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/db";
import { storyDrafts, type DraftSection } from "@/db/schema";
import { DEFAULT_TEMPLATE_ID } from "@/lib/templates/registry";
import { getServerSupabase } from "@/lib/supabase/server";
import {
  DEFAULT_TRADITION_ID,
  getTradition,
} from "@/lib/traditions/registry";

/**
 * POST /api/write/project/[draftId]/begin-writing
 *
 * The Path B → writing handoff. A draft created via start-project has no
 * templateId / traditionProfileId / sections — it was a "find the center"
 * project, not a template draft. The template editor (/write/template/[id])
 * bounces drafts with no templateId back to /write, so before we can send a
 * Path B writer into the editor we must give the draft a template scaffold.
 *
 * This endpoint is idempotent: if the draft already has a templateId
 * (e.g. it started as Path A, or the writer hit this twice) it leaves the
 * scaffold untouched and just redirects. Sections are only seeded when the
 * draft has none, so a writer's in-progress content is never clobbered.
 *
 * 303-redirects to /write/template/[draftId] on success.
 */

export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ draftId: string }> };

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const { draftId } = await ctx.params;

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(
      new URL("/auth/login?reason=auth_required&next=/write", req.url),
      { status: 303 },
    );
  }

  const [draft] = await db
    .select({
      id: storyDrafts.id,
      templateId: storyDrafts.templateId,
      traditionProfileId: storyDrafts.traditionProfileId,
      sections: storyDrafts.sections,
    })
    .from(storyDrafts)
    .where(and(eq(storyDrafts.id, draftId), eq(storyDrafts.userId, user.id)))
    .limit(1);

  if (!draft) {
    return NextResponse.redirect(new URL("/write", req.url), { status: 303 });
  }

  // Only assign a scaffold if the draft doesn't already have one.
  if (!draft.templateId) {
    const traditionId =
      draft.traditionProfileId && getTradition(draft.traditionProfileId)
        ? draft.traditionProfileId
        : DEFAULT_TRADITION_ID;
    const tradition = getTradition(traditionId)!;

    const existing = Array.isArray(draft.sections)
      ? (draft.sections as DraftSection[])
      : [];
    const sections: DraftSection[] =
      existing.length > 0
        ? existing
        : tradition.sections.map((s, idx) => ({
            index: idx,
            section_id: s.id,
            content: "",
            longitude: null,
            latitude: null,
            place_description: null,
            section_metadata: {},
          }));

    await db
      .update(storyDrafts)
      .set({
        templateId: DEFAULT_TEMPLATE_ID,
        traditionProfileId: traditionId,
        sections: sections as unknown as object,
        stage: "editing",
      })
      .where(and(eq(storyDrafts.id, draftId), eq(storyDrafts.userId, user.id)));
  }

  return NextResponse.redirect(
    new URL(`/write/template/${draftId}`, req.url),
    { status: 303 },
  );
}

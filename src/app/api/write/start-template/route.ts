import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/db";
import { storyDrafts, type DraftSection } from "@/db/schema";
import { DEFAULT_TEMPLATE_ID, getTemplate } from "@/lib/templates/registry";
import { getServerSupabase } from "@/lib/supabase/server";
import {
  DEFAULT_TRADITION_ID,
  getTradition,
} from "@/lib/traditions/registry";

/**
 * POST /api/write/start-template
 *
 * Form-post target for the "Start a guided draft →" button on /write.
 * Creates a fresh draft pre-seeded with empty sections, then
 * 303-redirects to /write/template/[draftId].
 *
 * Body (form-encoded):
 *   - templateId  — kept for back-compat; identifies the template
 *                   shape (legacy notion of a 5-section template).
 *   - traditionProfileId — new in 0011. Decides the editor scaffold
 *                          (sections + prompts), whether sections are
 *                          deletable, and whether Section 1 must have
 *                          a coordinate at submit time. Default
 *                          `flash_situate_anchored`.
 *
 * When a tradition is provided, its `sections` define the initial
 * shape (one DraftSection per tradition section). The legacy
 * `templateId` is preserved for any downstream code that still reads
 * it; new code should prefer `traditionProfileId`.
 */

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
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

  let templateId = DEFAULT_TEMPLATE_ID;
  let traditionId = DEFAULT_TRADITION_ID;
  try {
    const form = await req.formData();
    const rawTemplate = form.get("templateId");
    if (typeof rawTemplate === "string" && getTemplate(rawTemplate)) {
      templateId = rawTemplate;
    }
    const rawTradition = form.get("traditionProfileId");
    if (typeof rawTradition === "string" && getTradition(rawTradition)) {
      traditionId = rawTradition;
    }
  } catch {
    // Ignore — keep defaults.
  }

  // The tradition is the source of truth for the initial sections; the
  // legacy template is a thinner shell. Both are kept on the draft so
  // existing code paths (TemplateEditor reads template.sections) keep
  // working until the editor migrates to reading from tradition only.
  const tradition = getTradition(traditionId)!;
  const sections: DraftSection[] = tradition.sections.map((s, idx) => ({
    index: idx,
    section_id: s.id,
    content: "",
    longitude: null,
    latitude: null,
    place_description: null,
    section_metadata: {},
  }));

  const [row] = await db
    .insert(storyDrafts)
    .values({
      userId: user.id,
      templateId,
      traditionProfileId: traditionId,
      sections: sections as unknown as object,
      stage: "editing",
    })
    .returning({ id: storyDrafts.id });

  return NextResponse.redirect(
    new URL(`/write/template/${row.id}`, req.url),
    { status: 303 },
  );
}

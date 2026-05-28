import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/db";
import { storyDrafts, type DraftSection } from "@/db/schema";
import { DEFAULT_TEMPLATE_ID, getTemplate } from "@/lib/templates/registry";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * POST /api/write/start-template
 *
 * Form-post target for the "Start a guided draft →" button on /write.
 * Creates a fresh draft pre-seeded with empty sections matching the
 * chosen template, then 303-redirects to /write/template/[draftId].
 *
 * Why a form post + redirect (instead of fetch from a client component)?
 * It keeps /write a pure server component, which means we don't have to
 * ship a hydration boundary just to handle one click. The trade-off is
 * one extra round-trip; acceptable for a once-per-session action.
 */

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // /write is auth-gated upstream; reach here only via a stale form
    // post. Just send them back to login.
    return NextResponse.redirect(
      new URL("/auth/login?reason=auth_required&next=/write", req.url),
      { status: 303 },
    );
  }

  let templateId = DEFAULT_TEMPLATE_ID;
  try {
    const form = await req.formData();
    const raw = form.get("templateId");
    if (typeof raw === "string" && getTemplate(raw)) {
      templateId = raw;
    }
  } catch {
    // Ignore — keep the default.
  }

  const template = getTemplate(templateId)!;
  const sections: DraftSection[] = template.sections.map((s, idx) => ({
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
      sections: sections as unknown as object,
      stage: "editing",
    })
    .returning({ id: storyDrafts.id });

  return NextResponse.redirect(
    new URL(`/write/template/${row.id}`, req.url),
    { status: 303 },
  );
}

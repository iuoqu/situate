import { desc, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/db";
import { storyDrafts, type DraftSection } from "@/db/schema";
import { getTemplate } from "@/lib/templates/registry";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Drafts CRUD — collection endpoints.
 *
 *   POST /api/drafts — create a new draft for the signed-in user.
 *   GET  /api/drafts — list the signed-in user's drafts (sorted by
 *                       updated_at desc). Used by the future dashboard.
 *
 * Auth is enforced at app level: we read the Supabase user via the
 * server SSR client and filter by user_id. The table has RLS policies
 * too but our DB pool uses the service role, so app-level is the real
 * gate.
 */

export const runtime = "nodejs";

interface CreateBody {
  templateId?: unknown;
  language?: unknown;
  title?: unknown;
}

export async function POST(req: NextRequest) {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await safeJson(req)) as CreateBody | null;
  const templateIdRaw =
    typeof body?.templateId === "string" ? body.templateId : null;
  const language =
    typeof body?.language === "string" ? body.language : "en";
  const title =
    typeof body?.title === "string" && body.title.trim().length > 0
      ? body.title.trim().slice(0, 200)
      : null;

  // Validate templateId if provided. NULL is valid (voice-freeform).
  let templateId: string | null = null;
  if (templateIdRaw) {
    const template = getTemplate(templateIdRaw);
    if (!template) {
      return NextResponse.json(
        { error: "unknown template_id" },
        { status: 400 },
      );
    }
    templateId = template.id;
  }

  // Pre-seed `sections[]` if this is a template-driven draft so the
  // editor doesn't have to invent the shape on first save.
  const template = templateId ? getTemplate(templateId) : null;
  const sections: DraftSection[] = template
    ? template.sections.map((s, idx) => ({
        index: idx,
        section_id: s.id,
        content: "",
        longitude: null,
        latitude: null,
        place_description: null,
        section_metadata: {},
      }))
    : [];

  const [row] = await db
    .insert(storyDrafts)
    .values({
      userId: user.id,
      templateId,
      language: (language as "en") ?? "en",
      title,
      sections: sections as unknown as object, // jsonb
    })
    .returning();

  return NextResponse.json({ draft: row }, { status: 201 });
}

export async function GET() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(storyDrafts)
    .where(eq(storyDrafts.userId, user.id))
    .orderBy(desc(storyDrafts.updatedAt))
    .limit(50);
  return NextResponse.json({ drafts: rows });
}

async function safeJson(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

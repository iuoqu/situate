import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/db";
import {
  storyDrafts,
  type DraftSection,
  type DraftStage,
} from "@/db/schema";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Drafts CRUD — single-draft endpoints.
 *
 *   GET    /api/drafts/[id] — load a draft owned by the caller.
 *   PATCH  /api/drafts/[id] — partial update. Used by the auto-save loop.
 *   DELETE /api/drafts/[id] — discard.
 *
 * Auth is enforced via two checks composed:
 *   1. `getServerSupabase().auth.getUser()` returns the caller.
 *   2. The Drizzle query filters by `userId = caller.id` so a stray draft
 *      id from a different user produces a 404 (not 403, to avoid
 *      leaking that the id exists).
 */

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const { user, response } = await requireUser();
  if (response) return response;

  const row = await loadOwned(id, user.id);
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ draft: row });
}

const ALLOWED_STAGES = new Set<DraftStage>([
  "recording",
  "transcribed",
  "structured",
  "editing",
  "disclosure",
  "ready",
]);

interface PatchBody {
  title?: unknown;
  language?: unknown;
  stage?: unknown;
  sections?: unknown;
  voiceTranscript?: unknown;
  recordingDurationSec?: unknown;
  currentText?: unknown;
  disclosureChat?: unknown;
  disclosures?: unknown;
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const { user, response } = await requireUser();
  if (response) return response;

  const existing = await loadOwned(id, user.id);
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = (await safeJson(req)) as PatchBody | null;
  if (!body) {
    return NextResponse.json({ error: "expected JSON body" }, { status: 400 });
  }

  // Build patch object from only the fields the caller actually included.
  // Each field is validated independently so we never accept garbage.
  const patch: Partial<typeof storyDrafts.$inferInsert> = {};

  if (typeof body.title === "string") {
    patch.title = body.title.trim().slice(0, 200) || null;
  }
  if (typeof body.language === "string") {
    // The supportedLanguage enum is exhaustive on the DB side; if the value
    // is invalid postgres will reject. We don't pre-validate here to avoid
    // duplicating enum knowledge.
    patch.language = body.language as typeof patch.language;
  }
  if (typeof body.stage === "string" && ALLOWED_STAGES.has(body.stage as DraftStage)) {
    patch.stage = body.stage as DraftStage;
  }
  if (Array.isArray(body.sections)) {
    // Trust the structure; the DB column is jsonb. We do a light validation
    // for the must-have keys to catch obvious client bugs early.
    const sections = body.sections as DraftSection[];
    if (
      sections.every(
        (s) =>
          typeof s?.index === "number" &&
          typeof s?.section_id === "string" &&
          typeof s?.content === "string",
      )
    ) {
      patch.sections = sections as unknown as object;
    } else {
      return NextResponse.json(
        { error: "malformed sections[]" },
        { status: 400 },
      );
    }
  }
  if (typeof body.voiceTranscript === "string") {
    patch.voiceTranscript = body.voiceTranscript;
  }
  if (typeof body.recordingDurationSec === "number") {
    patch.recordingDurationSec = Math.max(0, Math.floor(body.recordingDurationSec));
  }
  if (typeof body.currentText === "string") {
    patch.currentText = body.currentText;
  }
  if (Array.isArray(body.disclosureChat)) {
    patch.disclosureChat = body.disclosureChat as unknown as object;
  }
  if (body.disclosures && typeof body.disclosures === "object") {
    patch.disclosures = body.disclosures as object;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "no recognised fields in patch" },
      { status: 400 },
    );
  }

  const [row] = await db
    .update(storyDrafts)
    .set(patch)
    .where(and(eq(storyDrafts.id, id), eq(storyDrafts.userId, user.id)))
    .returning();

  return NextResponse.json({ draft: row });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const { user, response } = await requireUser();
  if (response) return response;

  const result = await db
    .delete(storyDrafts)
    .where(and(eq(storyDrafts.id, id), eq(storyDrafts.userId, user.id)))
    .returning({ id: storyDrafts.id });

  if (result.length === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ status: "deleted" });
}

// ── helpers ────────────────────────────────────────────────────────────────

async function requireUser(): Promise<
  | { user: { id: string }; response: null }
  | { user: { id: "" }; response: NextResponse }
> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      user: { id: "" },
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }
  return { user: { id: user.id }, response: null };
}

async function loadOwned(id: string, userId: string) {
  const [row] = await db
    .select()
    .from(storyDrafts)
    .where(and(eq(storyDrafts.id, id), eq(storyDrafts.userId, userId)))
    .limit(1);
  return row ?? null;
}

async function safeJson(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/db";
import { storyDrafts, storyUnits } from "@/db/schema";
import { getTradition } from "@/lib/traditions/registry";
import { analyseStoryUnit } from "@/lib/coach/story-unit-gate";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Story unit gate — B.4.
 *
 * POST /api/drafts/[id]/story-unit
 *   Body: { sectionId, content, sectionLabel, sectionPrompt }
 *   Runs the LLM gate, upserts one row in story_units per section,
 *   returns the result.
 *
 * GET  /api/drafts/[id]/story-unit
 *   Returns all story_units rows for this draft (keyed by section_id).
 *
 * Auth: caller must own the draft.
 */

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const UNIT_TYPE = "flash_situate_spine";

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { id: draftId } = await ctx.params;
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [draft] = await db
    .select({ id: storyDrafts.id })
    .from(storyDrafts)
    .where(and(eq(storyDrafts.id, draftId), eq(storyDrafts.userId, user.id)))
    .limit(1);
  if (!draft) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const rows = await db
    .select()
    .from(storyUnits)
    .where(and(eq(storyUnits.draftId, draftId), eq(storyUnits.unitType, UNIT_TYPE)));

  return NextResponse.json({ units: rows });
}

// ── POST ─────────────────────────────────────────────────────────────────────

interface PostBody {
  sectionId: string;
  content: string;
  sectionLabel: string;
  sectionPrompt: string;
}

function parseBody(raw: unknown): PostBody | string {
  if (typeof raw !== "object" || raw === null) return "body must be object";
  const obj = raw as Record<string, unknown>;
  if (typeof obj.sectionId !== "string" || !obj.sectionId.trim()) return "sectionId required";
  if (typeof obj.content !== "string" || obj.content.trim().length < 100)
    return "content must be at least 100 characters";
  if (typeof obj.sectionLabel !== "string") return "sectionLabel required";
  if (typeof obj.sectionPrompt !== "string") return "sectionPrompt required";
  return {
    sectionId: obj.sectionId,
    content: obj.content,
    sectionLabel: obj.sectionLabel,
    sectionPrompt: obj.sectionPrompt,
  };
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id: draftId } = await ctx.params;

  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Verify ownership + get tradition
  const [draft] = await db
    .select({ id: storyDrafts.id, traditionProfileId: storyDrafts.traditionProfileId })
    .from(storyDrafts)
    .where(and(eq(storyDrafts.id, draftId), eq(storyDrafts.userId, user.id)))
    .limit(1);
  if (!draft) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let raw: unknown;
  try { raw = await req.json(); } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = parseBody(raw);
  if (typeof parsed === "string") return NextResponse.json({ error: parsed }, { status: 400 });

  const tradition = getTradition(draft.traditionProfileId ?? "flash_situate_anchored");

  let result;
  try {
    const callResult = await analyseStoryUnit(
      parsed.content,
      parsed.sectionLabel,
      parsed.sectionPrompt,
    );
    result = callResult.result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "analysis failed", detail: message }, { status: 500 });
  }

  // Upsert: one row per (draftId, sectionId, unitType)
  const existing = await db
    .select({ id: storyUnits.id })
    .from(storyUnits)
    .where(
      and(
        eq(storyUnits.draftId, draftId),
        eq(storyUnits.sectionId, parsed.sectionId),
        eq(storyUnits.unitType, UNIT_TYPE),
      ),
    )
    .limit(1);

  const predicates = {
    s0: result.s0,
    d: result.d,
    t: result.t,
    s1: result.s1,
    k_hint: result.k_hint,
    transformed: result.transformed,
    causal: result.causal,
    stakes: result.stakes,
    coach_question: result.coach_question,
  };

  if (existing.length > 0) {
    await db
      .update(storyUnits)
      .set({
        predicates: predicates as unknown as object,
        failureType: result.failure_type,
      })
      .where(eq(storyUnits.id, existing[0].id));
  } else {
    await db.insert(storyUnits).values({
      draftId,
      traditionProfileId: tradition?.id ?? "flash_situate_anchored",
      sectionId: parsed.sectionId,
      unitType: UNIT_TYPE,
      predicates: predicates as unknown as object,
      failureType: result.failure_type,
    });
  }

  return NextResponse.json({ result });
}

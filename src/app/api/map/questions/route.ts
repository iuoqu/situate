import { NextResponse, type NextRequest } from "next/server";

import { generateAngles } from "@/lib/map/angles";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * POST /api/map/questions
 *
 * Given a writer's source material, returns 5–6 instantiated angle
 * questions drawn from the 8 universal angles (§7 situate.map).
 *
 * Auth: Supabase session (same gate as /api/coach/diagnose).
 *
 * Body:
 *   material   string  required  The writer's world description /
 *                                source text (characters, events,
 *                                places, document excerpts)
 *   provider?  string  optional  Provider id (e.g. "anthropic:claude-
 *                                sonnet-4-6"). Defaults to internal
 *                                Anthropic default.
 *
 * Response:
 *   { questions: AngleQuestion[], selection_note: string }
 */

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

interface Body {
  material: string;
  provider?: string;
}

function parseBody(raw: unknown): Body | string {
  if (typeof raw !== "object" || raw === null) return "body must be object";
  const obj = raw as Record<string, unknown>;
  if (typeof obj.material !== "string" || obj.material.trim().length === 0)
    return "material required (non-empty string)";
  if (obj.provider !== undefined && typeof obj.provider !== "string")
    return "provider must be string when provided";
  return {
    material: obj.material,
    provider: typeof obj.provider === "string" ? obj.provider : undefined,
  };
}

export async function POST(req: NextRequest) {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = parseBody(raw);
  if (typeof parsed === "string") {
    return NextResponse.json({ error: parsed }, { status: 400 });
  }

  try {
    const callResult = await generateAngles(parsed.material, parsed.provider);
    return NextResponse.json({
      questions: callResult.result.questions,
      selection_note: callResult.result.selection_note,
      meta: callResult.meta,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "angle generation failed", detail: message },
      { status: 500 },
    );
  }
}

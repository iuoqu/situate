import { NextResponse, type NextRequest } from "next/server";

import { generateCenterCard } from "@/lib/map/center-card";
import { getServerSupabase } from "@/lib/supabase/server";
import type { AnsweredQuestion, SynthesisResult } from "@/lib/map/types";

/**
 * POST /api/map/center-card
 *
 * After the writer names their center, generates the three structural
 * fields that complete the center card (§7):
 *
 *   core_question  — the question only this center can answer
 *   hardest_part   — the structural rendering challenge
 *   not_center     — 2–3 near-misses from the writer's own materials
 *
 * Auth: Supabase session.
 *
 * Body:
 *   center    string              The writer's named center
 *   material  string              The source material description
 *   answers   AnsweredQuestion[]  The writer's angle answers
 *   synthesis SynthesisResult     The synthesis algorithm output
 *   provider? string              Optional provider id
 *
 * Response:
 *   { core_question, hardest_part, not_center, meta }
 */

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

interface Body {
  center: string;
  material: string;
  answers: AnsweredQuestion[];
  synthesis: SynthesisResult;
  provider?: string;
}

function parseBody(raw: unknown): Body | string {
  if (typeof raw !== "object" || raw === null) return "body must be object";
  const obj = raw as Record<string, unknown>;
  if (typeof obj.center !== "string" || !obj.center.trim()) return "center required";
  if (typeof obj.material !== "string" || !obj.material.trim()) return "material required";
  if (!Array.isArray(obj.answers) || obj.answers.length < 1)
    return "answers must be non-empty array";
  if (typeof obj.synthesis !== "object" || obj.synthesis === null)
    return "synthesis required";
  return {
    center: obj.center,
    material: obj.material,
    answers: obj.answers as AnsweredQuestion[],
    synthesis: obj.synthesis as SynthesisResult,
    provider: typeof obj.provider === "string" ? obj.provider : undefined,
  };
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await getServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
    }

    const parsed = parseBody(raw);
    if (typeof parsed === "string")
      return NextResponse.json({ error: parsed }, { status: 400 });

    try {
      const callResult = await generateCenterCard(
        parsed.center,
        parsed.material,
        parsed.answers,
        parsed.synthesis,
        parsed.provider,
      );
      return NextResponse.json({
        core_question: callResult.result.core_question,
        hardest_part: callResult.result.hardest_part,
        not_center: callResult.result.not_center,
        meta: callResult.meta,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: "center card generation failed", detail: message },
        { status: 500 },
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "server error", detail: message }, { status: 500 });
  }
}

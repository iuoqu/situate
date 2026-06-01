import { NextResponse, type NextRequest } from "next/server";

import { synthesize } from "@/lib/map/synthesis";
import { getServerSupabase } from "@/lib/supabase/server";
import type { AnsweredQuestion } from "@/lib/map/types";

/**
 * POST /api/map/synthesize
 *
 * Given a writer's source material and their answers to the angle
 * questions, runs the synthesis algorithm (§7 归纳) and returns one
 * of three branches:
 *
 *   convergent         — recurring phrases identified; prompts the
 *                        writer to name the thing they've already chosen
 *   higher_abstraction — phrases scatter across entities that share a
 *                        system/place; the shared frame is offered as
 *                        a question (never a verdict)
 *   divergent          — no genuine convergence; honest admission
 *
 * Auth: Supabase session.
 *
 * Body:
 *   material   string            The world description (same as sent
 *                                to /api/map/questions)
 *   answers    AnsweredQuestion[] The writer's answers to each angle
 *                                question
 *   provider?  string            Optional provider id
 *
 * Response:
 *   { branch, recurring, shared_frame, message, extracted_phrases, meta }
 */

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

function isAnsweredQuestion(v: unknown): v is AnsweredQuestion {
  if (typeof v !== "object" || v === null) return false;
  const obj = v as Record<string, unknown>;
  return (
    typeof obj.angle_id === "number" &&
    typeof obj.angle_name === "string" &&
    typeof obj.question === "string" &&
    typeof obj.answer === "string"
  );
}

interface Body {
  material: string;
  answers: AnsweredQuestion[];
  provider?: string;
}

function parseBody(raw: unknown): Body | string {
  if (typeof raw !== "object" || raw === null) return "body must be object";
  const obj = raw as Record<string, unknown>;
  if (typeof obj.material !== "string" || obj.material.trim().length === 0)
    return "material required (non-empty string)";
  if (!Array.isArray(obj.answers) || obj.answers.length < 2)
    return "answers must be an array with at least 2 items";
  if (!obj.answers.every(isAnsweredQuestion))
    return "each answer must have angle_id (number), angle_name, question, answer (strings)";
  if (obj.provider !== undefined && typeof obj.provider !== "string")
    return "provider must be string when provided";
  return {
    material: obj.material,
    answers: obj.answers as AnsweredQuestion[],
    provider: typeof obj.provider === "string" ? obj.provider : undefined,
  };
}

export async function POST(req: NextRequest) {
  try {
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
      const callResult = await synthesize(
        parsed.material,
        parsed.answers,
        parsed.provider,
      );
      return NextResponse.json({
        branch: callResult.result.branch,
        recurring: callResult.result.recurring,
        shared_frame: callResult.result.shared_frame,
        message: callResult.result.message,
        extracted_phrases: callResult.result.extracted_phrases,
        meta: callResult.meta,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: "synthesis failed", detail: message },
        { status: 500 },
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "server error", detail: message },
      { status: 500 },
    );
  }
}

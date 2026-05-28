import { NextResponse, type NextRequest } from "next/server";

import { check, confidence, primaryEngine } from "@/lib/eval/check";
import { specimenByPath } from "@/lib/eval/specimens";
import { requireBearerToken } from "@/lib/skeleton-diagnostic/auth";
import { diagnoseSkeleton } from "@/lib/skeleton-diagnostic/diagnose";

/**
 * POST /api/dev/diagnose-by-path
 *
 * Single-specimen diagnostic + PASS/FAIL check, looked up by repo-relative
 * path. Replaces the streaming /api/dev/run-eval — the /dev/eval client now
 * fans out 36 of these in parallel from the browser instead of holding one
 * long SSE connection open through Vercel's edge.
 *
 * Body: { path: "synthetic/faqtiao/01_mood.txt", mode?: "full" | "partial" }
 *
 * If `mode` is omitted, picks based on the specimen's `is_partial` flag.
 *
 * Each call is one Claude round trip — 3-10 seconds — well under any
 * Vercel plan's default function timeout.
 */
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

interface Body {
  path: string;
  mode?: "full" | "partial";
  provider?: string;
}

function parseBody(raw: unknown): Body | string {
  if (typeof raw !== "object" || raw === null) return "body must be an object";
  const obj = raw as Record<string, unknown>;
  if (typeof obj.path !== "string" || !obj.path) return "path must be a string";
  const mode = obj.mode;
  if (mode !== undefined && mode !== "full" && mode !== "partial") {
    return "mode must be full | partial when provided";
  }
  const provider = obj.provider;
  if (provider !== undefined && typeof provider !== "string") {
    return "provider must be a string when provided";
  }
  return { path: obj.path, mode, provider };
}

export async function POST(req: NextRequest) {
  const unauthorized = requireBearerToken(req);
  if (unauthorized) return unauthorized;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const parsed = parseBody(raw);
  if (typeof parsed === "string") {
    return NextResponse.json({ error: parsed }, { status: 400 });
  }

  const spec = specimenByPath(parsed.path);
  if (!spec) {
    return NextResponse.json({ error: "specimen not found", path: parsed.path }, { status: 404 });
  }

  const runMode = parsed.mode ?? (spec.is_partial ? "partial" : "full");
  const bucket = spec.is_partial ? "partial" : spec.is_holdout ? "holdout" : "train";

  try {
    const diagnostic = await diagnoseSkeleton(spec.text, runMode, parsed.provider);
    const checkResult = spec.expectation
      ? check(diagnostic, spec.expectation)
      : { ok: false, fails: ["no_expectation"] };
    return NextResponse.json({
      path: spec.path,
      bucket,
      run_mode: runMode,
      provider: parsed.provider ?? null,
      expectation: spec.expectation,
      diagnostic,
      check: checkResult,
      primary_engine: primaryEngine(diagnostic),
      confidence: confidence(diagnostic),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json(
      {
        path: spec.path,
        bucket,
        run_mode: runMode,
        provider: parsed.provider ?? null,
        expectation: spec.expectation,
        diagnostic: null,
        check: { ok: false, fails: ["api_error"] },
        primary_engine: "-",
        confidence: null,
        error: message,
      },
      // 200 not 500 — the client wants a row in the results table, not a thrown error
      { status: 200 },
    );
  }
}

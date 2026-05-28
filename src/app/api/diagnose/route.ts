import { NextResponse, type NextRequest } from "next/server";

import { diagnoseSkeleton } from "@/lib/skeleton-diagnostic/diagnose";
import type { DiagnosticMode } from "@/lib/skeleton-diagnostic/types";

/**
 * POST /api/diagnose
 *
 * Server-only endpoint that runs the skeleton-diagnostic Claude call. Two
 * consumers:
 *
 *   1. `story-gate-eval/run_eval.py` — points ANALYZER_URL here for prompt
 *      iteration against the specimen suite without holding an Anthropic
 *      key locally.
 *   2. The /submit form's planned live-diagnostic sidebar — debounces user
 *      input and calls this from a server action for partial-draft mode.
 *
 * Authentication: single bearer token from DIAGNOSTIC_INTERNAL_TOKEN. This
 * is intentionally minimal — once the route is deployed, any public Claude
 * endpoint will be scraped within hours and used to burn the Anthropic
 * quota. The token defends against that; it is NOT a user-facing auth
 * system. Issue one token per internal consumer; rotate on suspicion.
 *
 * Body shape:
 *   { text: string, mode: "full" | "partial" }
 *
 * Response:
 *   FullDiagnostic | PartialDiagnostic (see `types.ts`) with `_meta` carrying
 *   token usage + model + duration.
 */

export const runtime = "nodejs"; // Anthropic SDK requires node runtime
export const maxDuration = 60;   // diagnose call can run ~5-30s; give headroom
export const dynamic = "force-dynamic";

const MIN_TEXT_LEN = 5;
const MAX_TEXT_LEN = 50_000; // safe upper bound — typical flash fic is < 5K chars

interface Body {
  text: string;
  mode: DiagnosticMode;
}

function parseBody(raw: unknown): Body | string {
  if (typeof raw !== "object" || raw === null) return "body must be an object";
  const obj = raw as Record<string, unknown>;
  if (typeof obj.text !== "string") return "text must be a string";
  if (obj.text.length < MIN_TEXT_LEN) return `text too short (< ${MIN_TEXT_LEN})`;
  if (obj.text.length > MAX_TEXT_LEN) return `text too long (> ${MAX_TEXT_LEN})`;
  const mode = obj.mode ?? "full";
  if (mode !== "full" && mode !== "partial") return `mode must be full | partial`;
  return { text: obj.text, mode };
}

export async function POST(req: NextRequest) {
  // Step 1: auth
  const expected = process.env.DIAGNOSTIC_INTERNAL_TOKEN;
  if (!expected) {
    // Fail loudly rather than silently allow everything — a missing token in
    // prod means the operator forgot to configure it, not "skip auth".
    console.error("DIAGNOSTIC_INTERNAL_TOKEN not set; refusing all requests");
    return NextResponse.json(
      { error: "diagnose endpoint not configured" },
      { status: 503 },
    );
  }
  const header = req.headers.get("authorization") ?? "";
  if (header !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Step 2: body
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

  // Step 3: diagnose
  try {
    const result = await diagnoseSkeleton(parsed.text, parsed.mode);
    return NextResponse.json(result);
  } catch (err) {
    console.error("diagnose failed", err);
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json(
      { error: "diagnose failed", detail: message },
      { status: 500 },
    );
  }
}

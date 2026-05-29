import { NextResponse, type NextRequest } from "next/server";

import { requireBearerToken } from "@/lib/skeleton-diagnostic/auth";
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
  provider?: string;
}

function parseBody(raw: unknown): Body | string {
  if (typeof raw !== "object" || raw === null) return "body must be an object";
  const obj = raw as Record<string, unknown>;
  if (typeof obj.text !== "string") return "text must be a string";
  if (obj.text.length < MIN_TEXT_LEN) return `text too short (< ${MIN_TEXT_LEN})`;
  if (obj.text.length > MAX_TEXT_LEN) return `text too long (> ${MAX_TEXT_LEN})`;
  const mode = obj.mode ?? "full";
  if (mode !== "full" && mode !== "partial") return `mode must be full | partial`;
  const provider = obj.provider;
  if (provider !== undefined && typeof provider !== "string") {
    return "provider must be a string when provided";
  }
  return { text: obj.text, mode, provider };
}

export async function POST(req: NextRequest) {
  // Step 1: auth
  const unauthorized = requireBearerToken(req);
  if (unauthorized) return unauthorized;

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
    const result = await diagnoseSkeleton(parsed.text, parsed.mode, parsed.provider);
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

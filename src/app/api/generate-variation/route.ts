import { NextResponse, type NextRequest } from "next/server";

import { requireBearerToken } from "@/lib/skeleton-diagnostic/auth";
import {
  generateVariation,
  type GenerationRequest,
} from "@/lib/skeleton-diagnostic/generate";

/**
 * POST /api/generate-variation
 *
 * Produces one new specimen + draft expectation entry by transforming a
 * seed specimen along an explicit structural axis. The Python caller writes
 * the .txt + sidecar .expectation.json files locally — only the Claude call
 * itself happens here.
 *
 * Same bearer-token auth as the other two routes. Default model is
 * sonnet-4-6 (writing is cheap to scale); pass `strict: true` to bump to
 * opus-4-7 for a more controlled batch when the variation has to land
 * structurally clean.
 */

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const MIN_SEED_LEN = 10;
const MAX_SEED_LEN = 50_000;
const MIN_TRANSFORM_LEN = 5;
const MAX_TRANSFORM_LEN = 2_000;

function parseBody(raw: unknown): GenerationRequest | string {
  if (typeof raw !== "object" || raw === null) return "body must be an object";
  const obj = raw as Record<string, unknown>;

  if (typeof obj.seed_text !== "string") return "seed_text must be a string";
  if (obj.seed_text.length < MIN_SEED_LEN) return `seed_text too short`;
  if (obj.seed_text.length > MAX_SEED_LEN) return `seed_text too long`;

  if (typeof obj.transform !== "string") return "transform must be a string";
  if (obj.transform.length < MIN_TRANSFORM_LEN) return `transform too short`;
  if (obj.transform.length > MAX_TRANSFORM_LEN) return `transform too long`;

  if (
    obj.seed_expectation !== undefined &&
    (typeof obj.seed_expectation !== "object" || obj.seed_expectation === null)
  ) {
    return "seed_expectation must be an object when provided";
  }

  if (obj.strict !== undefined && typeof obj.strict !== "boolean") {
    return "strict must be a boolean when provided";
  }

  return {
    seed_text: obj.seed_text,
    seed_expectation: obj.seed_expectation as Record<string, unknown> | undefined,
    transform: obj.transform,
    strict: obj.strict === true,
  };
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

  try {
    const variation = await generateVariation(parsed);
    return NextResponse.json(variation);
  } catch (err) {
    console.error("generate-variation failed", err);
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json(
      { error: "generate failed", detail: message },
      { status: 500 },
    );
  }
}

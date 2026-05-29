import { NextResponse, type NextRequest } from "next/server";

import { getDiagnoser, listDiagnosers } from "@/lib/coach/diagnosers/registry";
import { specimenByPath } from "@/lib/eval/specimens";
import { requireBearerToken } from "@/lib/skeleton-diagnostic/auth";

/**
 * POST /api/dev/run-diagnoser
 * GET  /api/dev/run-diagnoser  → lists registered diagnosers
 *
 * POST body: { diagnoser_id, path, provider? }
 * Runs a single focused diagnoser against one specimen with one
 * provider. Returns the raw judgment + classification.
 */
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const unauthorized = requireBearerToken(req);
  if (unauthorized) return unauthorized;
  return NextResponse.json({
    diagnosers: listDiagnosers().map((d) => ({
      id: d.id,
      display_name: d.display_name,
      status: d.status,
      description: d.description,
      supports_pair_test: d.pair_axis != null,
    })),
  });
}

interface Body {
  diagnoser_id: string;
  path: string;
  provider?: string;
}

function parseBody(raw: unknown): Body | string {
  if (typeof raw !== "object" || raw === null) return "body must be object";
  const obj = raw as Record<string, unknown>;
  if (typeof obj.diagnoser_id !== "string") return "diagnoser_id required";
  if (typeof obj.path !== "string") return "path required";
  if (obj.provider !== undefined && typeof obj.provider !== "string") {
    return "provider must be string when provided";
  }
  return {
    diagnoser_id: obj.diagnoser_id,
    path: obj.path,
    provider: obj.provider as string | undefined,
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

  const diagnoser = getDiagnoser(parsed.diagnoser_id);
  if (!diagnoser) {
    return NextResponse.json(
      { error: `unknown diagnoser: ${parsed.diagnoser_id}` },
      { status: 404 },
    );
  }
  const spec = specimenByPath(parsed.path);
  if (!spec) {
    return NextResponse.json(
      { error: `specimen not found: ${parsed.path}` },
      { status: 404 },
    );
  }

  try {
    const judgment = (await diagnoser.run(spec.text, parsed.provider)) as {
      result: unknown;
      meta: unknown;
    };
    const classified =
      diagnoser.pair_axis?.classify_judgment(judgment.result) ?? null;
    return NextResponse.json({
      path: parsed.path,
      diagnoser_id: parsed.diagnoser_id,
      provider: parsed.provider ?? null,
      judgment: judgment.result,
      classified,
      meta: judgment.meta,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json(
      {
        path: parsed.path,
        diagnoser_id: parsed.diagnoser_id,
        provider: parsed.provider ?? null,
        judgment: null,
        classified: null,
        error: message,
      },
      { status: 200 },
    );
  }
}

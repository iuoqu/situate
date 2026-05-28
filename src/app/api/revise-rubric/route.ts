import { NextResponse, type NextRequest } from "next/server";

import { requireBearerToken } from "@/lib/skeleton-diagnostic/auth";
import {
  proposeRubricRevisions,
  type CaseRecord,
  type RevisionRequest,
} from "@/lib/skeleton-diagnostic/revise";

/**
 * POST /api/revise-rubric
 *
 * Meta-analysis endpoint. Consumes the output of a previous eval run + the
 * current rubric text + a sample of healthy passes, asks opus-4-7 (with
 * adaptive thinking) to propose surgical edits.
 *
 * Same bearer-token auth as /api/diagnose. Different body shape so it gets
 * its own endpoint rather than overloading /api/diagnose's contract.
 *
 * The rubric text is sent in the body, not read from the server's own
 * RUBRIC_FULL/RUBRIC_PARTIAL constants. Reason: the Python eval harness
 * may already be testing a candidate revision against the deployed
 * rubric — letting the caller pass the rubric explicitly keeps the meta
 * call honest about what it's reviewing.
 */

export const runtime = "nodejs";
export const maxDuration = 120; // meta call w/ adaptive thinking is slower
export const dynamic = "force-dynamic";

const MAX_CASES = 100; // safety bound — don't accept a 10MB payload

function parseBody(raw: unknown): RevisionRequest | string {
  if (typeof raw !== "object" || raw === null) return "body must be an object";
  const obj = raw as Record<string, unknown>;

  if (typeof obj.current_rubric !== "string" || obj.current_rubric.length < 100) {
    return "current_rubric must be a non-trivial string";
  }
  if (obj.rubric_name !== "RUBRIC_FULL" && obj.rubric_name !== "RUBRIC_PARTIAL") {
    return "rubric_name must be RUBRIC_FULL | RUBRIC_PARTIAL";
  }
  if (obj.mode !== "full" && obj.mode !== "partial") {
    return "mode must be full | partial";
  }

  const groups: Array<keyof RevisionRequest> = ["failures", "borderlines", "healthy"];
  for (const g of groups) {
    if (!Array.isArray(obj[g])) return `${g} must be an array`;
    if ((obj[g] as unknown[]).length > MAX_CASES) {
      return `${g} too long (> ${MAX_CASES})`;
    }
  }

  return {
    current_rubric: obj.current_rubric,
    rubric_name: obj.rubric_name,
    mode: obj.mode,
    failures: obj.failures as CaseRecord[],
    borderlines: obj.borderlines as CaseRecord[],
    healthy: obj.healthy as CaseRecord[],
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
    const proposal = await proposeRubricRevisions(parsed);
    return NextResponse.json(proposal);
  } catch (err) {
    console.error("revise-rubric failed", err);
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json(
      { error: "revise failed", detail: message },
      { status: 500 },
    );
  }
}

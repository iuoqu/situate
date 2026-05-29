import { NextResponse, type NextRequest } from "next/server";

import { check, confidence, primaryEngine } from "@/lib/eval/check";
import { listSpecimens } from "@/lib/eval/specimens";
import { requireBearerToken } from "@/lib/skeleton-diagnostic/auth";
import { proposeRubricRevisions, type CaseRecord } from "@/lib/skeleton-diagnostic/revise";
import { RUBRIC_FULL, RUBRIC_PARTIAL } from "@/lib/skeleton-diagnostic/rubric";
import type { SkeletonDiagnostic } from "@/lib/skeleton-diagnostic/types";

/**
 * POST /api/dev/revise
 *
 * Body: { mode: "full" | "partial", include_holdout?: boolean,
 *         results: { [path]: diagnostic } }
 *
 * Server-side equivalent of revise_rubric.py: takes the diagnostics produced
 * by the most recent run-eval, joins with the in-repo expectations, sorts
 * into failures / borderlines / healthy buckets, then calls
 * proposeRubricRevisions with the current rubric.
 *
 * The client passes the results back rather than letting the server pull
 * them from a DB — eval results are page-state only in this MVP.
 */

export const runtime = "nodejs";
export const maxDuration = 180;
export const dynamic = "force-dynamic";

interface Body {
  mode: "full" | "partial";
  include_holdout: boolean;
  results: Record<string, SkeletonDiagnostic>;
}

function parseBody(raw: unknown): Body | string {
  if (typeof raw !== "object" || raw === null) return "body must be an object";
  const obj = raw as Record<string, unknown>;
  if (obj.mode !== "full" && obj.mode !== "partial") {
    return "mode must be full | partial";
  }
  if (typeof obj.results !== "object" || obj.results === null) {
    return "results must be an object";
  }
  return {
    mode: obj.mode,
    include_holdout: obj.include_holdout === true,
    results: obj.results as Record<string, SkeletonDiagnostic>,
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

  const specimens = listSpecimens();

  const failures: CaseRecord[] = [];
  const borderlines: CaseRecord[] = [];
  const healthy: CaseRecord[] = [];

  for (const spec of specimens) {
    if (!spec.expectation) continue;
    if (spec.is_partial !== (parsed.mode === "partial")) continue;
    if (spec.is_holdout && !parsed.include_holdout) continue;

    const diagnostic = parsed.results[spec.path];
    if (!diagnostic) continue;

    const c = check(diagnostic, spec.expectation);
    const conf = confidence(diagnostic);
    const engine = primaryEngine(diagnostic);

    const actual: Record<string, unknown> = {
      primary_engine: engine,
      confidence: conf,
    };
    if (diagnostic.mode === "full") {
      actual.is_story = diagnostic.gate?.is_story;
      actual.if_not_story_type = diagnostic.gate?.if_not_story_type;
      actual.borderline_note = diagnostic.gate?.borderline_note;
      actual.why_transformed = diagnostic.gate?.transformed?.why;
      actual.why_causal = diagnostic.gate?.causal?.why;
      actual.why_stakes_bound = diagnostic.gate?.stakes_bound?.why;
      actual.skeleton = diagnostic.skeleton;
    } else {
      actual.skeleton_status = diagnostic.skeleton_status;
      actual.next_axis_hint = diagnostic.next_axis_hint;
      actual.observation_summary = diagnostic.observation_summary;
    }

    const record: CaseRecord = {
      path: spec.path,
      text: spec.text,
      expected: spec.expectation as Record<string, unknown>,
      actual,
      failed_checks: c.fails,
    };

    if (!c.ok) {
      failures.push(record);
    } else {
      const band = spec.expectation.confidence_band;
      if (typeof conf === "number" && band) {
        const margin = Math.min(conf - band[0], band[1] - conf);
        if (margin <= 0.05) {
          borderlines.push(record);
        } else {
          healthy.push({ ...record, text: undefined });
        }
      } else {
        healthy.push({ ...record, text: undefined });
      }
    }
  }

  if (failures.length === 0 && borderlines.length === 0) {
    return NextResponse.json({
      ok_no_revision_needed: true,
      counts: { failures: 0, borderlines: 0, healthy: healthy.length },
    });
  }

  const rubricText = parsed.mode === "full" ? RUBRIC_FULL : RUBRIC_PARTIAL;
  const rubricName: "RUBRIC_FULL" | "RUBRIC_PARTIAL" =
    parsed.mode === "full" ? "RUBRIC_FULL" : "RUBRIC_PARTIAL";

  try {
    const proposal = await proposeRubricRevisions({
      current_rubric: rubricText,
      rubric_name: rubricName,
      mode: parsed.mode,
      failures,
      borderlines,
      healthy,
    });
    return NextResponse.json({
      counts: {
        failures: failures.length,
        borderlines: borderlines.length,
        healthy: healthy.length,
      },
      proposal,
    });
  } catch (err) {
    console.error("revise failed", err);
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json(
      { error: "revise failed", detail: message },
      { status: 500 },
    );
  }
}

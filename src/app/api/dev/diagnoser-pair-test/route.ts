import { NextResponse, type NextRequest } from "next/server";

import { getDiagnoser } from "@/lib/coach/diagnosers/registry";
import { computePDR, findContrastPairs, type PairTestRow } from "@/lib/coach/pdr";
import { listSpecimens } from "@/lib/eval/specimens";
import { requireBearerToken } from "@/lib/skeleton-diagnostic/auth";

/**
 * POST /api/dev/diagnoser-pair-test
 *
 * Body: { diagnoser_id, providers: string[], scope?: string }
 *
 * For the named diagnoser, finds all contrast-pair specimens (via the
 * diagnoser's positive_suffix / negative_suffix), runs the diagnoser
 * against each side × each provider, classifies the verdicts, and
 * returns a PDR report.
 *
 * `scope` (optional) limits search to paths under that prefix. Defaults
 * to "diagnoser_experiments/<diagnoser_id>/specimens/".
 *
 * Server-side fan-out — concurrency 4. For 4 pairs × 4 providers = 32
 * calls, this is well under maxDuration.
 */
export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

interface Body {
  diagnoser_id: string;
  providers: string[];
  scope?: string;
  concurrency?: number;
}

function parseBody(raw: unknown): Body | string {
  if (typeof raw !== "object" || raw === null) return "body must be object";
  const obj = raw as Record<string, unknown>;
  if (typeof obj.diagnoser_id !== "string") return "diagnoser_id required";
  if (!Array.isArray(obj.providers) || obj.providers.length === 0)
    return "providers must be a non-empty array";
  if (!obj.providers.every((p) => typeof p === "string"))
    return "providers must be strings";
  return {
    diagnoser_id: obj.diagnoser_id,
    providers: obj.providers as string[],
    scope: typeof obj.scope === "string" ? obj.scope : undefined,
    concurrency:
      typeof obj.concurrency === "number" ? obj.concurrency : undefined,
  };
}

export async function POST(req: NextRequest) {
  const unauthorized = requireBearerToken(req);
  if (unauthorized) return unauthorized;

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

  const diagnoser = getDiagnoser(parsed.diagnoser_id);
  if (!diagnoser) {
    return NextResponse.json(
      { error: `unknown diagnoser: ${parsed.diagnoser_id}` },
      { status: 404 },
    );
  }
  if (!diagnoser.pair_axis) {
    return NextResponse.json(
      { error: `diagnoser ${parsed.diagnoser_id} does not support pair tests` },
      { status: 400 },
    );
  }

  // Find contrast pairs
  const allSpecs = listSpecimens();
  const scope =
    parsed.scope ?? `diagnoser_experiments/${parsed.diagnoser_id}/specimens/`;
  const scopedPaths = allSpecs
    .filter((s) => s.path.startsWith(scope))
    .map((s) => s.path);
  const pairs = findContrastPairs(
    scopedPaths,
    diagnoser.pair_axis.positive_suffix,
    diagnoser.pair_axis.negative_suffix,
  );
  if (pairs.length === 0) {
    return NextResponse.json(
      {
        error: `no contrast pairs found under ${scope} matching ${diagnoser.pair_axis.positive_suffix}/${diagnoser.pair_axis.negative_suffix}`,
      },
      { status: 404 },
    );
  }

  // Build task list — every (pair, side, provider) combo
  type Task = {
    pair_id: string;
    side: "positive" | "negative";
    path: string;
    provider: string;
  };
  const tasks: Task[] = [];
  for (const pair of pairs) {
    for (const prov of parsed.providers) {
      tasks.push({ pair_id: pair.pair_id, side: "positive", path: pair.positive, provider: prov });
      tasks.push({ pair_id: pair.pair_id, side: "negative", path: pair.negative, provider: prov });
    }
  }

  // Initialize result rows
  const rows: PairTestRow[] = pairs.map((p) => ({
    pair_id: p.pair_id,
    positive_path: p.positive,
    negative_path: p.negative,
    positive: {},
    negative: {},
  }));
  const rowByPairId = new Map(rows.map((r) => [r.pair_id, r]));

  // Capture diagnoser locally — TS narrowing across the closure boundary
  // doesn't preserve the null check above, so we pin the non-null shape here.
  const def = diagnoser;
  const pairAxis = diagnoser.pair_axis;

  // Worker pool
  const concurrency = parsed.concurrency ?? 4;
  const queue = [...tasks];
  async function worker() {
    while (queue.length > 0) {
      const t = queue.shift();
      if (!t) return;
      const spec = allSpecs.find((s) => s.path === t.path);
      const row = rowByPairId.get(t.pair_id);
      if (!spec || !row) continue;
      try {
        const judgment = (await def.run(spec.text, t.provider)) as {
          result: unknown;
        };
        const classified = pairAxis.classify_judgment(judgment.result);
        const expected = t.side; // positive specimen → expect "positive"
        const cell = {
          judgment: judgment.result,
          classified,
          correct: classified === expected,
        };
        row[t.side][t.provider] = cell;
      } catch (err) {
        row[t.side][t.provider] = {
          judgment: null,
          classified: "ambiguous" as const,
          correct: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  }
  await Promise.allSettled(
    Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()),
  );

  // Compute PDR
  const report = computePDR(diagnoser, rows, parsed.providers);

  return NextResponse.json({
    report,
    rows,
  });
}

import { NextResponse, type NextRequest } from "next/server";

import {
  type DiagnoserDefinition,
  listDiagnosers,
} from "@/lib/coach/diagnosers/registry";
import { requireBearerToken } from "@/lib/skeleton-diagnostic/auth";

/**
 * POST /api/dev/coach-preview
 *
 * Body: { text, providers: string[], diagnoser_ids?: string[], concurrency? }
 *
 * Runs every registered focused diagnoser against the supplied text with
 * each requested provider. No specimens, no PDR — this is the "what
 * would the coach say about a piece of pasted prose" endpoint.
 *
 * Used by /dev/coach-preview to mock up the 3-tier coach UX before we
 * commit to wiring it into the main /write flow.
 */
export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

interface Body {
  text: string;
  providers: string[];
  diagnoser_ids?: string[];
  concurrency?: number;
  /**
   * Optional author-declared intent. Free-text block; the route passes
   * it through verbatim to the diagnoser. The diagnoser prompts know to
   * wrap their reading with a "prose vs intent" comparison when present.
   */
  intent?: string;
}

function parseBody(raw: unknown): Body | string {
  if (typeof raw !== "object" || raw === null) return "body must be object";
  const obj = raw as Record<string, unknown>;
  if (typeof obj.text !== "string" || obj.text.trim().length === 0)
    return "text required (non-empty string)";
  if (!Array.isArray(obj.providers) || obj.providers.length === 0)
    return "providers must be a non-empty array";
  if (!obj.providers.every((p) => typeof p === "string"))
    return "providers must be strings";
  if (obj.diagnoser_ids !== undefined) {
    if (
      !Array.isArray(obj.diagnoser_ids) ||
      !obj.diagnoser_ids.every((d) => typeof d === "string")
    )
      return "diagnoser_ids must be string[] when provided";
  }
  if (obj.intent !== undefined && typeof obj.intent !== "string")
    return "intent must be string when provided";
  return {
    text: obj.text,
    providers: obj.providers as string[],
    diagnoser_ids: obj.diagnoser_ids as string[] | undefined,
    concurrency:
      typeof obj.concurrency === "number" ? obj.concurrency : undefined,
    intent: typeof obj.intent === "string" ? obj.intent : undefined,
  };
}

interface CellResult {
  judgment: unknown;
  classified: "positive" | "negative" | "ambiguous" | null;
  error?: string;
}

interface DiagnoserResult {
  id: string;
  display_name: string;
  status: string;
  description: string;
  by_provider: Record<string, CellResult>;
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

  const all = listDiagnosers();
  const requestedIds = parsed.diagnoser_ids;
  const selected: DiagnoserDefinition[] = requestedIds
    ? all.filter((d) => requestedIds.includes(d.id))
    : all;
  if (selected.length === 0) {
    return NextResponse.json(
      { error: "no matching diagnosers" },
      { status: 400 },
    );
  }

  // Pin narrowed fields — TS loses the parsed-is-Body narrowing across
  // the worker closure.
  const userText = parsed.text;
  const providersToRun = parsed.providers;
  const userIntent = parsed.intent?.trim() || undefined;

  type Task = { diagnoser: DiagnoserDefinition; provider: string };
  const tasks: Task[] = [];
  for (const d of selected) {
    for (const p of providersToRun) {
      tasks.push({ diagnoser: d, provider: p });
    }
  }

  const results: Record<string, DiagnoserResult> = {};
  for (const d of selected) {
    results[d.id] = {
      id: d.id,
      display_name: d.display_name,
      status: d.status,
      description: d.description,
      by_provider: {},
    };
  }

  const concurrency = parsed.concurrency ?? 4;
  const queue = [...tasks];
  async function worker() {
    while (queue.length > 0) {
      const t = queue.shift();
      if (!t) return;
      try {
        const judgment = (await t.diagnoser.run(
          userText,
          t.provider,
          userIntent,
        )) as {
          result: unknown;
        };
        const classified =
          t.diagnoser.pair_axis?.classify_judgment(judgment.result) ?? null;
        results[t.diagnoser.id].by_provider[t.provider] = {
          judgment: judgment.result,
          classified,
        };
      } catch (err) {
        results[t.diagnoser.id].by_provider[t.provider] = {
          judgment: null,
          classified: null,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  }
  await Promise.allSettled(
    Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()),
  );

  return NextResponse.json({
    results,
    providers_run: providersToRun,
    diagnoser_ids: selected.map((d) => d.id),
    intent_used: userIntent ?? null,
  });
}

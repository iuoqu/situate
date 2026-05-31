import { NextResponse, type NextRequest } from "next/server";

import {
  type DiagnoserDefinition,
  listDiagnosers,
} from "@/lib/coach/diagnosers/registry";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * POST /api/coach/diagnose
 *
 * User-facing version of /api/dev/coach-preview. Authenticates via
 * Supabase session (the user's normal login) instead of the dev
 * DIAGNOSTIC_INTERNAL_TOKEN bearer.
 *
 * Body and response shape match /api/dev/coach-preview exactly so
 * the same client components can target either.
 *
 * Used by /write/guided (internal beta). When the prototype is
 * validated and we open more user-facing surfaces (inline AI in
 * template editor, etc.) they should all target this endpoint, not
 * the dev one.
 *
 * NOTE: Duplicates the worker-pool logic from coach-preview. When we
 * have multiple consumers we'll refactor into a shared lib function.
 * For now the duplication is bounded and explicit.
 */
export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

interface Body {
  text: string;
  providers: string[];
  diagnoser_ids?: string[];
  concurrency?: number;
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
  // Supabase session auth
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

  const userText = parsed.text;
  const providersToRun = parsed.providers;
  const userIntent = parsed.intent?.trim() || undefined;

  const all = listDiagnosers();
  const requestedIds = parsed.diagnoser_ids;
  const candidate: DiagnoserDefinition[] = requestedIds
    ? all.filter((d) => requestedIds.includes(d.id))
    : all;
  const selected = userIntent
    ? candidate
    : candidate.filter((d) => !d.requires_intent);
  const skipped = candidate
    .filter((d) => d.requires_intent && !userIntent)
    .map((d) => d.id);
  if (selected.length === 0) {
    return NextResponse.json(
      {
        error:
          skipped.length > 0
            ? `all matching diagnosers require intent; provide an intent block. Skipped: ${skipped.join(", ")}`
            : "no matching diagnosers",
      },
      { status: 400 },
    );
  }

  const INTERNAL_PROVIDER = "__internal__";

  type Task = { diagnoser: DiagnoserDefinition; provider: string };
  const tasks: Task[] = [];
  for (const d of selected) {
    if (d.provider_fanout === false) {
      tasks.push({ diagnoser: d, provider: INTERNAL_PROVIDER });
    } else {
      for (const p of providersToRun) {
        tasks.push({ diagnoser: d, provider: p });
      }
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

  const concurrency = parsed.concurrency ?? 8;
  const queue = [...tasks];
  async function worker() {
    while (queue.length > 0) {
      const t = queue.shift();
      if (!t) return;
      try {
        const intentForCall = t.diagnoser.requires_intent
          ? userIntent
          : undefined;
        const providerForCall =
          t.diagnoser.provider_fanout === false ? undefined : t.provider;
        const judgment = (await t.diagnoser.run(
          userText,
          providerForCall,
          intentForCall,
        )) as { result: unknown };
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
    skipped_diagnoser_ids: skipped,
    intent_used: userIntent ?? null,
  });
}

import { type NextRequest, NextResponse } from "next/server";

import { check, confidence, primaryEngine } from "@/lib/eval/check";
import { listSpecimens, type Specimen } from "@/lib/eval/specimens";
import { requireBearerToken } from "@/lib/skeleton-diagnostic/auth";
import { diagnoseSkeleton } from "@/lib/skeleton-diagnostic/diagnose";
import type {
  DiagnosticMode,
  SkeletonDiagnostic,
} from "@/lib/skeleton-diagnostic/types";

/**
 * POST /api/dev/run-eval
 *
 * Body: { mode?: "full" | "partial" | "both", concurrency?: number }
 *
 * Streams results as Server-Sent Events. Three event types:
 *   - `result`   { path, bucket, diagnostic, check, primary_engine, confidence }
 *   - `progress` { completed, total }
 *   - `done`     { passed, total, by_bucket }
 *
 * For 36 specimens at concurrency 4 this runs in ~30-90s. The page can
 * render each row as it arrives instead of staring at a spinner.
 */
export const runtime = "nodejs";
export const maxDuration = 300; // 5 min — enough room for the full suite
export const dynamic = "force-dynamic";

const DEFAULT_CONCURRENCY = 4;

interface Body {
  mode: "full" | "partial" | "both";
  concurrency: number;
}

function parseBody(raw: unknown): Body | string {
  if (typeof raw !== "object" || raw === null) return "body must be an object";
  const obj = raw as Record<string, unknown>;
  const mode = obj.mode ?? "both";
  if (mode !== "full" && mode !== "partial" && mode !== "both") {
    return "mode must be full | partial | both";
  }
  const concurrency = typeof obj.concurrency === "number"
    ? obj.concurrency
    : DEFAULT_CONCURRENCY;
  if (concurrency < 1 || concurrency > 16) {
    return "concurrency must be 1..16";
  }
  return { mode, concurrency };
}

function selectSpecimens(mode: Body["mode"]): Array<Specimen & { run_mode: DiagnosticMode }> {
  const all = listSpecimens();
  if (mode === "full") {
    return all
      .filter((s) => !s.is_partial)
      .map((s) => ({ ...s, run_mode: "full" as const }));
  }
  if (mode === "partial") {
    return all
      .filter((s) => s.is_partial)
      .map((s) => ({ ...s, run_mode: "partial" as const }));
  }
  return all.map((s) => ({
    ...s,
    run_mode: (s.is_partial ? "partial" : "full") as DiagnosticMode,
  }));
}

const encoder = new TextEncoder();

function sse(controller: ReadableStreamDefaultController, event: string, data: unknown): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  controller.enqueue(encoder.encode(payload));
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

  const targets = selectSpecimens(parsed.mode);
  const total = targets.length;
  let completed = 0;
  let passed = 0;
  const byBucket: Record<string, { passed: number; total: number }> = {
    train: { passed: 0, total: 0 },
    holdout: { passed: 0, total: 0 },
    partial: { passed: 0, total: 0 },
  };
  for (const t of targets) {
    const bucket = t.is_partial ? "partial" : t.is_holdout ? "holdout" : "train";
    byBucket[bucket].total += 1;
  }

  const stream = new ReadableStream({
    async start(controller) {
      sse(controller, "start", { total, mode: parsed.mode, concurrency: parsed.concurrency });

      // simple concurrency-limited fan-out
      const queue = [...targets];
      async function worker(): Promise<void> {
        while (queue.length > 0) {
          const spec = queue.shift();
          if (!spec) return;
          const bucket = spec.is_partial
            ? "partial"
            : spec.is_holdout
              ? "holdout"
              : "train";
          let diagnostic: SkeletonDiagnostic | null = null;
          let error: string | null = null;
          try {
            diagnostic = await diagnoseSkeleton(spec.text, spec.run_mode);
          } catch (e) {
            error = e instanceof Error ? e.message : String(e);
          }

          let checkResult: { ok: boolean; fails: string[] } = { ok: false, fails: [] };
          let conf: number | null = null;
          let engine = "-";
          if (diagnostic && spec.expectation) {
            checkResult = check(diagnostic, spec.expectation);
            conf = confidence(diagnostic);
            engine = primaryEngine(diagnostic);
          }
          if (checkResult.ok) {
            passed += 1;
            byBucket[bucket].passed += 1;
          }
          completed += 1;

          sse(controller, "result", {
            path: spec.path,
            bucket,
            run_mode: spec.run_mode,
            error,
            diagnostic,
            check: checkResult,
            primary_engine: engine,
            confidence: conf,
            expectation: spec.expectation,
          });
          sse(controller, "progress", { completed, total });
        }
      }

      const workers = Array.from(
        { length: Math.min(parsed.concurrency, total) },
        () => worker(),
      );
      await Promise.allSettled(workers);

      sse(controller, "done", {
        total,
        passed,
        by_bucket: byBucket,
      });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      // Vercel + nginx-style proxies buffer responses by default, which
      // breaks SSE (the client sees nothing until the function exits, then
      // either gets the whole thing at once or trips a timeout). This
      // header is the standard opt-out — flushes each chunk through.
      "X-Accel-Buffering": "no",
    },
  });
}

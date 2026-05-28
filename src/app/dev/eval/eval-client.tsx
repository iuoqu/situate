"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { clearDevToken, saveDevToken } from "./actions";

// ─── Types mirrored from server ─────────────────────────────────────────────

type Bucket = "train" | "holdout" | "partial";

interface SpecimenInfo {
  path: string;
  bucket: Bucket;
  bytes: number;
  first_line: string;
  expectation: Record<string, unknown> | null;
}

interface ProviderInfo {
  id: string;
  displayName: string;
  costNote: string;
  available: boolean;
}

interface ProgressEvent {
  completed: number;
  total: number;
}

interface ResultEvent {
  path: string;
  bucket: Bucket;
  run_mode: "full" | "partial";
  provider: string;
  error: string | null;
  diagnostic: unknown;
  check: { ok: boolean; fails: string[] };
  primary_engine: string;
  confidence: number | null;
  expectation: Record<string, unknown> | null;
}

interface DoneEvent {
  total: number;
  passed: number;
  by_bucket: Record<Bucket, { passed: number; total: number }>;
}

// path → providerId → result
type ResultsByPath = Record<string, Record<string, ResultEvent>>;

type ProviderStats = Record<
  string,
  { total: number; passed: number; errored: number; byBucket: Record<Bucket, { passed: number; total: number }> }
>;

// ─── Client-side fan-out ────────────────────────────────────────────────────
// Earlier this module ran the eval via a single SSE streaming call to
// /api/dev/run-eval. That broke on Vercel — long-lived streams get cut by
// the edge layer with net::ERR_CONNECTION_CLOSED. Solution: orchestrate
// from the browser, hit /api/dev/diagnose-by-path once per specimen with
// a small worker pool. Each request is 5-10s, well under any plan's
// function timeout.
//
// "Failed to fetch" errors still happen sporadically on Vercel — the route
// works for some requests in a burst but cold-starting lambdas + the free
// tier's tight concurrency cap kills others. The retry loop below absorbs
// that. Default concurrency stays at 2 to reduce the cold-start pressure.

const FETCH_RETRY_ATTEMPTS = 3;
const FETCH_RETRY_BACKOFF_MS = [1000, 2500, 5000]; // before attempt 1, 2, 3

async function diagnoseOne(
  spec: SpecimenInfo,
  providerId: string,
  signal: AbortSignal,
): Promise<ResultEvent> {
  const mode = spec.bucket === "partial" ? "partial" : "full";
  let lastError = "no attempts made";

  for (let attempt = 0; attempt < FETCH_RETRY_ATTEMPTS; attempt++) {
    if (signal.aborted) {
      return errorRow(spec, providerId, mode, "aborted by user", "aborted");
    }
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, FETCH_RETRY_BACKOFF_MS[attempt - 1] ?? 5000));
      if (signal.aborted) {
        return errorRow(spec, providerId, mode, "aborted by user", "aborted");
      }
    }
    try {
      const resp = await fetch("/api/dev/diagnose-by-path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: spec.path, mode, provider: providerId }),
        credentials: "same-origin",
        signal,
      });
      if (resp.ok) {
        const data = (await resp.json()) as ResultEvent & { error?: string };
        return { ...data, provider: providerId, error: data.error ?? null };
      }
      const text = await resp.text();
      const errMsg = `HTTP ${resp.status}: ${text.slice(0, 160)}`;
      if (resp.status < 500) {
        return errorRow(spec, providerId, mode, errMsg, "http_error");
      }
      lastError = errMsg;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        return errorRow(spec, providerId, mode, "aborted by user", "aborted");
      }
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  return errorRow(
    spec,
    providerId,
    mode,
    `${lastError} (${FETCH_RETRY_ATTEMPTS} attempts)`,
    "fetch_error",
  );
}

function errorRow(
  spec: SpecimenInfo,
  providerId: string,
  mode: "full" | "partial",
  message: string,
  failTag: string,
): ResultEvent {
  return {
    path: spec.path,
    bucket: spec.bucket,
    run_mode: mode,
    provider: providerId,
    error: message,
    diagnostic: null,
    check: { ok: false, fails: [failTag] },
    primary_engine: "-",
    confidence: null,
    expectation: spec.expectation,
  };
}

// Cartesian product worker pool. Each work item is one (specimen × provider)
// pair. Concurrency is global — total in-flight requests across all
// providers, not per-provider.
async function fanOutMulti(
  targets: SpecimenInfo[],
  providerIds: string[],
  concurrency: number,
  signal: AbortSignal,
  onResult: (r: ResultEvent) => void,
  onProgress: (completed: number, total: number) => void,
): Promise<void> {
  const queue: Array<{ spec: SpecimenInfo; providerId: string }> = [];
  for (const spec of targets) {
    for (const providerId of providerIds) {
      queue.push({ spec, providerId });
    }
  }
  let completed = 0;
  const total = queue.length;
  async function worker(): Promise<void> {
    while (queue.length > 0) {
      if (signal.aborted) return;
      const item = queue.shift();
      if (!item) return;
      const result = await diagnoseOne(item.spec, item.providerId, signal);
      onResult(result);
      completed += 1;
      onProgress(completed, total);
    }
  }
  await Promise.allSettled(
    Array.from({ length: Math.min(concurrency, total) }, () => worker()),
  );
}

// ─── Auth panel ─────────────────────────────────────────────────────────────

function TokenPanel({
  initialTokenSet,
  onChange,
}: {
  initialTokenSet: boolean;
  onChange: (set: boolean) => void;
}) {
  const [tokenSet, setTokenSet] = useState(initialTokenSet);
  const [editing, setEditing] = useState(!initialTokenSet);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!input.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await saveDevToken(input.trim());
      // Probe the token by hitting /api/dev/specimens
      const probe = await fetch("/api/dev/specimens", { credentials: "same-origin" });
      if (probe.status === 401) {
        setError("Token saved but unauthorized — value doesn't match the server. Update and save again.");
      } else if (!probe.ok) {
        const t = await probe.text();
        setError(`probe failed: ${probe.status} ${t.slice(0, 120)}`);
      } else {
        setTokenSet(true);
        setEditing(false);
        setInput("");
        onChange(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    await clearDevToken();
    setTokenSet(false);
    setEditing(true);
    onChange(false);
  }

  return (
    <section
      style={{
        padding: 16,
        background: tokenSet && !editing ? "#f5f8f4" : "#fdf5e6",
        border: `1px solid ${tokenSet && !editing ? "#c6d8c0" : "#e6d3a3"}`,
        borderRadius: 4,
        marginBottom: 28,
      }}
    >
      {tokenSet && !editing ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "#2a5230" }}>
            ✓ token cookie set (httpOnly, sent automatically with requests)
          </span>
          <button onClick={clear} style={btnSubtle}>clear</button>
        </div>
      ) : (
        <>
          <label style={{ display: "block", fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2, color: "#665" }}>
            Diagnostic internal token
          </label>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input
              type="password"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="paste the value from Vercel env"
              style={{ ...inputStyle, fontFamily: "monospace" }}
              autoFocus
            />
            <button onClick={save} disabled={busy || !input.trim()} style={btnPrimary}>
              {busy ? "checking…" : "save"}
            </button>
          </div>
          {error && <div style={{ color: "#b00020", fontSize: 12, marginTop: 8 }}>{error}</div>}
        </>
      )}
    </section>
  );
}

// ─── Eval runner ────────────────────────────────────────────────────────────

function EvalSection({
  active,
  specimens,
  providers,
  defaultProviderId,
  results,
  setResults,
  runProviderIds,
  setRunProviderIds,
}: {
  active: boolean;
  specimens: SpecimenInfo[];
  providers: ProviderInfo[];
  defaultProviderId: string | null;
  results: ResultsByPath;
  setResults: (r: ResultsByPath) => void;
  runProviderIds: string[];
  setRunProviderIds: (ids: string[]) => void;
}) {
  const [mode, setMode] = useState<"full" | "partial" | "both">("both");
  const [concurrency, setConcurrency] = useState(2);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  function stop() {
    abortRef.current?.abort();
  }

  // Initialize selection to whichever providers are available, defaulting to
  // the canonical Anthropic one if all keys are configured.
  useEffect(() => {
    if (selectedIds.length === 0 && providers.length > 0) {
      const available = providers.filter((p) => p.available).map((p) => p.id);
      if (available.length === 0) return;
      const initial = defaultProviderId && available.includes(defaultProviderId)
        ? [defaultProviderId]
        : [available[0]];
      setSelectedIds(initial);
    }
  }, [providers, defaultProviderId, selectedIds.length]);

  function toggleProvider(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }
  function selectAll() {
    setSelectedIds(providers.filter((p) => p.available).map((p) => p.id));
  }
  function selectNone() {
    setSelectedIds([]);
  }

  async function run() {
    setError(null);
    setRunning(true);
    setProgress(null);
    setResults({});
    setRunProviderIds(selectedIds);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const targets = specimens.filter((s) => {
      if (mode === "full") return s.bucket !== "partial";
      if (mode === "partial") return s.bucket === "partial";
      return true;
    });

    const local: ResultsByPath = {};
    try {
      await fanOutMulti(
        targets,
        selectedIds,
        concurrency,
        ctrl.signal,
        (r) => {
          if (!local[r.path]) local[r.path] = {};
          local[r.path][r.provider] = r;
          setResults({ ...local });
        },
        (completed, total) => setProgress({ completed, total }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  const totalCalls = selectedIds.length *
    specimens.filter((s) => {
      if (mode === "full") return s.bucket !== "partial";
      if (mode === "partial") return s.bucket === "partial";
      return true;
    }).length;

  return (
    <Section title="Run eval" disabled={!active}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "baseline", marginBottom: 8 }}>
          <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2, color: "#665" }}>
            models
          </span>
          <button type="button" onClick={selectAll} style={btnSubtle} disabled={running}>all available</button>
          <button type="button" onClick={selectNone} style={btnSubtle} disabled={running}>none</button>
          <span style={{ fontSize: 11, color: "#888" }}>
            {selectedIds.length} selected · {totalCalls} calls/run
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {providers.map((p) => (
            <label
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: p.available ? "#1a1a1a" : "#999",
                cursor: p.available && !running ? "pointer" : "not-allowed",
              }}
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(p.id)}
                onChange={() => toggleProvider(p.id)}
                disabled={!p.available || running}
              />
              <span style={{ fontFamily: "monospace", fontSize: 11.5, color: "#666", minWidth: 220 }}>
                {p.id}
              </span>
              <span style={{ minWidth: 160 }}>{p.displayName}</span>
              <span style={{ fontSize: 11, color: "#888" }}>{p.costNote}</span>
              {!p.available && <span style={{ fontSize: 11, color: "#a05300" }}>(no key)</span>}
            </label>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 14 }}>
        <Field label="mode">
          <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} style={inputStyle} disabled={running}>
            <option value="both">both</option>
            <option value="full">full only</option>
            <option value="partial">partial only</option>
          </select>
        </Field>
        <Field label="concurrency">
          <input
            type="number"
            min={1}
            max={16}
            value={concurrency}
            onChange={(e) => setConcurrency(Math.max(1, Math.min(16, Number(e.target.value) || 1)))}
            style={{ ...inputStyle, width: 80 }}
            disabled={running}
          />
        </Field>
        {!running && (
          <button
            onClick={run}
            disabled={!active || selectedIds.length === 0}
            style={btnPrimary}
          >
            run eval ({selectedIds.length})
          </button>
        )}
        {running && (
          <button onClick={stop} style={{ ...btnPrimary, background: "#7c2020" }}>
            stop
          </button>
        )}
        {progress && (
          <span style={{ fontSize: 13, color: "#555" }}>
            {progress.completed} / {progress.total} done
          </span>
        )}
      </div>

      {error && <ErrorBox text={error} />}

      {runProviderIds.length > 0 && (
        <PerProviderSummary
          results={results}
          providers={providers}
          providerIds={runProviderIds}
        />
      )}

      {Object.keys(results).length > 0 && (
        <ComparisonTable
          results={results}
          providers={providers}
          providerIds={runProviderIds}
        />
      )}
    </Section>
  );
}

function PerProviderSummary({
  results,
  providers,
  providerIds,
}: {
  results: ResultsByPath;
  providers: ProviderInfo[];
  providerIds: string[];
}) {
  const stats: ProviderStats = {};
  for (const pid of providerIds) {
    stats[pid] = {
      total: 0,
      passed: 0,
      errored: 0,
      byBucket: {
        train: { passed: 0, total: 0 },
        holdout: { passed: 0, total: 0 },
        partial: { passed: 0, total: 0 },
      },
    };
  }
  for (const byProvider of Object.values(results)) {
    for (const pid of providerIds) {
      const r = byProvider[pid];
      if (!r) continue;
      stats[pid].total += 1;
      stats[pid].byBucket[r.bucket].total += 1;
      if (r.error) {
        stats[pid].errored += 1;
      } else if (r.check.ok) {
        stats[pid].passed += 1;
        stats[pid].byBucket[r.bucket].passed += 1;
      }
    }
  }

  return (
    <div
      style={{
        padding: 14,
        background: "#fafaf7",
        border: "1px solid #e8e3d8",
        borderRadius: 4,
        marginBottom: 16,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        fontSize: 13,
      }}
    >
      {providerIds.map((pid) => {
        const s = stats[pid];
        const p = providers.find((x) => x.id === pid);
        if (!p || !s) return null;
        const pct = s.total ? Math.round((s.passed / s.total) * 100) : 0;
        const trainPct = s.byBucket.train.total
          ? (s.byBucket.train.passed / s.byBucket.train.total) * 100
          : 0;
        const holdoutPct = s.byBucket.holdout.total
          ? (s.byBucket.holdout.passed / s.byBucket.holdout.total) * 100
          : 0;
        const delta = trainPct - holdoutPct;
        const overfit = delta > 15;
        return (
          <div key={pid} style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "baseline" }}>
            <span style={{ fontWeight: 600, minWidth: 160 }}>{p.displayName}</span>
            <span><strong>{s.passed}/{s.total}</strong> ({pct}%)</span>
            <span style={{ color: "#666" }}>
              train {s.byBucket.train.passed}/{s.byBucket.train.total} · holdout{" "}
              {s.byBucket.holdout.passed}/{s.byBucket.holdout.total} · partial{" "}
              {s.byBucket.partial.passed}/{s.byBucket.partial.total}
            </span>
            {s.errored > 0 && (
              <span style={{ color: "#a05300" }}>{s.errored} err</span>
            )}
            {overfit && (
              <span style={{ color: "#a05300", fontWeight: 600 }}>
                ⚠ train−holdout {delta.toFixed(0)}%
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function shortProviderName(pid: string, providers: ProviderInfo[]): string {
  const p = providers.find((x) => x.id === pid);
  if (!p) return pid;
  // Last word of displayName is usually enough — e.g. "Sonnet 4.6"
  const parts = p.displayName.split(/\s+/);
  return parts.slice(-2).join(" ");
}

function ComparisonTable({
  results,
  providers,
  providerIds,
}: {
  results: ResultsByPath;
  providers: ProviderInfo[];
  providerIds: string[];
}) {
  const sortedPaths = Object.keys(results).sort();

  function cellFor(r: ResultEvent | undefined): React.ReactNode {
    if (!r) return <span style={{ color: "#bbb" }}>—</span>;
    const verdict = r.error ? "ERR" : r.check.ok ? "PASS" : "FAIL";
    const color = r.error ? "#a05300" : r.check.ok ? "#2a5230" : "#b00020";
    const conf = r.confidence == null ? "" : r.confidence.toFixed(2);
    const tip = r.error
      ? r.error
      : r.check.fails.length > 0
        ? r.check.fails.join(", ")
        : "ok";
    // For errors and fails, show the message inline (truncated) below the
    // verdict — saves a hover. Full text still in title attribute.
    const inline = r.error
      ? r.error
      : !r.check.ok
        ? r.check.fails.join(", ")
        : "";
    return (
      <div title={tip} style={{ minWidth: 220, maxWidth: 360 }}>
        <div style={{ color, fontWeight: 600, fontSize: 11.5 }}>
          {verdict}
          {conf && (
            <span style={{ color: "#666", fontWeight: 400, marginLeft: 4 }}>
              {conf}
            </span>
          )}
        </div>
        {inline && (
          <div
            style={{
              fontSize: 10.5,
              color: r.error ? "#a05300" : "#7c2020",
              marginTop: 2,
              wordBreak: "break-word",
              whiteSpace: "pre-wrap",
              lineHeight: 1.35,
              fontFamily: r.error
                ? 'ui-monospace, "SF Mono", Menlo, monospace'
                : "inherit",
            }}
          >
            {inline}
          </div>
        )}
      </div>
    );
  }

  function agreementBadge(byProvider: Record<string, ResultEvent>): React.ReactNode {
    const verdicts = providerIds
      .map((pid) => byProvider[pid])
      .filter((r): r is ResultEvent => r != null && !r.error)
      .map((r) => r.check.ok);
    if (verdicts.length === 0) return <span style={{ color: "#bbb" }}>—</span>;
    const allPass = verdicts.every((v) => v);
    const allFail = verdicts.every((v) => !v);
    if (allPass) return <span style={{ color: "#2a5230" }}>✓ all</span>;
    if (allFail) return <span style={{ color: "#b00020" }}>✗ all</span>;
    return <span style={{ color: "#a05300", fontWeight: 600 }}>split</span>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #ddd", textAlign: "left", color: "#666" }}>
            <th style={th}>path</th>
            <th style={th}>bucket</th>
            {providerIds.map((pid) => (
              <th key={pid} style={th}>{shortProviderName(pid, providers)}</th>
            ))}
            <th style={th}>agree</th>
          </tr>
        </thead>
        <tbody>
          {sortedPaths.map((path) => {
            const byProvider = results[path] ?? {};
            const anyR = Object.values(byProvider)[0];
            return (
              <tr key={path} style={{ borderBottom: "1px solid #f0ecdf" }}>
                <td style={{ ...td, fontFamily: "monospace", fontSize: 11.5 }}>{path}</td>
                <td style={td}>{anyR?.bucket ?? "-"}</td>
                {providerIds.map((pid) => (
                  <td key={pid} style={td}>{cellFor(byProvider[pid])}</td>
                ))}
                <td style={td}>{agreementBadge(byProvider)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Revise section ─────────────────────────────────────────────────────────

interface ReviseResponse {
  ok_no_revision_needed?: boolean;
  counts?: { failures: number; borderlines: number; healthy: number };
  proposal?: {
    diagnosis: Array<{
      failure_pattern: string;
      affected_specimens: string[];
      root_cause: string;
      evidence: string;
    }>;
    proposed_edits: Array<{
      target_rubric: string;
      summary: string;
      before_snippet: string;
      after_snippet: string;
      expected_to_fix: string[];
      risk_of_breaking: string[];
    }>;
    skeleton_questions: string[];
    overall_assessment: string;
  };
}

function ReviseSection({
  active,
  results,
  haveResults,
  runProviderIds,
  providers,
}: {
  active: boolean;
  results: ResultsByPath;
  haveResults: boolean;
  runProviderIds: string[];
  providers: ProviderInfo[];
}) {
  const [mode, setMode] = useState<"full" | "partial">("full");
  const [includeHoldout, setIncludeHoldout] = useState(false);
  const [sourceProviderId, setSourceProviderId] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<ReviseResponse | null>(null);

  // Default the source provider to whichever ran most recently (first in
  // the list) once we have results.
  useEffect(() => {
    if (!sourceProviderId && runProviderIds.length > 0) {
      setSourceProviderId(runProviderIds[0]);
    }
  }, [sourceProviderId, runProviderIds]);

  async function run() {
    setError(null);
    setResponse(null);
    setRunning(true);
    try {
      // Only send results matching the rubric mode AND from the chosen provider
      const filtered: Record<string, unknown> = {};
      for (const [path, byProvider] of Object.entries(results)) {
        const r = byProvider[sourceProviderId];
        if (!r) continue;
        if ((mode === "partial") === (r.run_mode === "partial") && r.diagnostic && !r.error) {
          filtered[path] = r.diagnostic;
        }
      }
      const resp = await fetch("/api/dev/revise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, include_holdout: includeHoldout, results: filtered }),
        credentials: "same-origin",
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${text.slice(0, 300)}`);
      }
      const data = (await resp.json()) as ReviseResponse;
      setResponse(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <Section title="Propose rubric revisions" disabled={!active}>
      {!haveResults && (
        <p style={mutedStyle}>Run an eval first — revisions are computed from the most recent diagnostics.</p>
      )}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 14, flexWrap: "wrap" }}>
        <Field label="target rubric">
          <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} style={inputStyle} disabled={running}>
            <option value="full">RUBRIC_FULL</option>
            <option value="partial">RUBRIC_PARTIAL</option>
          </select>
        </Field>
        <Field label="based on results from">
          <select
            value={sourceProviderId}
            onChange={(e) => setSourceProviderId(e.target.value)}
            style={{ ...inputStyle, minWidth: 220 }}
            disabled={running || runProviderIds.length === 0}
          >
            {runProviderIds.length === 0 && <option value="">(no results yet)</option>}
            {runProviderIds.map((pid) => {
              const p = providers.find((x) => x.id === pid);
              return (
                <option key={pid} value={pid}>
                  {p?.displayName ?? pid}
                </option>
              );
            })}
          </select>
        </Field>
        <label style={{ fontSize: 13, display: "flex", gap: 6, alignItems: "center", paddingBottom: 9 }}>
          <input type="checkbox" checked={includeHoldout} onChange={(e) => setIncludeHoldout(e.target.checked)} disabled={running} />
          include holdout (final check only)
        </label>
        <button onClick={run} disabled={!active || !haveResults || running || !sourceProviderId} style={btnPrimary}>
          {running ? "thinking…" : "propose"}
        </button>
      </div>

      {error && <ErrorBox text={error} />}

      {response?.ok_no_revision_needed && (
        <div style={{ padding: 12, background: "#f5f8f4", border: "1px solid #c6d8c0", borderRadius: 4, fontSize: 13 }}>
          No failures, no borderlines. Rubric is stable on this run.
        </div>
      )}

      {response?.proposal && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {response.counts && (
            <div style={{ fontSize: 12, color: "#666" }}>
              fed in: {response.counts.failures} failures, {response.counts.borderlines} borderlines,{" "}
              {response.counts.healthy} healthy
            </div>
          )}

          <SubSection title="Diagnosis">
            {response.proposal.diagnosis.map((d, i) => (
              <div key={i} style={proposalCard}>
                <div style={{ fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>
                  {d.root_cause}
                </div>
                <div style={{ fontWeight: 600, marginTop: 4 }}>{d.failure_pattern}</div>
                <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
                  affects: {d.affected_specimens.join(", ")}
                </div>
                <div style={{ fontSize: 13, marginTop: 8, lineHeight: 1.55 }}>{d.evidence}</div>
              </div>
            ))}
          </SubSection>

          <SubSection title="Proposed edits">
            {response.proposal.proposed_edits.map((e, i) => (
              <div key={i} style={proposalCard}>
                <div style={{ fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>
                  {e.target_rubric} • edit {i + 1}
                </div>
                <div style={{ fontWeight: 600, marginTop: 4 }}>{e.summary}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                  <div>
                    <div style={diffLabel}>before</div>
                    <pre style={diffBox}>{e.before_snippet}</pre>
                  </div>
                  <div>
                    <div style={{ ...diffLabel, color: "#2a5230" }}>after</div>
                    <pre style={{ ...diffBox, background: "#f3f9f1" }}>{e.after_snippet}</pre>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 18, marginTop: 10, fontSize: 12 }}>
                  <div>
                    <strong>fixes</strong>: {e.expected_to_fix.join(", ") || "—"}
                  </div>
                  <div style={{ color: "#a05300" }}>
                    <strong>risk</strong>: {e.risk_of_breaking.join(", ") || "—"}
                  </div>
                </div>
              </div>
            ))}
          </SubSection>

          {response.proposal.skeleton_questions.length > 0 && (
            <SubSection title="Skeleton-level questions (need human decision)">
              <ul style={{ paddingLeft: 20, fontSize: 13, lineHeight: 1.6 }}>
                {response.proposal.skeleton_questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </SubSection>
          )}

          <div style={{ ...proposalCard, background: "#f7f5ec", borderColor: "#e3dcc4" }}>
            <strong>Overall:</strong> {response.proposal.overall_assessment}
          </div>
        </div>
      )}
    </Section>
  );
}

// ─── Generate section ───────────────────────────────────────────────────────

interface GenerationResult {
  variant_text: string;
  proposed_expectation: Record<string, unknown>;
  design_notes: string;
}

function GenerateSection({
  active,
  specimens,
}: {
  active: boolean;
  specimens: SpecimenInfo[];
}) {
  const [seed, setSeed] = useState<string>("");
  const [transform, setTransform] = useState("");
  const [strict, setStrict] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);

  useEffect(() => {
    if (!seed && specimens.length) setSeed(specimens[0]!.path);
  }, [seed, specimens]);

  const seedExpectation = useMemo(
    () => specimens.find((s) => s.path === seed)?.expectation ?? null,
    [seed, specimens],
  );

  async function run() {
    setError(null);
    setResult(null);
    setRunning(true);
    try {
      const seedSpec = specimens.find((s) => s.path === seed);
      if (!seedSpec) throw new Error("seed not found");
      // We don't have the text here — fetch it once
      const textResp = await fetch(`/api/dev/specimens`, { credentials: "same-origin" });
      if (!textResp.ok) throw new Error("failed to fetch specimens");
      // We actually need the text — list endpoint omits it. Use a side trick:
      // post directly to /api/generate-variation which accepts arbitrary seed_text.
      // For UI ergonomics we'd want a small "fetch text" endpoint; for MVP, embed
      // the text by reading from the seed dropdown's first_line is wrong. Use a
      // dedicated read instead.
      const readResp = await fetch(`/api/dev/specimens/text?path=${encodeURIComponent(seed)}`, {
        credentials: "same-origin",
      });
      if (!readResp.ok) throw new Error(`failed to read seed: ${readResp.status}`);
      const { text } = (await readResp.json()) as { text: string };

      const resp = await fetch("/api/generate-variation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seed_text: text,
          seed_expectation: seedExpectation ?? undefined,
          transform,
          strict,
        }),
        credentials: "same-origin",
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${txt.slice(0, 300)}`);
      }
      const data = (await resp.json()) as GenerationResult;
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  function download(filename: string, content: string) {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Section title="Generate variation" disabled={!active}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="seed">
          <select value={seed} onChange={(e) => setSeed(e.target.value)} style={inputStyle} disabled={running}>
            {specimens.map((s) => (
              <option key={s.path} value={s.path}>
                [{s.bucket}] {s.path}
              </option>
            ))}
          </select>
        </Field>
        <Field label="transform">
          <textarea
            value={transform}
            onChange={(e) => setTransform(e.target.value)}
            placeholder="e.g. 把引擎改成 inevitability，保持 understanding 维度"
            style={{ ...inputStyle, minHeight: 80, fontFamily: "inherit" }}
            disabled={running}
          />
        </Field>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <label style={{ fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={strict} onChange={(e) => setStrict(e.target.checked)} disabled={running} />
            strict (opus-4-7, 贵 5×)
          </label>
          <button onClick={run} disabled={!active || running || !transform.trim()} style={btnPrimary}>
            {running ? "generating…" : "generate"}
          </button>
        </div>
      </div>

      {error && <ErrorBox text={error} />}

      {result && (
        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={diffLabel}>variant text</div>
            <pre style={{ ...diffBox, background: "white", maxHeight: 320, overflow: "auto" }}>
              {result.variant_text}
            </pre>
          </div>
          <div>
            <div style={diffLabel}>proposed expectation</div>
            <pre style={{ ...diffBox, background: "white" }}>
              {JSON.stringify(result.proposed_expectation, null, 2)}
            </pre>
          </div>
          <div>
            <div style={diffLabel}>design notes</div>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>{result.design_notes}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => download("variant.txt", result.variant_text)}
              style={btnSecondary}
            >
              download .txt
            </button>
            <button
              onClick={() => download("variant.expectation.json", JSON.stringify(result.proposed_expectation, null, 2))}
              style={btnSecondary}
            >
              download expectation.json
            </button>
          </div>
        </div>
      )}
    </Section>
  );
}

// ─── Top-level orchestrator ─────────────────────────────────────────────────

export function EvalClient({ initialTokenSet }: { initialTokenSet: boolean }) {
  const [tokenSet, setTokenSet] = useState(initialTokenSet);
  const [specimens, setSpecimens] = useState<SpecimenInfo[] | null>(null);
  const [specimensError, setSpecimensError] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [defaultProviderId, setDefaultProviderId] = useState<string | null>(null);
  const [results, setResults] = useState<ResultsByPath>({});
  const [runProviderIds, setRunProviderIds] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    setSpecimensError(null);
    try {
      const [specResp, provResp] = await Promise.all([
        fetch("/api/dev/specimens", { credentials: "same-origin" }),
        fetch("/api/dev/providers", { credentials: "same-origin" }),
      ]);
      if (specResp.status === 401 || provResp.status === 401) {
        setSpecimens(null);
        setProviders([]);
        setSpecimensError("token rejected by server");
        return;
      }
      if (!specResp.ok) throw new Error(`specimens HTTP ${specResp.status}`);
      if (!provResp.ok) throw new Error(`providers HTTP ${provResp.status}`);
      const specData = (await specResp.json()) as { specimens: SpecimenInfo[] };
      const provData = (await provResp.json()) as {
        default: string;
        providers: ProviderInfo[];
      };
      setSpecimens(specData.specimens);
      setProviders(provData.providers);
      setDefaultProviderId(provData.default);
    } catch (e) {
      setSpecimensError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    if (tokenSet) void refresh();
  }, [tokenSet, refresh]);

  return (
    <>
      <TokenPanel initialTokenSet={initialTokenSet} onChange={setTokenSet} />

      {tokenSet && specimens && (
        <div style={{ fontSize: 12, color: "#666", marginBottom: 18 }}>
          {specimens.length} specimens loaded:{" "}
          {specimens.filter((s) => s.bucket === "train").length} train,{" "}
          {specimens.filter((s) => s.bucket === "holdout").length} holdout,{" "}
          {specimens.filter((s) => s.bucket === "partial").length} partial
          {" · "}
          {providers.filter((p) => p.available).length}/{providers.length} model providers configured
        </div>
      )}
      {tokenSet && specimensError && <ErrorBox text={specimensError} />}

      <EvalSection
        active={tokenSet && !!specimens && providers.length > 0}
        specimens={specimens ?? []}
        providers={providers}
        defaultProviderId={defaultProviderId}
        results={results}
        setResults={setResults}
        runProviderIds={runProviderIds}
        setRunProviderIds={setRunProviderIds}
      />
      <ReviseSection
        active={tokenSet && !!specimens}
        results={results}
        haveResults={Object.keys(results).length > 0}
        runProviderIds={runProviderIds}
        providers={providers}
      />
      <GenerateSection active={tokenSet && !!specimens} specimens={specimens ?? []} />
    </>
  );
}

// ─── Layout primitives ──────────────────────────────────────────────────────

function Section({
  title,
  disabled,
  children,
}: {
  title: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        marginBottom: 32,
        padding: 18,
        background: "white",
        border: "1px solid #e8e3d8",
        borderRadius: 4,
        opacity: disabled ? 0.55 : 1,
        pointerEvents: disabled ? "none" : "auto",
      }}
    >
      <h2
        style={{
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontWeight: 400,
          fontSize: 20,
          margin: 0,
          marginBottom: 14,
          letterSpacing: -0.2,
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: 1.5,
          color: "#665",
          marginTop: 0,
          marginBottom: 10,
        }}
      >
        {title}
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2, color: "#665" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function ErrorBox({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: 12,
        background: "#fce9e9",
        border: "1px solid #dc2626",
        borderRadius: 4,
        color: "#7f1d1d",
        fontSize: 13,
        marginBottom: 12,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      {text}
    </div>
  );
}

// ─── Inline styles ──────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: 14,
  fontFamily: "inherit",
  border: "1px solid #c8c2b3",
  borderRadius: 3,
  background: "white",
  color: "#1a1a1a",
};

const btnPrimary: React.CSSProperties = {
  padding: "9px 18px",
  background: "#1a1a1a",
  color: "white",
  border: "none",
  borderRadius: 3,
  fontSize: 13,
  letterSpacing: 0.3,
  cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  padding: "7px 14px",
  background: "white",
  color: "#1a1a1a",
  border: "1px solid #c8c2b3",
  borderRadius: 3,
  fontSize: 12,
  cursor: "pointer",
};

const btnSubtle: React.CSSProperties = {
  padding: "5px 10px",
  background: "transparent",
  color: "#666",
  border: "1px solid #c8c2b3",
  borderRadius: 3,
  fontSize: 11,
  cursor: "pointer",
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 8px",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: 1.2,
  fontWeight: 600,
};

const td: React.CSSProperties = { padding: "8px" };

const mutedStyle: React.CSSProperties = { fontSize: 12, color: "#888", marginBottom: 10 };

const proposalCard: React.CSSProperties = {
  padding: 14,
  background: "#fafaf7",
  border: "1px solid #e8e3d8",
  borderRadius: 4,
};

const diffLabel: React.CSSProperties = {
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: 1.2,
  color: "#888",
  marginBottom: 4,
};

const diffBox: React.CSSProperties = {
  background: "#fdf5e6",
  border: "1px solid #e6d3a3",
  padding: 10,
  borderRadius: 3,
  fontSize: 12,
  lineHeight: 1.5,
  whiteSpace: "pre-wrap",
  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
  margin: 0,
};

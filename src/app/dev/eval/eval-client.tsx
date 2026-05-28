"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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

interface ProgressEvent {
  completed: number;
  total: number;
}

interface ResultEvent {
  path: string;
  bucket: Bucket;
  run_mode: "full" | "partial";
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

// ─── SSE consumption ────────────────────────────────────────────────────────

async function streamSSE(
  url: string,
  body: unknown,
  handlers: {
    onEvent: (event: string, data: unknown) => void;
    onError?: (err: unknown) => void;
  },
): Promise<void> {
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`HTTP ${resp.status}: ${text.slice(0, 200)}`);
  }
  if (!resp.body) throw new Error("response has no body");

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nlnl = buf.indexOf("\n\n");
    while (nlnl >= 0) {
      const chunk = buf.slice(0, nlnl);
      buf = buf.slice(nlnl + 2);
      const lines = chunk.split("\n");
      let event = "message";
      const dataParts: string[] = [];
      for (const line of lines) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataParts.push(line.slice(5).trim());
      }
      const dataStr = dataParts.join("\n");
      if (dataStr) {
        try {
          handlers.onEvent(event, JSON.parse(dataStr));
        } catch (e) {
          handlers.onError?.(e);
        }
      }
      nlnl = buf.indexOf("\n\n");
    }
  }
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
  results,
  setResults,
  summary,
  setSummary,
}: {
  active: boolean;
  results: Record<string, ResultEvent>;
  setResults: (r: Record<string, ResultEvent>) => void;
  summary: DoneEvent | null;
  setSummary: (s: DoneEvent | null) => void;
}) {
  const [mode, setMode] = useState<"full" | "partial" | "both">("both");
  const [concurrency, setConcurrency] = useState(4);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    setRunning(true);
    setProgress(null);
    setSummary(null);
    const local: Record<string, ResultEvent> = {};
    setResults({});

    try {
      await streamSSE(
        "/api/dev/run-eval",
        { mode, concurrency },
        {
          onEvent: (event, data) => {
            if (event === "result") {
              const r = data as ResultEvent;
              local[r.path] = r;
              setResults({ ...local });
            } else if (event === "progress") {
              setProgress(data as ProgressEvent);
            } else if (event === "done") {
              setSummary(data as DoneEvent);
            }
          },
          onError: (e) => setError(e instanceof Error ? e.message : String(e)),
        },
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  const sortedResults = useMemo(
    () => Object.values(results).sort((a, b) => a.path.localeCompare(b.path)),
    [results],
  );

  return (
    <Section title="Run eval" disabled={!active}>
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
        <button onClick={run} disabled={!active || running} style={btnPrimary}>
          {running ? "running…" : "run eval"}
        </button>
        {progress && (
          <span style={{ fontSize: 13, color: "#555" }}>
            {progress.completed} / {progress.total} done
          </span>
        )}
      </div>

      {error && <ErrorBox text={error} />}

      {summary && <SummaryBlock summary={summary} />}

      {sortedResults.length > 0 && <ResultsTable results={sortedResults} />}
    </Section>
  );
}

function SummaryBlock({ summary }: { summary: DoneEvent }) {
  const { by_bucket } = summary;
  const trainPct = by_bucket.train.total ? (by_bucket.train.passed / by_bucket.train.total) * 100 : 0;
  const holdoutPct = by_bucket.holdout.total ? (by_bucket.holdout.passed / by_bucket.holdout.total) * 100 : 0;
  const delta = trainPct - holdoutPct;
  const overfit = delta > 15;
  return (
    <div
      style={{
        padding: 14,
        background: "#fafaf7",
        border: "1px solid #e8e3d8",
        borderRadius: 4,
        marginBottom: 16,
        display: "flex",
        flexWrap: "wrap",
        gap: 18,
        fontSize: 13,
      }}
    >
      <div><strong>total</strong> {summary.passed}/{summary.total} ({summary.total ? Math.round((summary.passed / summary.total) * 100) : 0}%)</div>
      <div>train {by_bucket.train.passed}/{by_bucket.train.total} ({Math.round(trainPct)}%)</div>
      <div>holdout {by_bucket.holdout.passed}/{by_bucket.holdout.total} ({Math.round(holdoutPct)}%)</div>
      <div>partial {by_bucket.partial.passed}/{by_bucket.partial.total}</div>
      {overfit && (
        <div style={{ color: "#a05300", fontWeight: 600 }}>
          ⚠ train − holdout = {delta.toFixed(0)}% → possible overfit
        </div>
      )}
    </div>
  );
}

function ResultsTable({ results }: { results: ResultEvent[] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #ddd", textAlign: "left", color: "#666" }}>
            <th style={th}>path</th>
            <th style={th}>bucket</th>
            <th style={th}>mode</th>
            <th style={th}>engine</th>
            <th style={th}>conf</th>
            <th style={th}>verdict</th>
            <th style={th}>fails / error</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.path} style={{ borderBottom: "1px solid #f0ecdf" }}>
              <td style={{ ...td, fontFamily: "monospace", fontSize: 11.5 }}>{r.path}</td>
              <td style={td}>{r.bucket}</td>
              <td style={td}>{r.run_mode}</td>
              <td style={td}>{r.primary_engine}</td>
              <td style={td}>{r.confidence == null ? "-" : r.confidence.toFixed(2)}</td>
              <td style={{ ...td, color: r.error ? "#a05300" : r.check.ok ? "#2a5230" : "#b00020", fontWeight: 600 }}>
                {r.error ? "ERR" : r.check.ok ? "PASS" : "FAIL"}
              </td>
              <td style={{ ...td, color: "#7c2020", fontSize: 11.5, maxWidth: 280 }}>
                {r.error ?? r.check.fails.join(", ")}
              </td>
            </tr>
          ))}
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
}: {
  active: boolean;
  results: Record<string, ResultEvent>;
  haveResults: boolean;
}) {
  const [mode, setMode] = useState<"full" | "partial">("full");
  const [includeHoldout, setIncludeHoldout] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<ReviseResponse | null>(null);

  async function run() {
    setError(null);
    setResponse(null);
    setRunning(true);
    try {
      // Only send results matching the rubric mode (full vs partial)
      const filtered: Record<string, unknown> = {};
      for (const [path, r] of Object.entries(results)) {
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
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 14 }}>
        <Field label="target rubric">
          <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} style={inputStyle} disabled={running}>
            <option value="full">RUBRIC_FULL</option>
            <option value="partial">RUBRIC_PARTIAL</option>
          </select>
        </Field>
        <label style={{ fontSize: 13, display: "flex", gap: 6, alignItems: "center", paddingBottom: 9 }}>
          <input type="checkbox" checked={includeHoldout} onChange={(e) => setIncludeHoldout(e.target.checked)} disabled={running} />
          include holdout (final check only)
        </label>
        <button onClick={run} disabled={!active || !haveResults || running} style={btnPrimary}>
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
  const [results, setResults] = useState<Record<string, ResultEvent>>({});
  const [summary, setSummary] = useState<DoneEvent | null>(null);

  const refreshSpecimens = useCallback(async () => {
    setSpecimensError(null);
    try {
      const resp = await fetch("/api/dev/specimens", { credentials: "same-origin" });
      if (resp.status === 401) {
        setSpecimens(null);
        setSpecimensError("token rejected by server");
        return;
      }
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = (await resp.json()) as { specimens: SpecimenInfo[] };
      setSpecimens(data.specimens);
    } catch (e) {
      setSpecimensError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    if (tokenSet) void refreshSpecimens();
  }, [tokenSet, refreshSpecimens]);

  return (
    <>
      <TokenPanel initialTokenSet={initialTokenSet} onChange={setTokenSet} />

      {tokenSet && specimens && (
        <div style={{ fontSize: 12, color: "#666", marginBottom: 18 }}>
          {specimens.length} specimens loaded:{" "}
          {specimens.filter((s) => s.bucket === "train").length} train,{" "}
          {specimens.filter((s) => s.bucket === "holdout").length} holdout,{" "}
          {specimens.filter((s) => s.bucket === "partial").length} partial
        </div>
      )}
      {tokenSet && specimensError && <ErrorBox text={specimensError} />}

      <EvalSection
        active={tokenSet && !!specimens}
        results={results}
        setResults={setResults}
        summary={summary}
        setSummary={setSummary}
      />
      <ReviseSection
        active={tokenSet && !!specimens}
        results={results}
        haveResults={Object.keys(results).length > 0}
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

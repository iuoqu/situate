"use client";

import { useEffect, useMemo, useState } from "react";

import { clearDevToken, saveDevToken } from "../eval/actions";

interface ProviderInfo {
  id: string;
  displayName: string;
  costNote: string;
  available: boolean;
}

interface DiagnoserInfo {
  id: string;
  display_name: string;
  status: "experimental" | "production";
  description: string;
  supports_pair_test: boolean;
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

interface PreviewResponse {
  results: Record<string, DiagnoserResult>;
  providers_run: string[];
  diagnoser_ids: string[];
}

type Tier = "present" | "implicit" | "absent" | "unknown";

const SAMPLE_TEXT = `公寓三楼门铃响了。门内有人在做饭。门外站着一个约六十岁的男性，两手空着。
开门的人开了门。两人在门两侧站着，约十秒。屋内传出水开的声音。
门外的人开口说话。门内的人点了一下头。`;

export function CoachPreviewClient({
  initialTokenSet,
}: {
  initialTokenSet: boolean;
}) {
  const [tokenSet, setTokenSet] = useState(initialTokenSet);
  const [tokenInput, setTokenInput] = useState("");
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [diagnosers, setDiagnosers] = useState<DiagnoserInfo[]>([]);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [selectedDiagnosers, setSelectedDiagnosers] = useState<string[]>([]);
  const [text, setText] = useState(SAMPLE_TEXT);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<PreviewResponse | null>(null);

  // Fetch providers + diagnosers once token is set
  useEffect(() => {
    if (!tokenSet) return;
    Promise.all([
      fetch("/api/dev/providers", { credentials: "same-origin" }).then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(`providers HTTP ${r.status}`)),
      ),
      fetch("/api/dev/run-diagnoser", { credentials: "same-origin" }).then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(`diagnosers HTTP ${r.status}`)),
      ),
    ])
      .then(([pData, dData]: [
        { providers: ProviderInfo[] },
        { diagnosers: DiagnoserInfo[] },
      ]) => {
        setProviders(pData.providers);
        setDiagnosers(dData.diagnosers);
        setSelectedProviders(
          pData.providers.filter((p) => p.available).map((p) => p.id),
        );
        setSelectedDiagnosers(dData.diagnosers.map((d) => d.id));
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [tokenSet]);

  async function handleSaveToken(e: React.FormEvent) {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    await saveDevToken(tokenInput.trim());
    setTokenSet(true);
    setTokenInput("");
  }
  async function handleClearToken() {
    await clearDevToken();
    setTokenSet(false);
    setProviders([]);
    setDiagnosers([]);
    setSelectedProviders([]);
    setSelectedDiagnosers([]);
    setResponse(null);
  }

  async function runPreview() {
    if (!text.trim()) {
      setError("Paste some prose first.");
      return;
    }
    if (selectedProviders.length === 0) {
      setError("Pick at least one provider.");
      return;
    }
    if (selectedDiagnosers.length === 0) {
      setError("Pick at least one diagnoser.");
      return;
    }
    setError(null);
    setResponse(null);
    setRunning(true);
    try {
      const resp = await fetch("/api/dev/coach-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          providers: selectedProviders,
          diagnoser_ids: selectedDiagnosers,
        }),
        credentials: "same-origin",
      });
      if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${body.slice(0, 240)}`);
      }
      const data = (await resp.json()) as PreviewResponse;
      setResponse(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  if (!tokenSet) {
    return (
      <section style={{ marginTop: 24 }}>
        <form onSubmit={handleSaveToken} style={{ display: "flex", gap: 8 }}>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="DIAGNOSTIC_INTERNAL_TOKEN"
            style={{
              flex: 1,
              padding: "8px 10px",
              border: "1px solid #ccc",
              borderRadius: 4,
              fontSize: 14,
            }}
          />
          <button type="submit" style={btnPrimary}>
            Save
          </button>
        </form>
      </section>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <ControlsBar
        providers={providers}
        diagnosers={diagnosers}
        selectedProviders={selectedProviders}
        selectedDiagnosers={selectedDiagnosers}
        onToggleProvider={(id) =>
          setSelectedProviders((p) =>
            p.includes(id) ? p.filter((x) => x !== id) : [...p, id],
          )
        }
        onToggleDiagnoser={(id) =>
          setSelectedDiagnosers((d) =>
            d.includes(id) ? d.filter((x) => x !== id) : [...d, id],
          )
        }
        onClearToken={handleClearToken}
      />

      <section>
        <label
          htmlFor="prose"
          style={{ display: "block", fontSize: 13, color: "#666", marginBottom: 6 }}
        >
          prose
        </label>
        <textarea
          id="prose"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          style={{
            width: "100%",
            padding: 12,
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: 15,
            lineHeight: 1.7,
            border: "1px solid #ccc",
            borderRadius: 4,
            resize: "vertical",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
          <button
            onClick={runPreview}
            disabled={running}
            style={running ? btnPrimaryDisabled : btnPrimary}
          >
            {running
              ? "running…"
              : `diagnose (${selectedDiagnosers.length} × ${selectedProviders.length} = ${selectedDiagnosers.length * selectedProviders.length} calls)`}
          </button>
          {error && (
            <span style={{ color: "#a04040", fontSize: 13 }}>{error}</span>
          )}
        </div>
      </section>

      {response && (
        <CoachPanel response={response} providers={providers} />
      )}
    </div>
  );
}

// ─── Controls ──────────────────────────────────────────────────────────────

function ControlsBar({
  providers,
  diagnosers,
  selectedProviders,
  selectedDiagnosers,
  onToggleProvider,
  onToggleDiagnoser,
  onClearToken,
}: {
  providers: ProviderInfo[];
  diagnosers: DiagnoserInfo[];
  selectedProviders: string[];
  selectedDiagnosers: string[];
  onToggleProvider: (id: string) => void;
  onToggleDiagnoser: (id: string) => void;
  onClearToken: () => void;
}) {
  return (
    <section
      style={{
        background: "#faf8f3",
        padding: 14,
        border: "1px solid #e7e1d3",
        borderRadius: 6,
        display: "flex",
        flexWrap: "wrap",
        gap: 18,
      }}
    >
      <div>
        <div style={controlLabel}>diagnosers</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {diagnosers.map((d) => (
            <label key={d.id} style={chip(selectedDiagnosers.includes(d.id))}>
              <input
                type="checkbox"
                checked={selectedDiagnosers.includes(d.id)}
                onChange={() => onToggleDiagnoser(d.id)}
                style={{ marginRight: 6 }}
              />
              {d.display_name}
              {d.status === "experimental" && (
                <span style={{ color: "#a07a30", fontSize: 11, marginLeft: 4 }}>
                  exp
                </span>
              )}
            </label>
          ))}
        </div>
      </div>
      <div>
        <div style={controlLabel}>providers</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {providers.map((p) => (
            <label
              key={p.id}
              style={{
                ...chip(selectedProviders.includes(p.id)),
                opacity: p.available ? 1 : 0.45,
              }}
              title={p.available ? p.costNote : `unavailable: ${p.costNote}`}
            >
              <input
                type="checkbox"
                checked={selectedProviders.includes(p.id)}
                disabled={!p.available}
                onChange={() => onToggleProvider(p.id)}
                style={{ marginRight: 6 }}
              />
              {p.displayName}
            </label>
          ))}
        </div>
      </div>
      <div style={{ marginLeft: "auto" }}>
        <button onClick={onClearToken} style={btnGhost}>
          clear token
        </button>
      </div>
    </section>
  );
}

// ─── Coach output panel ────────────────────────────────────────────────────

function CoachPanel({
  response,
  providers,
}: {
  response: PreviewResponse;
  providers: ProviderInfo[];
}) {
  const orderedDiagnoserIds = response.diagnoser_ids;
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <h2
        style={{
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: 20,
          fontWeight: 400,
          margin: 0,
        }}
      >
        Coach says
      </h2>
      {orderedDiagnoserIds.map((id) => {
        const result = response.results[id];
        if (!result) return null;
        return (
          <DiagnoserCard
            key={id}
            result={result}
            providers={providers}
            providersRun={response.providers_run}
          />
        );
      })}
    </section>
  );
}

function DiagnoserCard({
  result,
  providers,
  providersRun,
}: {
  result: DiagnoserResult;
  providers: ProviderInfo[];
  providersRun: string[];
}) {
  const [showDetail, setShowDetail] = useState(false);

  const tierByProvider = useMemo(() => {
    const map: Record<string, Tier> = {};
    for (const pid of providersRun) {
      const cell = result.by_provider[pid];
      map[pid] = extractTier(cell);
    }
    return map;
  }, [result, providersRun]);

  const { consensus, agreement } = useMemo(
    () => computeConsensus(Object.values(tierByProvider)),
    [tierByProvider],
  );

  const action = tierToAction(result.id, consensus);

  return (
    <div
      style={{
        border: "1px solid #e0dccb",
        borderLeft: `4px solid ${tierColor(consensus)}`,
        borderRadius: 4,
        padding: "14px 16px",
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <h3
          style={{
            margin: 0,
            fontSize: 15,
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontWeight: 400,
          }}
        >
          {result.display_name}
        </h3>
        <span style={{ fontSize: 12, color: tierColor(consensus), fontWeight: 600 }}>
          {consensus}
        </span>
        <span style={{ fontSize: 12, color: "#999" }}>
          {agreement.note}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 12 }}>
          <button onClick={() => setShowDetail((s) => !s)} style={btnGhost}>
            {showDetail ? "hide" : "show"} per-provider
          </button>
        </span>
      </div>
      <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.6 }}>
        {action.head && (
          <div style={{ color: "#333", marginBottom: 6 }}>{action.head}</div>
        )}
        {action.quotes.length > 0 && (
          <ul style={{ margin: "4px 0 8px 18px", padding: 0, color: "#555" }}>
            {action.quotes.map((q, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                <em>{q}</em>
              </li>
            ))}
          </ul>
        )}
        {action.question && (
          <div
            style={{
              marginTop: 6,
              padding: "8px 12px",
              background: "#f8f5ec",
              borderRadius: 4,
              color: "#5a3a10",
              fontSize: 14,
            }}
          >
            {action.question}
          </div>
        )}
      </div>
      {showDetail && (
        <PerProviderTable
          result={result}
          providers={providers}
          providersRun={providersRun}
        />
      )}
    </div>
  );
}

function PerProviderTable({
  result,
  providers,
  providersRun,
}: {
  result: DiagnoserResult;
  providers: ProviderInfo[];
  providersRun: string[];
}) {
  return (
    <table
      style={{
        marginTop: 12,
        width: "100%",
        fontSize: 12,
        borderCollapse: "collapse",
      }}
    >
      <thead>
        <tr style={{ textAlign: "left", color: "#888" }}>
          <th style={tdSmall}>provider</th>
          <th style={tdSmall}>verdict</th>
          <th style={tdSmall}>conf</th>
          <th style={tdSmall}>evidence / notes</th>
        </tr>
      </thead>
      <tbody>
        {providersRun.map((pid) => {
          const cell = result.by_provider[pid];
          const provName =
            providers.find((p) => p.id === pid)?.displayName ?? pid;
          if (!cell) {
            return (
              <tr key={pid} style={{ borderTop: "1px solid #eee" }}>
                <td style={tdSmall}>{provName}</td>
                <td style={tdSmall} colSpan={3}>—</td>
              </tr>
            );
          }
          if (cell.error) {
            return (
              <tr key={pid} style={{ borderTop: "1px solid #eee" }}>
                <td style={tdSmall}>{provName}</td>
                <td style={tdSmall} colSpan={3}>
                  <span style={{ color: "#a04040" }}>ERR: {cell.error}</span>
                </td>
              </tr>
            );
          }
          const j = (cell.judgment ?? {}) as Record<string, unknown>;
          const verdict = String(j.verdict ?? "?");
          const confidence =
            typeof j.confidence === "number" ? j.confidence.toFixed(2) : "?";
          const evidence = String(j.evidence ?? j.reorder_test ?? j.who ?? "");
          return (
            <tr key={pid} style={{ borderTop: "1px solid #eee" }}>
              <td style={tdSmall}>{provName}</td>
              <td style={tdSmall}>{verdict}</td>
              <td style={tdSmall}>{confidence}</td>
              <td style={{ ...tdSmall, color: "#555", lineHeight: 1.5 }}>
                {evidence}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ─── Tier mapping ──────────────────────────────────────────────────────────

/**
 * Verdict strings are <prefix>_<tier>. Extract the tier suffix.
 * stakes_absent: K_present / K_implicit / K_absent
 * causal_spine: causal_present / causal_implicit / causal_absent
 * Future diagnosers will follow the same convention.
 */
function extractTier(cell: CellResult | undefined): Tier {
  if (!cell || cell.error) return "unknown";
  const j = (cell.judgment ?? {}) as Record<string, unknown>;
  const verdict = String(j.verdict ?? "");
  if (verdict.endsWith("_present")) return "present";
  if (verdict.endsWith("_implicit")) return "implicit";
  if (verdict.endsWith("_absent")) return "absent";
  return "unknown";
}

function computeConsensus(tiers: Tier[]): {
  consensus: Tier;
  agreement: { all: boolean; note: string };
} {
  const counts: Record<Tier, number> = {
    present: 0,
    implicit: 0,
    absent: 0,
    unknown: 0,
  };
  for (const t of tiers) counts[t] += 1;
  const totalKnown = tiers.length - counts.unknown;
  if (totalKnown === 0) {
    return { consensus: "unknown", agreement: { all: false, note: "no data" } };
  }
  let best: Tier = "unknown";
  let bestCount = -1;
  (["present", "implicit", "absent"] as Tier[]).forEach((t) => {
    if (counts[t] > bestCount) {
      best = t;
      bestCount = counts[t];
    }
  });
  const all = bestCount === totalKnown;
  const note = all
    ? `${bestCount}/${totalKnown} agree`
    : `${bestCount}/${totalKnown} — split`;
  return { consensus: best, agreement: { all, note } };
}

interface CoachAction {
  head: string;
  quotes: string[];
  question: string | null;
}

function tierToAction(diagnoserId: string, tier: Tier): CoachAction {
  if (tier === "present") {
    return {
      head:
        diagnoserId === "stakes_absent"
          ? "承担明确在场。这一段读者知道这件事压在谁身上。"
          : diagnoserId === "causal_spine"
            ? "事件之间因果清晰。这一段不可重排。"
            : "axis 在位。",
      quotes: [],
      question: null,
    };
  }
  if (tier === "implicit") {
    return {
      head:
        diagnoserId === "stakes_absent"
          ? "承担隐含——意识在场，但没被推到台前。"
          : diagnoserId === "causal_spine"
            ? "因果是隐含的——事件并置暗示了链条。"
            : "axis 隐含。",
      quotes: [],
      question:
        diagnoserId === "stakes_absent"
          ? "考虑：是有意留白，还是该让承担落点更可见？看展开内的 evidence 字段——模型指认了它落在哪一句。"
          : diagnoserId === "causal_spine"
            ? "考虑：这是中文文学的常态写法，还是因果链断了一节？看展开内的 reorder_test——模型说哪两个事件不可换位。"
            : "考虑：是有意，还是该让 axis 更显。",
    };
  }
  if (tier === "absent") {
    return {
      head:
        diagnoserId === "stakes_absent"
          ? "纯事件流。这一段读起来像观察、不像故事。"
          : diagnoserId === "causal_spine"
            ? "事件平行——可以重排而不损意义。"
            : "axis 缺失。",
      quotes: [],
      question:
        diagnoserId === "stakes_absent"
          ? "根本问题：这件事，对谁是一件事？"
          : diagnoserId === "causal_spine"
            ? "根本问题：事件 B 之所以发生，是因为事件 A 吗？还是 A 和 B 只是同时被记录？"
            : "根本问题：这个 axis 是不是该在这里？",
    };
  }
  return {
    head: "无法判断（模型未返回或错误）。",
    quotes: [],
    question: null,
  };
}

function tierColor(tier: Tier): string {
  if (tier === "present") return "#5e8a4a";
  if (tier === "implicit") return "#a07a30";
  if (tier === "absent") return "#a04040";
  return "#888";
}

// ─── Inline styles ─────────────────────────────────────────────────────────

const btnPrimary: React.CSSProperties = {
  padding: "8px 14px",
  background: "#2a5e8a",
  color: "white",
  border: "none",
  borderRadius: 4,
  fontSize: 14,
  cursor: "pointer",
};
const btnPrimaryDisabled: React.CSSProperties = {
  ...btnPrimary,
  background: "#bcc8d3",
  cursor: "not-allowed",
};
const btnGhost: React.CSSProperties = {
  padding: "5px 10px",
  background: "transparent",
  border: "1px solid #ccc",
  borderRadius: 4,
  fontSize: 12,
  cursor: "pointer",
  color: "#555",
};
const controlLabel: React.CSSProperties = {
  fontSize: 11,
  color: "#888",
  marginBottom: 5,
  textTransform: "uppercase",
  letterSpacing: 0.4,
};
const tdSmall: React.CSSProperties = {
  padding: "5px 8px",
  verticalAlign: "top",
  fontSize: 12,
};
function chip(active: boolean): React.CSSProperties {
  return {
    padding: "4px 9px",
    border: `1px solid ${active ? "#2a5e8a" : "#d4cdb8"}`,
    background: active ? "#eef2f8" : "#fff",
    borderRadius: 14,
    fontSize: 12,
    cursor: "pointer",
    userSelect: "none",
    display: "inline-flex",
    alignItems: "center",
  };
}

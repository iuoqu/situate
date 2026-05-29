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
  skipped_diagnoser_ids?: string[];
  intent_used: string | null;
}

interface IntentFields {
  whose: string; // K
  others: string;
  changes: string; // D → S1
  setting: string;
  reader_takeaway: string;
}

const EMPTY_INTENT: IntentFields = {
  whose: "",
  others: "",
  changes: "",
  setting: "",
  reader_takeaway: "",
};

function formatIntent(f: IntentFields): string {
  const lines: string[] = [];
  if (f.whose.trim()) lines.push(`K（承担者）：${f.whose.trim()}`);
  if (f.others.trim()) lines.push(`其他人物：${f.others.trim()}`);
  if (f.changes.trim()) lines.push(`转变（D → S1）：${f.changes.trim()}`);
  if (f.setting.trim()) lines.push(`设定：${f.setting.trim()}`);
  if (f.reader_takeaway.trim())
    lines.push(`读者留下：${f.reader_takeaway.trim()}`);
  return lines.join("\n");
}

type Tier = "present" | "implicit" | "absent" | "unknown";

interface Sample {
  id: string;
  label: string;
  prose: string;
  note: string;
}

const SAMPLES: Sample[] = [
  {
    id: "monitor",
    label: "监控记录（K_absent baseline）",
    note: "纯观察纪录，预期所有 axis 缺失",
    prose: `公寓三楼门铃响了。门内有人在做饭。门外站着一个约六十岁的男性，两手空着。
开门的人开了门。两人在门两侧站着，约十秒。屋内传出水开的声音。
门外的人开口说话。门内的人点了一下头。`,
  },
  {
    id: "mother_daughter",
    label: "母女抽屉（K_present，富因果）",
    note: "已知 PDR 高分样本",
    prose: `床头柜的抽屉
医院的姑息病房在第六层最末端。我每天下班过来坐两小时，母亲多数时候是睡着的。护士说她剩下的时间用周来算，不要超过三周。

今天她让我把床头柜最下面那个抽屉打开。她说话已经很费力，每次只能吐三四个字：抽屉、最下、给你。

我拉开抽屉，里面是一叠纸——很厚，用粉色发圈扎着。我以为是病历或保单。解开发圈，最上面那张是我七岁画的——大山、小房子、太阳那种笔触歪扭的画，每个孩子都画的那种。背面我用稚嫩的字写了"妈妈"两个字。

下一张是我九岁的春游画。再下一张是中学时一张草稿——我那时候迷漫画，画了一个不会画的人物。我以为她当时早扔了。

整叠下面，是我大学时第一次离家前给她写的一张便条："冰箱里有汤，记得热。我下周末回来。"——我记得放在桌上就走了，没想到她留下来了。

我数了数，从我七岁到二十四岁，一年都没缺。她一直在保留。

我抬头看她。她已经又闭上眼睛，呼吸器的声音很轻。她大概以为她要说的话——这些东西在这里——已经传达了。

她不知道，我从十六岁开始，没好好看过她一眼。我嫌她唠叨。后来我成年了，每次回家半天，半天里有四十分钟在手机上。她从不抱怨。

我把那叠纸重新用发圈扎好，放回原处。我没把抽屉关上——我想她下次醒来再看一眼，知道我没把它带走。她会以为我不要。其实我是想再回来一次。

我坐在床边，到了下班该走的时间，没走。`,
  },
  {
    id: "dog_overprotest",
    label: "狗（subtext via 重复 — 关键测试）",
    note: "测试模型是否被多数信号洗掉单一断裂",
    prose: `我早上爱我的狗。我中午爱我的狗。虽然下午打了一下我的狗。晚上爱我的狗。`,
  },
  {
    id: "blank",
    label: "（空白 — 自己粘）",
    note: "",
    prose: "",
  },
];

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
  const [text, setText] = useState(SAMPLES[0].prose);
  const [intent, setIntent] = useState<IntentFields>(EMPTY_INTENT);
  const [intentExpanded, setIntentExpanded] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<PreviewResponse | null>(null);

  const intentBlock = useMemo(() => formatIntent(intent), [intent]);
  const hasIntent = intentBlock.length > 0;

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
          ...(hasIntent ? { intent: intentBlock } : {}),
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

      <IntentCard
        intent={intent}
        setIntent={setIntent}
        expanded={intentExpanded}
        setExpanded={setIntentExpanded}
        intentBlock={intentBlock}
        hasIntent={hasIntent}
      />

      <section>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: "#888", letterSpacing: 0.4, textTransform: "uppercase", alignSelf: "center", marginRight: 4 }}>
            samples
          </span>
          {SAMPLES.map((s) => (
            <button
              key={s.id}
              onClick={() => setText(s.prose)}
              style={chip(text === s.prose)}
              title={s.note}
            >
              {s.label}
            </button>
          ))}
        </div>
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
              : `diagnose ${hasIntent ? "(with intent) " : ""}(${selectedDiagnosers.length} × ${selectedProviders.length} = ${selectedDiagnosers.length * selectedProviders.length} calls)`}
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

// ─── Intent card ───────────────────────────────────────────────────────────

function IntentCard({
  intent,
  setIntent,
  expanded,
  setExpanded,
  intentBlock,
  hasIntent,
}: {
  intent: IntentFields;
  setIntent: (f: IntentFields) => void;
  expanded: boolean;
  setExpanded: (e: boolean) => void;
  intentBlock: string;
  hasIntent: boolean;
}) {
  const fields: {
    key: keyof IntentFields;
    label: string;
    placeholder: string;
  }[] = [
    { key: "whose", label: "K — 承担者", placeholder: "女儿" },
    { key: "others", label: "其他人物", placeholder: "母亲；护士（背景）" },
    {
      key: "changes",
      label: "转变 (D → S1)",
      placeholder: "女儿翻完抽屉后没走",
    },
    {
      key: "setting",
      label: "设定（地点 + 时刻）",
      placeholder: "上海某姑息病房，下班后 30 分钟",
    },
    {
      key: "reader_takeaway",
      label: "读者留下（可选）",
      placeholder: "对长期忽视母亲的悔意，但说不出口",
    },
  ];

  return (
    <section
      style={{
        border: "1px solid #e0dccb",
        borderRadius: 4,
        background: hasIntent ? "#f7f3e8" : "#fdfcf8",
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%",
          padding: "10px 14px",
          background: "transparent",
          border: "none",
          textAlign: "left",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 13,
          color: "#444",
        }}
      >
        <span style={{ fontSize: 12, color: "#888" }}>
          {expanded ? "▾" : "▸"}
        </span>
        <strong>Author intent</strong>
        <span style={{ color: "#888", fontSize: 12 }}>
          (optional — declare what you're attempting; coach compares prose
          against it)
        </span>
        {hasIntent && (
          <span
            style={{
              marginLeft: "auto",
              fontSize: 11,
              color: "#5e8a4a",
              fontWeight: 600,
            }}
          >
            ✓ will be sent
          </span>
        )}
      </button>
      {expanded && (
        <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
          {fields.map((f) => (
            <div key={f.key} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <label style={{ fontSize: 11, color: "#888", letterSpacing: 0.3 }}>
                {f.label}
              </label>
              <input
                type="text"
                value={intent[f.key]}
                onChange={(e) => setIntent({ ...intent, [f.key]: e.target.value })}
                placeholder={f.placeholder}
                style={{
                  padding: "6px 10px",
                  border: "1px solid #d4cdb8",
                  borderRadius: 3,
                  fontSize: 14,
                  fontFamily: 'Georgia, "Times New Roman", serif',
                  background: "white",
                }}
              />
            </div>
          ))}
          {hasIntent && (
            <details style={{ marginTop: 4 }}>
              <summary
                style={{ fontSize: 11, color: "#888", cursor: "pointer" }}
              >
                preview what gets sent to the diagnoser
              </summary>
              <pre
                style={{
                  margin: "6px 0 0",
                  padding: 10,
                  background: "#fff",
                  border: "1px solid #e0dccb",
                  borderRadius: 3,
                  fontSize: 12,
                  whiteSpace: "pre-wrap",
                  color: "#555",
                  fontFamily: 'ui-monospace, "SF Mono", monospace',
                }}
              >
                {`<intent>\n${intentBlock}\n</intent>\n\n<prose>\n... your text ...\n</prose>`}
              </pre>
            </details>
          )}
        </div>
      )}
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
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
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
        {response.intent_used && (
          <span style={{ fontSize: 12, color: "#5e8a4a" }}>
            (intent_realization diagnoser included)
          </span>
        )}
        {response.skipped_diagnoser_ids && response.skipped_diagnoser_ids.length > 0 && (
          <span style={{ fontSize: 12, color: "#a07a30" }}>
            (skipped {response.skipped_diagnoser_ids.join(", ")} — no intent
            supplied)
          </span>
        )}
      </div>
      {orderedDiagnoserIds.map((id) => {
        const result = response.results[id];
        if (!result) return null;
        if (id === "inferred_intent") {
          return (
            <InferredIntentCard
              key={id}
              result={result}
              providers={providers}
              providersRun={response.providers_run}
            />
          );
        }
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

// ─── Inferred intent card (no tier — structured field dump) ───────────────

function InferredIntentCard({
  result,
  providers,
  providersRun,
}: {
  result: DiagnoserResult;
  providers: ProviderInfo[];
  providersRun: string[];
}) {
  return (
    <div
      style={{
        border: "1px solid #e0dccb",
        borderLeft: `4px solid #5b6f8a`,
        borderRadius: 4,
        padding: "14px 16px",
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 400 }}>
          inferred_intent
        </h3>
        <span style={{ fontSize: 12, color: "#888" }}>
          AI 独立从 prose 推断（不知道作者声明的意图）
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 10 }}>
        {providersRun.map((pid) => {
          const cell = result.by_provider[pid];
          const provName = providers.find((p) => p.id === pid)?.displayName ?? pid;
          if (!cell || cell.error) {
            return (
              <div key={pid} style={inferredProviderBlock}>
                <div style={inferredProviderHeader}>{provName}</div>
                <div style={{ color: "#a04040", fontSize: 12 }}>
                  {cell?.error ?? "no response"}
                </div>
              </div>
            );
          }
          const j = (cell.judgment ?? {}) as Record<string, unknown>;
          const confidence = typeof j.confidence === "number" ? j.confidence.toFixed(2) : "?";
          const fields: { key: string; label: string; highlight?: boolean }[] = [
            { key: "k_inferred", label: "K" },
            { key: "others_inferred", label: "其他人物" },
            { key: "changes_inferred", label: "转变" },
            { key: "setting_inferred", label: "设定" },
            { key: "takeaway_inferred", label: "读者留下" },
            { key: "center_of_gravity", label: "重心", highlight: true },
            { key: "subtext_signal", label: "subtext", highlight: true },
          ];
          return (
            <div key={pid} style={inferredProviderBlock}>
              <div style={inferredProviderHeader}>
                {provName}
                <span style={{ color: "#888", fontSize: 11, fontWeight: 400, marginLeft: 8 }}>
                  conf {confidence}
                </span>
              </div>
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
                <tbody>
                  {fields.map((f) => {
                    const v = String(j[f.key] ?? "");
                    if (!v) return null;
                    return (
                      <tr key={f.key}>
                        <td style={{
                          padding: "2px 8px 2px 0",
                          color: "#888",
                          width: 90,
                          verticalAlign: "top",
                          fontSize: 11,
                          letterSpacing: 0.3,
                        }}>
                          {f.label}
                        </td>
                        <td style={{
                          padding: "2px 0",
                          color: f.highlight ? "#5b6f8a" : "#333",
                          fontWeight: f.highlight ? 600 : 400,
                          lineHeight: 1.55,
                        }}>
                          {v}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const inferredProviderBlock: React.CSSProperties = {
  borderTop: "1px solid #f0ece0",
  paddingTop: 10,
};
const inferredProviderHeader: React.CSSProperties = {
  fontSize: 12,
  color: "#5b6f8a",
  fontWeight: 600,
  marginBottom: 4,
  letterSpacing: 0.3,
};

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
          const realized = typeof j.realized === "string" ? j.realized : "";
          const unrealized =
            typeof j.unrealized === "string" ? j.unrealized : "";
          const baseEvidence = String(
            j.evidence ?? j.reorder_test ?? j.who ?? "",
          );
          return (
            <tr key={pid} style={{ borderTop: "1px solid #eee" }}>
              <td style={tdSmall}>{provName}</td>
              <td style={tdSmall}>{verdict}</td>
              <td style={tdSmall}>{confidence}</td>
              <td style={{ ...tdSmall, color: "#555", lineHeight: 1.5 }}>
                {realized && (
                  <div>
                    <span style={{ color: "#5e8a4a", fontWeight: 600 }}>
                      realized:
                    </span>{" "}
                    {realized}
                  </div>
                )}
                {unrealized && (
                  <div>
                    <span style={{ color: "#a04040", fontWeight: 600 }}>
                      unrealized:
                    </span>{" "}
                    {unrealized}
                  </div>
                )}
                {baseEvidence && <div>{baseEvidence}</div>}
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
 * intent_realization: intent_implemented / intent_partial / intent_unimplemented
 * Tier semantics map: "all good" / "in between" / "missing".
 */
function extractTier(cell: CellResult | undefined): Tier {
  if (!cell || cell.error) return "unknown";
  const j = (cell.judgment ?? {}) as Record<string, unknown>;
  const verdict = String(j.verdict ?? "");
  if (verdict.endsWith("_present") || verdict.endsWith("_implemented"))
    return "present";
  if (verdict.endsWith("_implicit") || verdict.endsWith("_partial"))
    return "implicit";
  if (verdict.endsWith("_absent") || verdict.endsWith("_unimplemented"))
    return "absent";
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
            : diagnoserId === "intent_realization"
              ? "你声明要做的，prose 里都做到了。"
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
            : diagnoserId === "intent_realization"
              ? "声明与实现部分对齐——一些元素落地了，另一些被改写或缺失。"
              : "axis 隐含。",
      quotes: [],
      question:
        diagnoserId === "stakes_absent"
          ? "考虑：是有意留白，还是该让承担落点更可见？看展开内的 evidence 字段——模型指认了它落在哪一句。"
          : diagnoserId === "causal_spine"
            ? "考虑：这是中文文学的常态写法，还是因果链断了一节？看展开内的 reorder_test——模型说哪两个事件不可换位。"
            : diagnoserId === "intent_realization"
              ? "考虑：被改写的部分是更好的版本，还是想拉回声明？看展开内的 realized 和 unrealized 字段——模型分别指出了什么落地、什么没落地。"
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
            : diagnoserId === "intent_realization"
              ? "声明的意图和 prose 写的几乎是两个故事。"
              : "axis 缺失。",
      quotes: [],
      question:
        diagnoserId === "stakes_absent"
          ? "根本问题：这件事，对谁是一件事？"
          : diagnoserId === "causal_spine"
            ? "根本问题：事件 B 之所以发生，是因为事件 A 吗？还是 A 和 B 只是同时被记录？"
            : diagnoserId === "intent_realization"
              ? "根本问题：保留 prose 当下的方向，还是回到声明的意图？两者都合法，但要选。"
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

"use client";

import { useEffect, useMemo, useState } from "react";

import { saveDevToken } from "../../dev/eval/actions";

/**
 * GuidedWriteClient — 5-stage conversational write surface.
 *
 * Reuses /api/dev/coach-preview for the bank call (staff-only via dev
 * token cookie). The translation layer (`translateBankToLay`) turns
 * bank's technical output into friend-asking observations and
 * questions — no K_present / causal_implicit jargon hits the user.
 *
 * State is held in component memory + localStorage backup, no DB
 * persistence yet.
 */

type Mode = "memoir" | "fiction" | "blend";
type Stage = "mode" | "anchor" | "drill" | "freedump" | "running" | "mirror";

interface Drill {
  who: string;
  when: string;
  where: string;
  changes: string;
  why_remember: string;
}

const EMPTY_DRILL: Drill = {
  who: "",
  when: "",
  where: "",
  changes: "",
  why_remember: "",
};

const LOCAL_KEY = "write-guided-state-v1";

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

interface ProviderInfo {
  id: string;
  displayName: string;
  costNote: string;
  available: boolean;
}

interface InterviewQuestion {
  category: string;
  question: string;
  why_matters: string;
}

interface Workshop {
  focal: string;
  rationale: string;
  questions: InterviewQuestion[];
  answers: string[]; // parallel array to questions
}

interface PersistedState {
  mode: Mode | null;
  anchor: string;
  drill: Drill;
  prose: string;
  characterWorkshop: Workshop | null;
  placeWorkshop: Workshop | null;
}

export function GuidedWriteClient() {
  const [stage, setStage] = useState<Stage>("mode");
  const [mode, setMode] = useState<Mode | null>(null);
  const [anchor, setAnchor] = useState("");
  const [drill, setDrill] = useState<Drill>(EMPTY_DRILL);
  const [prose, setProse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [bankResponse, setBankResponse] = useState<PreviewResponse | null>(null);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [tokenSet, setTokenSet] = useState(true);
  const [tokenInput, setTokenInput] = useState("");
  const [characterWorkshop, setCharacterWorkshop] = useState<Workshop | null>(
    null,
  );
  const [placeWorkshop, setPlaceWorkshop] = useState<Workshop | null>(null);
  const [characterLoading, setCharacterLoading] = useState(false);
  const [placeLoading, setPlaceLoading] = useState(false);

  // Restore from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(LOCAL_KEY);
      if (raw) {
        const s = JSON.parse(raw) as PersistedState;
        if (s.mode) setMode(s.mode);
        if (s.anchor) setAnchor(s.anchor);
        if (s.drill) setDrill(s.drill);
        if (s.prose) setProse(s.prose);
        if (s.characterWorkshop) setCharacterWorkshop(s.characterWorkshop);
        if (s.placeWorkshop) setPlaceWorkshop(s.placeWorkshop);
        // Resume to the furthest stage that has content
        if (s.prose) setStage("freedump");
        else if (s.drill && Object.values(s.drill).some((v) => v))
          setStage("drill");
        else if (s.anchor) setStage("anchor");
        else if (s.mode) setStage("anchor");
      }
    } catch {
      // ignore
    }
  }, []);

  // Persist on change
  useEffect(() => {
    if (typeof window === "undefined") return;
    const s: PersistedState = {
      mode,
      anchor,
      drill,
      prose,
      characterWorkshop,
      placeWorkshop,
    };
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(s));
  }, [mode, anchor, drill, prose, characterWorkshop, placeWorkshop]);

  // Fetch providers on mount (need token)
  useEffect(() => {
    fetch("/api/dev/providers", { credentials: "same-origin" })
      .then((r) => {
        if (r.status === 401) {
          setTokenSet(false);
          return null;
        }
        if (!r.ok) throw new Error(`providers HTTP ${r.status}`);
        return r.json();
      })
      .then((data: { providers: ProviderInfo[] } | null) => {
        if (data) setProviders(data.providers);
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

  function formatIntent(): string {
    const lines: string[] = [];
    if (drill.who.trim()) lines.push(`K（承担者）：${drill.who.trim()}`);
    if (drill.when.trim() || drill.where.trim()) {
      lines.push(
        `设定：${[drill.when, drill.where].filter((s) => s.trim()).join("，")}`,
      );
    }
    if (drill.changes.trim()) lines.push(`转变：${drill.changes.trim()}`);
    if (drill.why_remember.trim())
      lines.push(`读者留下：${drill.why_remember.trim()}`);

    // Append character backstory if author did the workshop
    if (characterWorkshop) {
      const answered = characterWorkshop.questions
        .map((q, i) => ({ q, a: characterWorkshop.answers[i] }))
        .filter((p) => p.a?.trim());
      if (answered.length > 0) {
        lines.push("");
        lines.push(`【作者的人物 backstory · ${characterWorkshop.focal}】`);
        for (const p of answered) {
          lines.push(`  - [${p.q.category}] ${p.q.question} → ${p.a.trim()}`);
        }
      }
    }
    if (placeWorkshop) {
      const answered = placeWorkshop.questions
        .map((q, i) => ({ q, a: placeWorkshop.answers[i] }))
        .filter((p) => p.a?.trim());
      if (answered.length > 0) {
        lines.push("");
        lines.push(`【作者的地点 backstory · ${placeWorkshop.focal}】`);
        for (const p of answered) {
          lines.push(`  - [${p.q.category}] ${p.q.question} → ${p.a.trim()}`);
        }
      }
    }
    return lines.join("\n");
  }

  async function runWorkshop(
    kind: "character" | "place",
  ): Promise<void> {
    const text = composeText() || anchor;
    if (!text.trim()) {
      setError("写点内容（哪怕只是 anchor）AI 才能识别角色 / 地点");
      return;
    }
    setError(null);
    if (kind === "character") setCharacterLoading(true);
    else setPlaceLoading(true);

    try {
      const resp = await fetch("/api/dev/coach-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          providers: ["anthropic:claude-sonnet-4-6"], // overridden by provider_fanout: false
          diagnoser_ids: [
            kind === "character" ? "character_interview" : "place_interview",
          ],
        }),
        credentials: "same-origin",
      });
      if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${body.slice(0, 200)}`);
      }
      const data = (await resp.json()) as PreviewResponse;
      const diagId =
        kind === "character" ? "character_interview" : "place_interview";
      const result = data.results[diagId];
      const cell = result ? Object.values(result.by_provider)[0] : undefined;
      if (!cell || cell.error) {
        throw new Error(cell?.error ?? "no questions returned");
      }
      const j = cell.judgment as {
        focal_character?: string;
        focal_place?: string;
        rationale?: string;
        questions?: InterviewQuestion[];
      };
      const focal =
        kind === "character" ? j.focal_character ?? "" : j.focal_place ?? "";
      const workshop: Workshop = {
        focal,
        rationale: j.rationale ?? "",
        questions: j.questions ?? [],
        answers: new Array(j.questions?.length ?? 0).fill(""),
      };
      if (kind === "character") setCharacterWorkshop(workshop);
      else setPlaceWorkshop(workshop);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (kind === "character") setCharacterLoading(false);
      else setPlaceLoading(false);
    }
  }

  function composeText(): string {
    const parts: string[] = [];
    if (anchor.trim()) parts.push(anchor.trim());
    if (prose.trim()) parts.push(prose.trim());
    return parts.join("\n\n");
  }

  async function runBank() {
    if (!composeText().trim()) {
      setError("先写点内容再让 AI 读");
      return;
    }
    setError(null);
    setBankResponse(null);
    setStage("running");

    const intent = formatIntent();
    const availableProviderIds = providers
      .filter((p) => p.available)
      .map((p) => p.id);
    const targetProviders = availableProviderIds.filter((id) =>
      [
        "anthropic:claude-sonnet-4-6",
        "anthropic:claude-opus-4-7",
        "deepseek:deepseek-chat",
        "alibaba:qwen3-max",
      ].includes(id),
    );
    const fallbackProviders =
      targetProviders.length > 0 ? targetProviders : availableProviderIds.slice(0, 4);

    try {
      const resp = await fetch("/api/dev/coach-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: composeText(),
          providers: fallbackProviders,
          diagnoser_ids: [
            "stakes_absent",
            "causal_spine",
            "economy",
            "inferred_intent",
            "center_consensus",
            ...(intent ? ["intent_realization"] : []),
          ],
          ...(intent ? { intent } : {}),
        }),
        credentials: "same-origin",
      });
      if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${body.slice(0, 200)}`);
      }
      const data = (await resp.json()) as PreviewResponse;
      setBankResponse(data);
      setStage("mirror");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStage("freedump");
    }
  }

  function restart() {
    if (
      typeof window !== "undefined" &&
      !window.confirm("确定全部清空重来？当前内容会丢失。")
    )
      return;
    setMode(null);
    setAnchor("");
    setDrill(EMPTY_DRILL);
    setProse("");
    setBankResponse(null);
    setCharacterWorkshop(null);
    setPlaceWorkshop(null);
    setStage("mode");
    setError(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(LOCAL_KEY);
    }
  }

  if (!tokenSet) {
    return (
      <main style={mainStyle}>
        <h1 style={h1Style}>Guided write (staff)</h1>
        <p style={leadStyle}>
          需要 dev token cookie（同 /dev/eval / /dev/coach-preview）。粘进来一次即可。
        </p>
        <form onSubmit={handleSaveToken} style={{ display: "flex", gap: 8 }}>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="DIAGNOSTIC_INTERNAL_TOKEN"
            style={tokenInputStyle}
          />
          <button type="submit" style={btnPrimary}>
            Save
          </button>
        </form>
      </main>
    );
  }

  return (
    <main style={mainStyle}>
      <header style={{ marginBottom: 24 }}>
        <p style={kickerStyle}>STAFF · GUIDED PROTOTYPE</p>
        <h1 style={h1Style}>引导写作</h1>
        <p style={leadStyle}>
          5 步对话——你不需要知道 K、center、subtext 这些词。AI 在后台读你的文字，用日常话告诉你它读到什么。
        </p>
        <Progress current={stage} />
      </header>

      {stage === "mode" && (
        <ModeStage
          onSelect={(m) => {
            setMode(m);
            setStage("anchor");
          }}
        />
      )}

      {stage === "anchor" && (
        <AnchorStage
          value={anchor}
          onChange={setAnchor}
          onContinue={() => setStage("drill")}
          onBack={() => setStage("mode")}
        />
      )}

      {stage === "drill" && (
        <DrillStage
          drill={drill}
          setDrill={setDrill}
          mode={mode ?? "blend"}
          onContinue={() => setStage("freedump")}
          onBack={() => setStage("anchor")}
        />
      )}

      {stage === "freedump" && (
        <FreedumpStage
          mode={mode ?? "blend"}
          anchor={anchor}
          drill={drill}
          prose={prose}
          setProse={setProse}
          onContinue={runBank}
          onBack={() => setStage("drill")}
          characterWorkshop={characterWorkshop}
          placeWorkshop={placeWorkshop}
          characterLoading={characterLoading}
          placeLoading={placeLoading}
          onRunCharacterWorkshop={() => runWorkshop("character")}
          onRunPlaceWorkshop={() => runWorkshop("place")}
          onUpdateCharacterAnswer={(idx, v) => {
            if (!characterWorkshop) return;
            const next = { ...characterWorkshop };
            next.answers = [...next.answers];
            next.answers[idx] = v;
            setCharacterWorkshop(next);
          }}
          onUpdatePlaceAnswer={(idx, v) => {
            if (!placeWorkshop) return;
            const next = { ...placeWorkshop };
            next.answers = [...next.answers];
            next.answers[idx] = v;
            setPlaceWorkshop(next);
          }}
        />
      )}

      {stage === "running" && (
        <div style={runningStyle}>
          <p style={{ fontSize: 16, color: "#5b6f8a" }}>
            AI 正在读你的文字……
          </p>
          <p style={{ fontSize: 12, color: "#888", marginTop: 8 }}>
            大约 30-90 秒。它在用 4 个不同视角的"读者"独立看你写的东西。
          </p>
        </div>
      )}

      {stage === "mirror" && bankResponse && (
        <MirrorStage
          response={bankResponse}
          onAddMore={() => setStage("freedump")}
          onRestart={restart}
        />
      )}

      {error && (
        <div style={errorBox}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <footer style={footerStyle}>
        <button onClick={restart} style={btnGhost}>
          全部清空重来
        </button>
      </footer>
    </main>
  );
}

// ─── Stage components ──────────────────────────────────────────────────────

function ModeStage({ onSelect }: { onSelect: (m: Mode) => void }) {
  const opts: { id: Mode; title: string; subtitle: string }[] = [
    {
      id: "memoir",
      title: "一件自己经历过的事",
      subtitle:
        "已经发生过，你记得。可能是几年前一个画面、一个对话、一次告别。",
    },
    {
      id: "fiction",
      title: "一件想象 / 编的事",
      subtitle:
        "脑子里有一个画面或人物，但不是真实发生的。可以借真实的感觉但情节是编的。",
    },
    {
      id: "blend",
      title: "介于两者之间",
      subtitle:
        "很多写作都是这样——一部分是真的，一部分是改过/想象的。大多数文学短篇属于这一类。",
    },
  ];
  return (
    <section>
      <h2 style={h2Style}>你想写哪种？</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {opts.map((o) => (
          <button
            key={o.id}
            onClick={() => onSelect(o.id)}
            style={modeButtonStyle}
          >
            <div style={{ fontSize: 17, fontWeight: 500, color: "#1a1a1a" }}>
              {o.title}
            </div>
            <div style={{ fontSize: 13, color: "#666", marginTop: 4, lineHeight: 1.55 }}>
              {o.subtitle}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function AnchorStage({
  value,
  onChange,
  onContinue,
  onBack,
}: {
  value: string;
  onChange: (s: string) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  return (
    <section>
      <h2 style={h2Style}>第一步：抓住"不肯走开的事"</h2>
      <p style={pStyle}>
        想一件**不肯走开**的事。一个人说的一句话，一个画面，一个动作。
        <br />
        一两行就行。<strong>越具体越好</strong>——是哪句话、什么画面、什么动作。
      </p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder="比如：「奶奶让我打开她床头柜最下面的抽屉」&#10;或：「老李头每个周末去公园下棋，永远赢不了」"
        style={textareaStyle}
      />
      <div style={navRow}>
        <button onClick={onBack} style={btnGhost}>
          ← 返回
        </button>
        <button
          onClick={onContinue}
          disabled={!value.trim()}
          style={value.trim() ? btnPrimary : btnPrimaryDisabled}
        >
          继续 →
        </button>
      </div>
    </section>
  );
}

function DrillStage({
  drill,
  setDrill,
  mode,
  onContinue,
  onBack,
}: {
  drill: Drill;
  setDrill: (d: Drill) => void;
  mode: Mode;
  onContinue: () => void;
  onBack: () => void;
}) {
  const labels =
    mode === "fiction"
      ? {
          who: "那个人是谁？叫什么？（可以编）",
          when: "那是什么时候？",
          where: "那地方在哪里？",
          changes: "什么变了？（一两行）",
          why_remember: "什么让你想到这个？",
        }
      : {
          who: "那个人是谁？叫什么？",
          when: "那是什么时候？哪一年？什么季节？",
          where: "那地方在哪里？",
          changes: "什么变了？（一两行）",
          why_remember: "你为什么到现在还记得？",
        };

  const fields: { key: keyof Drill; label: string }[] = [
    { key: "who", label: labels.who },
    { key: "when", label: labels.when },
    { key: "where", label: labels.where },
    { key: "changes", label: labels.changes },
    { key: "why_remember", label: labels.why_remember },
  ];

  return (
    <section>
      <h2 style={h2Style}>第二步：几个具体问题</h2>
      <p style={pStyle}>
        都是单行，都可以跳过。<strong>不知道就空着</strong>——后面 AI
        发现重要的会再问你。
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {fields.map((f) => (
          <div key={f.key}>
            <label style={fieldLabelStyle}>{f.label}</label>
            <input
              type="text"
              value={drill[f.key]}
              onChange={(e) => setDrill({ ...drill, [f.key]: e.target.value })}
              style={inputStyle}
            />
          </div>
        ))}
      </div>
      <div style={navRow}>
        <button onClick={onBack} style={btnGhost}>
          ← 返回
        </button>
        <button onClick={onContinue} style={btnPrimary}>
          继续 →
        </button>
      </div>
    </section>
  );
}

function FreedumpStage({
  mode,
  anchor,
  drill,
  prose,
  setProse,
  onContinue,
  onBack,
  characterWorkshop,
  placeWorkshop,
  characterLoading,
  placeLoading,
  onRunCharacterWorkshop,
  onRunPlaceWorkshop,
  onUpdateCharacterAnswer,
  onUpdatePlaceAnswer,
}: {
  mode: Mode;
  anchor: string;
  drill: Drill;
  prose: string;
  setProse: (s: string) => void;
  onContinue: () => void;
  onBack: () => void;
  characterWorkshop: Workshop | null;
  placeWorkshop: Workshop | null;
  characterLoading: boolean;
  placeLoading: boolean;
  onRunCharacterWorkshop: () => void;
  onRunPlaceWorkshop: () => void;
  onUpdateCharacterAnswer: (idx: number, value: string) => void;
  onUpdatePlaceAnswer: (idx: number, value: string) => void;
}) {
  return (
    <section>
      <h2 style={h2Style}>第三步：随便说</h2>

      <ContextSummary anchor={anchor} drill={drill} />

      <p style={pStyle}>
        想到什么说什么。这个人的其他事、那天前后发生的、你后来怎么了——
        <br />
        <strong>多少都行，乱也无所谓</strong>。不必有顺序、不必"开头—中间—结尾"。
        {mode === "fiction" && "（编的也行，混着真实细节也行）"}
      </p>
      <textarea
        value={prose}
        onChange={(e) => setProse(e.target.value)}
        rows={14}
        placeholder="想到什么写什么……"
        style={{ ...textareaStyle, fontFamily: "Georgia, serif", fontSize: 15 }}
      />
      <p style={{ fontSize: 12, color: "#888", marginTop: 6 }}>
        当前 ~{countWords(prose)} 字。一般 300-800 字 AI 就能给出有用反馈。
      </p>

      <div
        style={{
          marginTop: 18,
          padding: 14,
          background: "#fbf8f1",
          border: "1px dashed #d4b66a",
          borderRadius: 5,
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            color: "#8a6d20",
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          可选 · 深入了解你的角色 / 地点
        </div>
        <p style={{ fontSize: 13, color: "#5a4810", lineHeight: 1.6, margin: "0 0 10px" }}>
          AI 会问你 8 个具体问题——关于这个角色 / 地点的过去、细节、习惯。
          答了能帮你 prose 写得更具体（不必每个都答，多少都行）。
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {!characterWorkshop ? (
            <button
              onClick={onRunCharacterWorkshop}
              disabled={characterLoading}
              style={characterLoading ? btnPrimaryDisabled : btnSecondary}
            >
              {characterLoading
                ? "AI 在生成问题……"
                : "📋 想想你的角色 →"}
            </button>
          ) : null}
          {!placeWorkshop ? (
            <button
              onClick={onRunPlaceWorkshop}
              disabled={placeLoading}
              style={placeLoading ? btnPrimaryDisabled : btnSecondary}
            >
              {placeLoading ? "AI 在生成问题……" : "🗺️ 想想你的地点 →"}
            </button>
          ) : null}
        </div>
      </div>

      {characterWorkshop && (
        <WorkshopPanel
          workshop={characterWorkshop}
          kind="character"
          onUpdateAnswer={onUpdateCharacterAnswer}
        />
      )}

      {placeWorkshop && (
        <WorkshopPanel
          workshop={placeWorkshop}
          kind="place"
          onUpdateAnswer={onUpdatePlaceAnswer}
        />
      )}

      <div style={navRow}>
        <button onClick={onBack} style={btnGhost}>
          ← 返回
        </button>
        <button
          onClick={onContinue}
          disabled={!prose.trim()}
          style={prose.trim() ? btnPrimary : btnPrimaryDisabled}
        >
          让 AI 读这一段 →
        </button>
      </div>
    </section>
  );
}

function WorkshopPanel({
  workshop,
  kind,
  onUpdateAnswer,
}: {
  workshop: Workshop;
  kind: "character" | "place";
  onUpdateAnswer: (idx: number, value: string) => void;
}) {
  const title = kind === "character" ? "📋 角色 workshop" : "🗺️ 地点 workshop";
  const accent = kind === "character" ? "#8a6d20" : "#3a6d8a";
  const bg = kind === "character" ? "#fef9e8" : "#eef4f7";
  return (
    <div
      style={{
        marginTop: 14,
        padding: 14,
        background: bg,
        border: `1px solid ${accent}40`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: 4,
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: accent, fontWeight: 600, letterSpacing: 0.3 }}>
          {title}
        </div>
        <div
          style={{
            fontSize: 15,
            color: "#1a1a1a",
            fontFamily: 'Georgia, "Times New Roman", serif',
            margin: "4px 0 6px",
            fontWeight: 500,
          }}
        >
          {workshop.focal}
        </div>
        {workshop.rationale && (
          <div style={{ fontSize: 12, color: "#666", lineHeight: 1.55, fontStyle: "italic" }}>
            {workshop.rationale}
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {workshop.questions.map((q, i) => (
          <div
            key={i}
            style={{
              padding: "8px 10px",
              background: "white",
              border: "1px solid #e0dccb",
              borderRadius: 3,
            }}
          >
            <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 4 }}>
              <span
                style={{
                  fontSize: 10,
                  color: accent,
                  fontWeight: 600,
                  letterSpacing: 0.3,
                  textTransform: "uppercase",
                }}
              >
                {q.category}
              </span>
              <span style={{ fontSize: 13, color: "#1a1a1a", fontWeight: 500, lineHeight: 1.5 }}>
                {q.question}
              </span>
            </div>
            <div style={{ fontSize: 11, color: "#999", lineHeight: 1.5, marginBottom: 5 }}>
              {q.why_matters}
            </div>
            <textarea
              value={workshop.answers[i] ?? ""}
              onChange={(e) => onUpdateAnswer(i, e.target.value)}
              rows={2}
              placeholder="（可以跳过）"
              style={{
                width: "100%",
                padding: 8,
                fontSize: 13,
                border: "1px solid #d4cdb8",
                borderRadius: 3,
                fontFamily: "Georgia, serif",
                lineHeight: 1.6,
                resize: "vertical",
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function ContextSummary({ anchor, drill }: { anchor: string; drill: Drill }) {
  const drillItems = [
    { label: "谁", v: drill.who },
    { label: "时间", v: drill.when },
    { label: "地点", v: drill.where },
    { label: "变化", v: drill.changes },
    { label: "为什么记得", v: drill.why_remember },
  ].filter((d) => d.v.trim());
  if (!anchor && drillItems.length === 0) return null;
  return (
    <div
      style={{
        background: "#faf8f3",
        border: "1px solid #e7e1d3",
        borderRadius: 4,
        padding: "10px 14px",
        marginBottom: 14,
        fontSize: 13,
        lineHeight: 1.6,
      }}
    >
      <div style={{ color: "#888", fontSize: 11, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 4 }}>
        你前面说的
      </div>
      {anchor && (
        <div style={{ color: "#444", marginBottom: 6, fontStyle: "italic" }}>
          「{anchor.trim()}」
        </div>
      )}
      {drillItems.length > 0 && (
        <div style={{ color: "#666", fontSize: 12 }}>
          {drillItems.map((d) => `${d.label}: ${d.v}`).join("  ·  ")}
        </div>
      )}
    </div>
  );
}

function MirrorStage({
  response,
  onAddMore,
  onRestart,
}: {
  response: PreviewResponse;
  onAddMore: () => void;
  onRestart: () => void;
}) {
  const observations = useMemo(() => translateBankToLay(response), [response]);
  const [showRaw, setShowRaw] = useState(false);
  return (
    <section>
      <h2 style={h2Style}>第四步：AI 读了，告诉你它读到什么</h2>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          marginTop: 10,
        }}
      >
        {observations.map((o, i) => (
          <ObservationBox key={i} observation={o} />
        ))}
      </div>

      <div
        style={{
          marginTop: 24,
          padding: 14,
          background: "#faf8f3",
          border: "1px solid #e7e1d3",
          borderRadius: 4,
        }}
      >
        <h3 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 500 }}>
          下一步？
        </h3>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={onAddMore} style={btnPrimary}>
            回去再加 / 改一些 →
          </button>
          <button onClick={onRestart} style={btnGhost}>
            从头开始
          </button>
          <button onClick={() => setShowRaw(!showRaw)} style={btnGhost}>
            {showRaw ? "隐藏" : "显示"} AI 原始输出（debug）
          </button>
        </div>
      </div>

      {showRaw && (
        <details open style={{ marginTop: 16 }}>
          <summary style={{ fontSize: 12, color: "#888", cursor: "pointer" }}>
            raw bank response (staff debug)
          </summary>
          <pre
            style={{
              marginTop: 8,
              padding: 12,
              background: "#1a1a1a",
              color: "#a8e6cf",
              fontSize: 11,
              lineHeight: 1.5,
              overflowX: "auto",
              borderRadius: 4,
            }}
          >
            {JSON.stringify(response, null, 2)}
          </pre>
        </details>
      )}
    </section>
  );
}

// ─── Lay translation ───────────────────────────────────────────────────────

interface Observation {
  /** ✓ working / ? missing / ! consider / @ projection note */
  kind: "working" | "missing" | "consider" | "projection";
  text: string;
}

function translateBankToLay(response: PreviewResponse): Observation[] {
  const out: Observation[] = [];

  const intent = response.results.inferred_intent;
  const stakes = response.results.stakes_absent;
  const causal = response.results.causal_spine;
  const economy = response.results.economy;
  const center = response.results.center_consensus;
  const realization = response.results.intent_realization;

  // 1. K 承担 — from stakes_absent
  if (stakes) {
    const verdicts = Object.values(stakes.by_provider)
      .map((c) => {
        const j = (c?.judgment ?? {}) as Record<string, unknown>;
        return typeof j.verdict === "string" ? j.verdict : "";
      })
      .filter(Boolean);
    const presentCount = verdicts.filter((v) => v === "K_present").length;
    const implicitCount = verdicts.filter((v) => v === "K_implicit").length;
    const absentCount = verdicts.filter((v) => v === "K_absent").length;
    const total = verdicts.length;
    if (total > 0) {
      if (presentCount === total) {
        out.push({
          kind: "working",
          text: `你说到的人，读者感觉到 ta 真的在场，事情真的压在 ta 身上。这一层 ${total}/${total} 个 AI 读者都看到了。`,
        });
      } else if (presentCount > implicitCount + absentCount) {
        out.push({
          kind: "working",
          text: `读者多数看到 ta 在承担这件事，但不是所有人都完全感觉到（${presentCount}/${total}）。如果想更清楚，可以多写 ta 的内心动作或反应。`,
        });
      } else if (implicitCount >= total / 2) {
        out.push({
          kind: "consider",
          text: `你说到的人在场，但读者感觉 ta 还没有真正"承受"这件事——好像只是个旁观者。是有意留白吗？还是想让 ta 更明显地在承担？`,
        });
      } else if (absentCount >= total / 2) {
        out.push({
          kind: "missing",
          text: `读者读完，没感觉到任何人在承受这件事——像在看外面的事，不像在 inside someone。如果你想让读者跟着一个人感受，可以加 ta 的内心活动或具体反应。`,
        });
      }
    }
  }

  // 2. Center of gravity — from center_consensus + inferred_intent
  if (center) {
    const cell = Object.values(center.by_provider)[0];
    if (cell && !cell.error) {
      const j = (cell.judgment ?? {}) as {
        joint_consensus?: { is_strong: boolean; quote: string };
      };
      if (j.joint_consensus?.is_strong && j.joint_consensus.quote) {
        out.push({
          kind: "working",
          text: `你这段最重的一句话，AI 读到的是：「${j.joint_consensus.quote.trim()}」——这是你这段的"支点"。`,
        });
      }
    }
  } else if (intent) {
    const centers = Object.values(intent.by_provider)
      .map((c) => {
        const j = (c?.judgment ?? {}) as Record<string, unknown>;
        return typeof j.center_of_gravity === "string"
          ? j.center_of_gravity.trim()
          : "";
      })
      .filter(Boolean);
    if (centers.length > 0) {
      const counts = new Map<string, number>();
      for (const c of centers) {
        const key = c.slice(0, 12).replace(/[^一-龥a-zA-Z0-9]/g, "");
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
      if (top && top[1] >= 2) {
        const fullQuote = centers.find((c) =>
          c.slice(0, 12).replace(/[^一-龥a-zA-Z0-9]/g, "") === top[0],
        );
        if (fullQuote) {
          out.push({
            kind: "working",
            text: `你这段最重的一句话，多数读者读到的是：「${fullQuote}」`,
          });
        }
      } else {
        out.push({
          kind: "consider",
          text: `AI 读者们对"这段最重的一句"看法不一——这可能意味着你这段没有单一支点（rich emotional terrain，可以是优点），也可能意味着想强调的还没立出来。看你写的是哪种。`,
        });
      }
    }
  }

  // 3. Pattern break — from inferred_intent
  if (intent) {
    const breaks = Object.values(intent.by_provider)
      .map((c) => {
        const j = (c?.judgment ?? {}) as Record<string, unknown>;
        return typeof j.pattern_break === "string" ? j.pattern_break.trim() : "";
      })
      .filter((b) => b && b !== "无明显断裂");
    if (breaks.length > 0) {
      out.push({
        kind: "consider",
        text: `AI 注意到你这一段里有一处跟周围不太一样的地方——${breaks[0].slice(0, 80)}。这是你想强调的吗？`,
      });
    }
  }

  // 4. Subtext pattern
  if (intent) {
    const subtexts = Object.values(intent.by_provider)
      .map((c) => {
        const j = (c?.judgment ?? {}) as Record<string, unknown>;
        return typeof j.subtext_pattern === "string"
          ? j.subtext_pattern.trim()
          : "";
      })
      .filter(Boolean);
    if (subtexts.length >= 2) {
      out.push({
        kind: "consider",
        text: `AI 读到你在用一种 pattern：${subtexts[0].slice(0, 100)}。是有意的吗？`,
      });
    }
  }

  // 5. Causal
  if (causal) {
    const verdicts = Object.values(causal.by_provider)
      .map((c) => {
        const j = (c?.judgment ?? {}) as Record<string, unknown>;
        return typeof j.verdict === "string" ? j.verdict : "";
      })
      .filter(Boolean);
    const absentCount = verdicts.filter((v) => v === "causal_absent").length;
    const total = verdicts.length;
    if (total > 0 && absentCount >= total / 2) {
      out.push({
        kind: "missing",
        text: `读者觉得你的事情之间没有"因此"——只是"然后再然后"。如果想让读者跟随你的故事推进，可以让某些动作明确导致后面的事。`,
      });
    }
  }

  // 6. Economy slack
  if (economy) {
    const slacks = Object.values(economy.by_provider)
      .map((c) => {
        const j = (c?.judgment ?? {}) as Record<string, unknown>;
        return typeof j.slack === "string" ? j.slack.trim() : "";
      })
      .filter(Boolean);
    if (slacks.length >= 2) {
      out.push({
        kind: "consider",
        text: `AI 觉得有些细节没起到作用：${slacks[0].slice(0, 100)}。这些可以删，也可以加深让它们承重。`,
      });
    }
  }

  // 7. L3 projection
  if (intent) {
    const projections = Object.values(intent.by_provider)
      .map((c) => {
        const j = (c?.judgment ?? {}) as Record<string, unknown>;
        return {
          backstory:
            typeof j.speculative_backstory === "string"
              ? j.speculative_backstory.trim()
              : "",
          conf:
            typeof j.projection_confidence === "number"
              ? j.projection_confidence
              : 0,
        };
      })
      .filter((p) => p.backstory && p.conf > 0.5);
    if (projections.length >= 2) {
      out.push({
        kind: "projection",
        text: `AI 在文本之外补了一些 backstory：${projections[0].backstory.slice(0, 100)}。这是 AI 的猜测，不是你写的。如果你的故事和这个猜测一致——说明你的暗示成立。如果不一致——你的细节误导了暗示，可以调。`,
      });
    }
  }

  // 8. Intent realization
  if (realization) {
    const verdicts = Object.values(realization.by_provider)
      .map((c) => {
        const j = (c?.judgment ?? {}) as Record<string, unknown>;
        return typeof j.verdict === "string" ? j.verdict : "";
      })
      .filter(Boolean);
    const partialCount = verdicts.filter(
      (v) => v === "intent_partial",
    ).length;
    const unimpCount = verdicts.filter(
      (v) => v === "intent_unimplemented",
    ).length;
    if (partialCount + unimpCount >= verdicts.length / 2) {
      const cell = Object.values(realization.by_provider).find((c) => {
        const j = (c?.judgment ?? {}) as Record<string, unknown>;
        return (
          typeof j.unrealized === "string" && j.unrealized.trim().length > 0
        );
      });
      if (cell) {
        const j = (cell.judgment ?? {}) as Record<string, unknown>;
        const unrealized =
          typeof j.unrealized === "string" ? j.unrealized.trim() : "";
        out.push({
          kind: "missing",
          text: `你前面填了你想做什么。AI 比较了一下，prose 里这部分还没出来：${unrealized.slice(0, 120)}`,
        });
      }
    }
  }

  if (out.length === 0) {
    out.push({
      kind: "working",
      text: "AI 没找到明显问题，也没找到特别突出的支点。你这段是稳定的中性写作——可以接着写，也可以等有具体方向再回来。",
    });
  }

  return out;
}

function ObservationBox({ observation: o }: { observation: Observation }) {
  const palette: Record<
    Observation["kind"],
    { bg: string; border: string; label: string; emoji: string }
  > = {
    working: {
      bg: "#f3f7ed",
      border: "#5e8a4a",
      label: "在场",
      emoji: "✓",
    },
    missing: {
      bg: "#faf0e9",
      border: "#a04040",
      label: "缺失",
      emoji: "✗",
    },
    consider: {
      bg: "#faf5e9",
      border: "#a07a30",
      label: "考虑",
      emoji: "○",
    },
    projection: {
      bg: "#f0f3f8",
      border: "#5b6f8a",
      label: "AI 猜测",
      emoji: "⚠",
    },
  };
  const p = palette[o.kind];
  return (
    <div
      style={{
        background: p.bg,
        borderLeft: `3px solid ${p.border}`,
        padding: "10px 14px",
        borderRadius: 3,
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
      }}
    >
      <span
        style={{
          color: p.border,
          fontWeight: 700,
          fontSize: 16,
          lineHeight: 1.4,
          minWidth: 18,
        }}
      >
        {p.emoji}
      </span>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 10,
            color: p.border,
            fontWeight: 700,
            letterSpacing: 0.4,
            textTransform: "uppercase",
            marginBottom: 3,
          }}
        >
          {p.label}
        </div>
        <div
          style={{
            fontSize: 14,
            color: "#1a1a1a",
            lineHeight: 1.6,
            fontFamily: 'Georgia, "Times New Roman", serif',
          }}
        >
          {o.text}
        </div>
      </div>
    </div>
  );
}

// ─── Progress indicator ────────────────────────────────────────────────────

function Progress({ current }: { current: Stage }) {
  const steps: { id: Stage; label: string }[] = [
    { id: "mode", label: "1. 模式" },
    { id: "anchor", label: "2. 抓住" },
    { id: "drill", label: "3. 具体" },
    { id: "freedump", label: "4. 写" },
    { id: "mirror", label: "5. AI 读" },
  ];
  const currentIdx =
    current === "running"
      ? 3
      : steps.findIndex((s) => s.id === current);
  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        marginTop: 12,
        fontSize: 11,
        color: "#888",
        letterSpacing: 0.3,
      }}
    >
      {steps.map((s, i) => (
        <span
          key={s.id}
          style={{
            color: i === currentIdx ? "#1a1a1a" : i < currentIdx ? "#5e8a4a" : "#bbb",
            fontWeight: i === currentIdx ? 600 : 400,
          }}
        >
          {s.label}
          {i < steps.length - 1 && (
            <span style={{ margin: "0 6px", color: "#ddd" }}>›</span>
          )}
        </span>
      ))}
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function countWords(s: string): number {
  const trimmed = s.trim();
  if (!trimmed) return 0;
  const latin = trimmed.split(/\s+/).filter((w) => /[A-Za-zÀ-ÿ]/.test(w)).length;
  const cjk = (trimmed.match(/[一-鿿぀-ヿ가-힯]/g) ?? []).length;
  return latin + cjk;
}

// ─── Styles ────────────────────────────────────────────────────────────────

const mainStyle: React.CSSProperties = {
  maxWidth: 720,
  margin: "0 auto",
  padding: "40px 24px 80px",
  fontFamily: "system-ui, sans-serif",
  color: "#1a1a1a",
  minHeight: "100vh",
};
const h1Style: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 32,
  fontWeight: 400,
  letterSpacing: -0.4,
  margin: "8px 0 0",
};
const h2Style: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 22,
  fontWeight: 400,
  marginTop: 0,
  marginBottom: 12,
};
const kickerStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: 1.5,
  textTransform: "uppercase",
  color: "#a07a30",
  fontWeight: 600,
  margin: 0,
};
const leadStyle: React.CSSProperties = {
  fontSize: 14,
  color: "#666",
  lineHeight: 1.6,
  marginTop: 8,
  maxWidth: 600,
};
const pStyle: React.CSSProperties = {
  fontSize: 14,
  color: "#555",
  lineHeight: 1.7,
  marginBottom: 14,
};
const fieldLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  color: "#666",
  marginBottom: 5,
  letterSpacing: 0.2,
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  fontSize: 14,
  border: "1px solid #d4cdb8",
  borderRadius: 3,
  fontFamily: "inherit",
  background: "white",
};
const textareaStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  fontSize: 14,
  border: "1px solid #ccc",
  borderRadius: 4,
  fontFamily: "Georgia, serif",
  lineHeight: 1.65,
  resize: "vertical",
};
const tokenInputStyle: React.CSSProperties = {
  flex: 1,
  padding: "8px 12px",
  fontSize: 14,
  border: "1px solid #ccc",
  borderRadius: 4,
};
const btnPrimary: React.CSSProperties = {
  padding: "10px 18px",
  background: "#1a1a1a",
  color: "white",
  border: "none",
  borderRadius: 3,
  fontSize: 14,
  letterSpacing: 0.3,
  cursor: "pointer",
};
const btnPrimaryDisabled: React.CSSProperties = {
  ...btnPrimary,
  background: "#bbb",
  cursor: "not-allowed",
};
const btnGhost: React.CSSProperties = {
  padding: "9px 14px",
  background: "transparent",
  color: "#555",
  border: "1px solid #ccc",
  borderRadius: 3,
  fontSize: 13,
  cursor: "pointer",
};
const btnSecondary: React.CSSProperties = {
  padding: "9px 16px",
  background: "#8a6d20",
  color: "white",
  border: "none",
  borderRadius: 3,
  fontSize: 13,
  letterSpacing: 0.3,
  cursor: "pointer",
};
const navRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  marginTop: 20,
  gap: 10,
};
const errorBox: React.CSSProperties = {
  marginTop: 16,
  padding: 12,
  background: "#fde8e8",
  border: "1px solid #d4a0a0",
  borderRadius: 3,
  fontSize: 13,
  color: "#7a2020",
};
const modeButtonStyle: React.CSSProperties = {
  padding: 16,
  background: "white",
  border: "1px solid #e0dccb",
  borderRadius: 5,
  textAlign: "left",
  cursor: "pointer",
};
const runningStyle: React.CSSProperties = {
  padding: "40px 20px",
  textAlign: "center" as const,
  background: "#f5f6f8",
  borderRadius: 6,
  border: "1px dashed #c0c5d0",
};
const footerStyle: React.CSSProperties = {
  marginTop: 40,
  textAlign: "right" as const,
  borderTop: "1px solid #eee",
  paddingTop: 14,
};

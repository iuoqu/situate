"use client";

import { useState } from "react";

import type { AngleQuestion, AnsweredQuestion, SynthesisResult } from "@/lib/map/types";

// ─── Sample materials ─────────────────────────────────────────────────────

interface Sample {
  id: string;
  label: string;
  material: string;
  note: string;
}

const SAMPLES: Sample[] = [
  {
    id: "ding",
    label: "丁文斌案（多中心 · 法律系统）",
    note: "2016黑刑终169号 VAT 骗税上诉案。预期：高层抽象收敛（系统）或散射到系统上",
    material: `2016年，黑龙江省高级人民法院审理了一起虚开增值税专用发票案（案号2016黑刑终169号）。

被告人丁文斌，男，1979年生，哈尔滨人。

案件经过：2013年至2014年间，丁文斌作为实际控制人，通过空壳公司大庆某贸易有限公司，以购买
增值税专用发票的方式，虚开发票金额共计人民币1200余万元，税款200余万元。

主要人物：
- 丁文斌：主犯，公司实际控制人，一审判处有期徒刑11年
- 张某：丁的合作人，认罪态度较好，获缓刑
- 某国税局稽查人员：启动调查，发现异常发票流水
- 辩护律师：援引"主观认知不足"作为辩护依据
- 二审法院合议庭三名法官

案件争议点：
1. 丁文斌是否具有主观故意（辩方称被下家蒙骗）
2. 发票金额的认定（部分发票存在争议）
3. 量刑幅度（辩方请求从轻）

二审结果：维持原判，驳回上诉。合议庭认定主观故意成立，理由是丁文斌本人签署了相关协议并
收取了差价费用。

发票体系背景：中国增值税专用发票制度是企业抵扣税款的核心凭证。虚开发票即制造虚假的税款
抵扣，直接损害国家税收。该制度在1994年分税制改革后建立，多年来是税务稽查的重点领域。`,
  },
  {
    id: "camellia",
    label: "山茶花场景（轻盈 · 喜剧 · 乡村）",
    note: "农村喜剧，羽量级筹码，测试音区中立：归纳不应要求更重的中心",
    material: `故事背景：1930年代朝鲜半岛农村，早春。

人物：
- 点顺（女，14岁）：农家姑娘，村里出了名的泼辣和倔强。爱在山茶花树下玩耍。
  每次生气就去摘山茶花。
- 德龙（男，15岁）：邻村的农家少年，来做季节工。喜欢点顺但不敢说，
  经常故意惹她生气然后逃跑。行为幼稚，但真实。
- 点顺的父母：普通农民，让点顺去地里干活，点顺经常逃跑。

核心事件：
德龙和点顺在田埂上争执，德龙抢了点顺的镐头然后跑掉。点顺追了半里地没追上，
回来看到田埂边的山茶花开了，摘了一朵，心里又气又说不清是什么，
就站在那里发了一会儿呆。

季节细节：
早春的山野，雪刚化，山茶花是村子里最早开的花，红色，在枯草里很显眼。
村里的孩子都知道山茶花树在哪里，会偷偷去摘，被大人骂破坏树。
农忙开始了，但孩子们还是找机会偷懒。

筹码：非常小——不是生死，不是爱情的明确表达，只是一个女孩站在花前，
心里有点什么但说不清楚。读者明白，她自己也许还不明白。`,
  },
  {
    id: "blank",
    label: "（空白 — 自己粘）",
    note: "",
    material: "",
  },
];

// ─── Providers ────────────────────────────────────────────────────────────

interface ProviderOption {
  id: string;
  label: string;
}

const PROVIDERS: ProviderOption[] = [
  { id: "alibaba:qwen3.7-max", label: "Qwen3.7 Max" },
  { id: "alibaba:qwen3.6-plus", label: "Qwen3.6 Plus" },
  { id: "alibaba:qwen3.6-flash", label: "Qwen3.6 Flash" },
  { id: "alibaba:qwen-plus", label: "Qwen Plus" },
  { id: "deepseek:deepseek-chat", label: "DeepSeek Chat" },
  { id: "deepseek:deepseek-v4-flash", label: "DeepSeek V4 Flash" },
  { id: "anthropic:claude-sonnet-4-6", label: "Claude Sonnet" },
];

// ─── Types ────────────────────────────────────────────────────────────────

interface QuestionsResponse {
  questions: AngleQuestion[];
  selection_note: string;
  meta: { provider_id: string; model: string; duration_ms: number };
}

interface SynthesisResponse extends SynthesisResult {
  meta: { provider_id: string; model: string; duration_ms: number };
}

type Stage = "material" | "answering" | "synthesis";

// ─── Main component ──────────────────────────────────────────────────────

export function MapPreviewClient() {
  const [stage, setStage] = useState<Stage>("material");
  const [material, setMaterial] = useState(SAMPLES[0].material);
  const [provider, setProvider] = useState(PROVIDERS[0].id);
  const [questionsResp, setQuestionsResp] = useState<QuestionsResponse | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [synthesisResp, setSynthesisResp] = useState<SynthesisResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pingResult, setPingResult] = useState<string | null>(null);

  async function apiFetch(url: string, body: unknown): Promise<Response> {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
    return resp;
  }

  async function extractError(resp: Response): Promise<string> {
    const text = await resp.text();
    try {
      const j = JSON.parse(text) as Record<string, unknown>;
      const detail = typeof j.detail === "string" ? j.detail : null;
      const base = typeof j.error === "string" ? j.error : "server error";
      return detail ? `HTTP ${resp.status} ${base}: ${detail}` : `HTTP ${resp.status} ${base}`;
    } catch {
      return `HTTP ${resp.status}: ${text.slice(0, 400)}`;
    }
  }

  async function generateQuestions() {
    if (!material.trim()) { setError("Paste some source material first."); return; }
    setError(null);
    setQuestionsResp(null);
    setSynthesisResp(null);
    setRunning(true);
    try {
      const resp = await apiFetch("/api/map/questions", { material, provider });
      if (resp.status === 401) {
        setError("Not logged in. Open /auth/login, then come back.");
        return;
      }
      if (!resp.ok) {
        setError(await extractError(resp));
        return;
      }
      const data = (await resp.json()) as QuestionsResponse;
      setQuestionsResp(data);
      setAnswers(data.questions.map(() => ""));
      setStage("answering");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(
        msg.includes("fetch") || msg.includes("network") || msg.includes("Failed")
          ? `连接失败（ERR_CONNECTION_CLOSED）— 服务端无响应。\n可能原因：函数崩溃、ANTHROPIC_API_KEY 未设置、部署未完成。\n\nraw: ${msg}`
          : msg,
      );
    } finally {
      setRunning(false);
    }
  }

  async function runSynthesis() {
    if (!questionsResp) return;
    const answered: AnsweredQuestion[] = questionsResp.questions.map((q, i) => ({
      angle_id: q.angle_id,
      angle_name: q.angle_name,
      question: q.question,
      answer: answers[i] ?? "",
    }));
    const unanswered = answered.filter((a) => !a.answer.trim()).length;
    if (unanswered > answered.length / 2) {
      setError(`Only ${answered.length - unanswered} of ${answered.length} questions answered. Fill at least half.`);
      return;
    }
    setError(null);
    setSynthesisResp(null);
    setRunning(true);
    try {
      const resp = await apiFetch("/api/map/synthesize", { material, answers: answered, provider });
      if (resp.status === 401) {
        setError("Not logged in. Open /auth/login, then come back.");
        return;
      }
      if (!resp.ok) {
        setError(await extractError(resp));
        return;
      }
      const data = (await resp.json()) as SynthesisResponse;
      setSynthesisResp(data);
      setStage("synthesis");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(
        msg.includes("fetch") || msg.includes("network") || msg.includes("Failed")
          ? `连接失败（ERR_CONNECTION_CLOSED）— 服务端无响应。\n可能原因：函数崩溃、ANTHROPIC_API_KEY 未设置、部署未完成。\n\nraw: ${msg}`
          : msg,
      );
    } finally {
      setRunning(false);
    }
  }

  async function pingRoute(mode: "env" | "anthropic" | "tool" = "env") {
    const url =
      mode === "anthropic"
        ? "/api/map/ping?test=anthropic"
        : mode === "tool"
          ? "/api/map/ping?test=tool"
          : "/api/map/ping";
    const label =
      mode === "anthropic"
        ? "testing bare Anthropic call…"
        : mode === "tool"
          ? "testing tool_use call (25s timeout)…"
          : "pinging…";
    setPingResult(label);
    try {
      const resp = await fetch(url, { credentials: "same-origin" });
      const text = await resp.text();
      setPingResult(`${resp.status} ${text.slice(0, 500)}`);
    } catch (e) {
      setPingResult(`连接失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  function reset() {
    setStage("material");
    setQuestionsResp(null);
    setSynthesisResp(null);
    setAnswers([]);
    setError(null);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <StepBar stage={stage} />

      {/* ── Step 1: Material ── */}
      <section>
        {/* Provider selector */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10, alignItems: "center" }}>
          <span style={labelSmall}>provider</span>
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              onClick={() => setProvider(p.id)}
              style={chip(provider === p.id)}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => pingRoute("env")}
            style={{ ...btnGhost, fontSize: 11, marginLeft: 8 }}
            title="GET /api/map/ping — env check only, no AI call"
          >
            🔍 ping
          </button>
          <button
            onClick={() => pingRoute("anthropic")}
            style={{ ...btnGhost, fontSize: 11 }}
            title="GET /api/map/ping?test=anthropic — bare Anthropic API call, no tools"
          >
            🔍 bare call
          </button>
          <button
            onClick={() => pingRoute("tool")}
            style={{ ...btnGhost, fontSize: 11 }}
            title="GET /api/map/ping?test=tool — Anthropic call WITH tool_choice + cache_control"
          >
            🔍 tool call
          </button>
          {pingResult && (
            <span style={{ fontSize: 11, fontFamily: "monospace", color: pingResult.startsWith("2") ? "#3a7a3a" : "#a04040", maxWidth: 400, wordBreak: "break-all" }}>
              {pingResult}
            </span>
          )}
        </div>

        {/* Sample selector */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8, alignItems: "center" }}>
          <span style={labelSmall}>samples</span>
          {SAMPLES.map((s) => (
            <button
              key={s.id}
              onClick={() => { setMaterial(s.material); reset(); }}
              style={chip(material === s.material)}
              title={s.note}
            >
              {s.label}
            </button>
          ))}
        </div>
        <label htmlFor="material" style={{ display: "block", fontSize: 13, color: "#666", marginBottom: 6 }}>
          素材世界（作者的材料描述）
        </label>
        <textarea
          id="material"
          value={material}
          onChange={(e) => { setMaterial(e.target.value); if (stage !== "material") reset(); }}
          rows={14}
          style={textareaStyle}
        />
        <div style={{ marginTop: 10 }}>
          <button
            onClick={generateQuestions}
            disabled={running}
            style={running ? btnDisabled : btnPrimary}
          >
            {running && stage === "material" ? "生成问题中…" : "① 生成角度问题"}
          </button>
          {error && <pre style={errorStyle}>{error}</pre>}
        </div>
        {questionsResp && (
          <MetaBadge meta={questionsResp.meta} note={`selection: ${questionsResp.selection_note}`} />
        )}
      </section>

      {/* ── Step 2: Answer questions ── */}
      {questionsResp && (
        <section style={{ borderTop: "1px solid #e7e1d3", paddingTop: 20 }}>
          <h2 style={sectionH2}>② 回答角度问题</h2>
          <p style={{ fontSize: 13, color: "#888", marginBottom: 16, marginTop: 0 }}>
            每个问题都基于你的素材实例化。尽量用你自己的话回答，不需要很长。
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {questionsResp.questions.map((q, i) => (
              <QuestionCard
                key={q.angle_id}
                question={q}
                index={i}
                answer={answers[i] ?? ""}
                onAnswer={(v) => setAnswers((prev) => {
                  const next = [...prev];
                  next[i] = v;
                  return next;
                })}
              />
            ))}
          </div>
          <div style={{ marginTop: 20 }}>
            <button
              onClick={runSynthesis}
              disabled={running}
              style={running ? btnDisabled : btnPrimary}
            >
              {running && stage === "answering" ? "归纳中…" : "③ 运行归纳算法"}
            </button>
            {error && <pre style={errorStyle}>{error}</pre>}
          </div>
        </section>
      )}

      {/* ── Step 3: Synthesis result ── */}
      {synthesisResp && (
        <section style={{ borderTop: "1px solid #e7e1d3", paddingTop: 20 }}>
          <h2 style={sectionH2}>③ 归纳结果</h2>
          <SynthesisPanel result={synthesisResp} />
          <div style={{ marginTop: 16 }}>
            <button onClick={reset} style={btnGhost}>重新开始</button>
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Step bar ─────────────────────────────────────────────────────────────

function StepBar({ stage }: { stage: Stage }) {
  const steps: { id: Stage; label: string }[] = [
    { id: "material", label: "① 素材" },
    { id: "answering", label: "② 回答" },
    { id: "synthesis", label: "③ 归纳" },
  ];
  const order = ["material", "answering", "synthesis"];
  return (
    <div style={{ display: "flex", gap: 0 }}>
      {steps.map((s, i) => {
        const done = order.indexOf(stage) > i;
        const active = stage === s.id;
        return (
          <div
            key={s.id}
            style={{
              padding: "6px 16px",
              fontSize: 12,
              fontWeight: active ? 600 : 400,
              color: active ? "#2a5e8a" : done ? "#5e8a4a" : "#bbb",
              borderBottom: active ? "2px solid #2a5e8a" : done ? "2px solid #5e8a4a" : "2px solid #e0e0e0",
              marginRight: 2,
            }}
          >
            {s.label}
          </div>
        );
      })}
    </div>
  );
}

// ─── Question card ────────────────────────────────────────────────────────

function QuestionCard({
  question,
  index,
  answer,
  onAnswer,
}: {
  question: AngleQuestion;
  index: number;
  answer: string;
  onAnswer: (v: string) => void;
}) {
  const hasAnswer = answer.trim().length > 0;
  return (
    <div style={{
      border: "1px solid #e0dccb",
      borderLeft: `3px solid ${hasAnswer ? "#5e8a4a" : "#d4cdb8"}`,
      borderRadius: 4,
      padding: "12px 14px",
      background: "#fff",
    }}>
      <div style={{ display: "flex", gap: 10, alignItems: "baseline", marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: "#888", fontWeight: 600, minWidth: 20 }}>
          {index + 1}
        </span>
        <span style={{ fontSize: 11, color: "#a07a30", fontWeight: 600, letterSpacing: 0.3 }}>
          {question.angle_name} (角度 {question.angle_id})
        </span>
      </div>
      <p style={{ margin: "0 0 6px 30px", fontSize: 15, lineHeight: 1.6, color: "#222",
        fontFamily: 'Georgia, "Times New Roman", serif' }}>
        {question.question}
      </p>
      {question.opener && (
        <p style={{ margin: "0 0 10px 30px", fontSize: 13, lineHeight: 1.55,
          color: "#8a7a55", fontStyle: "italic" }}>
          💡 {question.opener}
        </p>
      )}
      <textarea
        value={answer}
        onChange={(e) => onAnswer(e.target.value)}
        placeholder="随便写，写不好也没关系…"
        rows={3}
        style={{
          ...textareaStyle,
          marginLeft: 30,
          width: "calc(100% - 30px)",
          fontSize: 14,
          rows: 3,
          minHeight: 72,
          padding: "8px 10px",
        } as React.CSSProperties}
      />
    </div>
  );
}

// ─── Synthesis panel ──────────────────────────────────────────────────────

function SynthesisPanel({ result }: { result: SynthesisResponse }) {
  const branchColor = {
    convergent: "#5e8a4a",
    higher_abstraction: "#a07a30",
    divergent: "#a04040",
  }[result.branch];

  const branchLabel = {
    convergent: "收敛 convergent",
    higher_abstraction: "高层抽象收敛 higher_abstraction",
    divergent: "不收敛 divergent",
  }[result.branch];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Branch badge + message */}
      <div style={{
        border: "1px solid #e0dccb",
        borderLeft: `4px solid ${branchColor}`,
        borderRadius: 4,
        padding: "14px 16px",
        background: "#fff",
      }}>
        <div style={{ display: "flex", gap: 10, alignItems: "baseline", marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: branchColor }}>
            {branchLabel}
          </span>
          <MetaBadge meta={result.meta} />
        </div>

        {result.recurring.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 5, letterSpacing: 0.3 }}>
              重复出现的短语
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {result.recurring.map((phrase, i) => (
                <span key={i} style={{
                  padding: "3px 10px",
                  background: "#f0f4ec",
                  border: "1px solid #c8d9bc",
                  borderRadius: 12,
                  fontSize: 13,
                  color: "#2d4a1f",
                  fontFamily: 'Georgia, "Times New Roman", serif',
                }}>
                  {phrase}
                </span>
              ))}
            </div>
          </div>
        )}

        {result.shared_frame && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 5, letterSpacing: 0.3 }}>
              共同框架（作者语言）
            </div>
            <span style={{
              padding: "4px 12px",
              background: "#f8f2e2",
              border: "1px solid #d9c89a",
              borderRadius: 4,
              fontSize: 14,
              color: "#5a3a10",
              fontFamily: 'Georgia, "Times New Roman", serif',
            }}>
              {result.shared_frame}
            </span>
          </div>
        )}

        <div style={{
          padding: "12px 14px",
          background: "#f8f6f0",
          border: "1px solid #e0dccb",
          borderRadius: 4,
          fontSize: 15,
          lineHeight: 1.7,
          fontFamily: 'Georgia, "Times New Roman", serif',
          color: "#2a1a0a",
          whiteSpace: "pre-wrap",
        }}>
          {result.message}
        </div>
      </div>

      {/* Extracted phrases detail */}
      <details style={{ border: "1px solid #e0dccb", borderRadius: 4, background: "#fdfcf8" }}>
        <summary style={{ padding: "10px 14px", fontSize: 12, cursor: "pointer", color: "#666" }}>
          提取的短语（每条回答 1–3 个）
        </summary>
        <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          {result.extracted_phrases.map((ep, i) => (
            <div key={i} style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
              <span style={{ fontSize: 11, color: "#888", minWidth: 60 }}>角度 {ep.angle_id}</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {ep.phrases.map((p, j) => (
                  <span key={j} style={{
                    padding: "2px 8px",
                    background: "#f0f0ec",
                    border: "1px solid #d8d4c8",
                    borderRadius: 3,
                    fontSize: 12,
                    fontFamily: 'Georgia, "Times New Roman", serif',
                    color: "#444",
                  }}>
                    {p}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

// ─── Meta badge ───────────────────────────────────────────────────────────

function MetaBadge({
  meta,
  note,
}: {
  meta: { provider_id: string; model: string; duration_ms: number };
  note?: string;
}) {
  return (
    <span style={{ fontSize: 11, color: "#bbb", marginLeft: 4 }}>
      {meta.model} · {(meta.duration_ms / 1000).toFixed(1)}s
      {note && ` · ${note}`}
    </span>
  );
}

// ─── Inline styles ────────────────────────────────────────────────────────

const textareaStyle: React.CSSProperties = {
  width: "100%",
  padding: 12,
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 14,
  lineHeight: 1.7,
  border: "1px solid #ccc",
  borderRadius: 4,
  resize: "vertical",
  boxSizing: "border-box",
};

const btnPrimary: React.CSSProperties = {
  padding: "8px 14px",
  background: "#2a5e8a",
  color: "white",
  border: "none",
  borderRadius: 4,
  fontSize: 14,
  cursor: "pointer",
};

const btnDisabled: React.CSSProperties = {
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

const errorStyle: React.CSSProperties = {
  color: "#8a2a2a",
  fontSize: 12,
  fontFamily: "monospace",
  background: "#fff5f5",
  border: "1px solid #f0cccc",
  borderRadius: 4,
  padding: "10px 14px",
  whiteSpace: "pre-wrap",
  wordBreak: "break-all",
  maxHeight: 220,
  overflow: "auto",
  display: "block",
  marginTop: 10,
  width: "100%",
  boxSizing: "border-box",
};

const labelSmall: React.CSSProperties = {
  fontSize: 11,
  color: "#888",
  letterSpacing: 0.4,
  textTransform: "uppercase",
  marginRight: 4,
};

const sectionH2: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 18,
  fontWeight: 400,
  margin: "0 0 4px",
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
  };
}

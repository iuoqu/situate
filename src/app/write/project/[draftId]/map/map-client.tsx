"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { MapData } from "@/db/schema";
import type { AngleQuestion, SynthesisResult } from "@/lib/map/types";

/**
 * MapClient — Phase 1 (situate.map) interactive flow.
 *
 * Stages:
 *   material   → write source material description
 *   questions  → display 5–6 angle questions (system-generated)
 *   answers    → writer answers each question
 *   synthesis  → system runs synthesis, displays result + branch message
 *   center     → writer names the center
 *   complete   → center card displayed; proceed to act
 *
 * Persists to /api/write/project/[draftId]/map on each stage transition.
 */

type Phase = "material" | "questions" | "answers" | "synthesis" | "center" | "complete";

interface Props {
  draftId: string;
  initialMapData: object;
}

export function MapClient({ draftId, initialMapData }: Props) {
  const router = useRouter();
  const initial = initialMapData as MapData;

  const [phase, setPhase] = useState<Phase>(initial.phase ?? "material");
  const [material, setMaterial] = useState(initial.material ?? "");
  const [questions, setQuestions] = useState<AngleQuestion[]>(
    (initial.questions as AngleQuestion[]) ?? [],
  );
  const [answers, setAnswers] = useState<string[]>(
    initial.answers ? initial.answers.map((a) => a.answer) : [],
  );
  const [synthesis, setSynthesis] = useState<SynthesisResult | null>(
    (initial.synthesis as SynthesisResult) ?? null,
  );
  const [center, setCenter] = useState(initial.center ?? "");
  const [centerCard, setCenterCard] = useState(initial.center_card ?? null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Persist map_data to server ──────────────────────────────────────────
  async function saveMapData(patch: Partial<MapData>) {
    await fetch(`/api/write/project/${draftId}/map`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  // ── Stage: material → questions ─────────────────────────────────────────
  async function generateQuestions() {
    if (!material.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/map/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ material }),
      });
      if (!resp.ok) {
        const j = await resp.json() as Record<string, unknown>;
        throw new Error(typeof j.detail === "string" ? j.detail : JSON.stringify(j));
      }
      const data = await resp.json() as { questions: AngleQuestion[] };
      setQuestions(data.questions);
      setAnswers(data.questions.map(() => ""));
      const newPhase: Phase = "questions";
      setPhase(newPhase);
      await saveMapData({ phase: newPhase, material, questions: data.questions as unknown as MapData["questions"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  // ── Stage: questions → answers ──────────────────────────────────────────
  function proceedToAnswers() {
    setPhase("answers");
    void saveMapData({ phase: "answers" });
  }

  // ── Stage: answers → synthesis ──────────────────────────────────────────
  async function runSynthesis() {
    setLoading(true);
    setError(null);
    try {
      const answeredQuestions = questions.map((q, i) => ({
        angle_id: q.angle_id,
        angle_name: q.angle_name,
        question: q.question,
        answer: answers[i] ?? "",
      }));
      const resp = await fetch("/api/map/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ material, answers: answeredQuestions }),
      });
      if (!resp.ok) {
        const j = await resp.json() as Record<string, unknown>;
        throw new Error(typeof j.detail === "string" ? j.detail : JSON.stringify(j));
      }
      const data = await resp.json() as { result: SynthesisResult };
      setSynthesis(data.result);
      const newPhase: Phase = "synthesis";
      setPhase(newPhase);
      await saveMapData({
        phase: newPhase,
        answers: answeredQuestions,
        synthesis: data.result as unknown as MapData["synthesis"],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  // ── Stage: synthesis → center ────────────────────────────────────────────
  function proceedToCenter() {
    setPhase("center");
    void saveMapData({ phase: "center" });
  }

  // ── Stage: center → complete (generate center card) ─────────────────────
  async function submitCenter() {
    if (!center.trim() || !synthesis) return;
    setLoading(true);
    setError(null);
    try {
      // Build center card from synthesis recurring phrases + writer's answers
      const phrases = synthesis.recurring.length > 0
        ? synthesis.recurring
        : (synthesis.extracted_phrases ?? []).flatMap((ep) => ep.phrases).slice(0, 5);

      // Core question: the synthesis message reworded around the center
      // For now we surface the synthesis message and let the writer see it.
      // A future pass can generate a more tailored core_question via LLM.
      const card: MapData["center_card"] = {
        center,
        phrases,
        core_question: synthesis.message,
        hardest_part: "",   // writer fills this in, or we generate in a later pass
        not_center: [],     // derived from questions that didn't converge
      };
      setCenterCard(card);
      const newPhase: Phase = "complete";
      setPhase(newPhase);
      await saveMapData({ phase: newPhase, center, center_card: card });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  // ── Skip structure, go straight to writing ──────────────────────────────
  async function beginWriting() {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`/api/write/project/${draftId}/begin-writing`, {
        method: "POST",
        redirect: "manual",
      });
      if (resp.type === "opaqueredirect" || resp.redirected) {
        router.push(resp.url || `/write/template/${draftId}`);
        return;
      }
      const location = resp.headers.get("location");
      router.push(location || `/write/template/${draftId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLoading(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <main style={mainStyle}>
      <header style={headerStyle}>
        <p style={kickerStyle}>situate.map · 找中心</p>
        <div style={progressStyle}>
          {(["material", "questions", "answers", "synthesis", "center", "complete"] as Phase[]).map((p, i) => (
            <div key={p} style={{
              ...progressDotStyle,
              background: phase === p ? "#1a1a1a"
                : ["material","questions","answers","synthesis","center","complete"]
                    .indexOf(phase) > i ? "#9b8a6b" : "#e8e3d8",
            }} />
          ))}
        </div>
      </header>

      {error && <p style={errorStyle}>{error}</p>}

      {/* ── MATERIAL ──────────────────────────────────────────────── */}
      {phase === "material" && (
        <section style={sectionStyle}>
          <h2 style={h2Style}>你手里有什么？</h2>
          <p style={instrStyle}>
            流水账就行。写下你的人物、事件、地点、做过的采访、读过的材料。
            不用写得好——把材料倒出来就够了。
          </p>
          <textarea
            style={textareaStyle}
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
            placeholder="随便写，写不好也没关系…"
            rows={10}
          />
          <button
            style={{ ...primaryBtn, opacity: material.trim() ? 1 : 0.4 }}
            disabled={!material.trim() || loading}
            onClick={generateQuestions}
          >
            {loading ? "生成问题中…" : "生成角度问题 →"}
          </button>
        </section>
      )}

      {/* ── QUESTIONS ─────────────────────────────────────────────── */}
      {phase === "questions" && (
        <section style={sectionStyle}>
          <h2 style={h2Style}>这是为你挑的 {questions.length} 个问题</h2>
          <p style={instrStyle}>看一遍，下一步逐题回答。</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {questions.map((q, i) => (
              <div key={i} style={questionPreviewStyle}>
                <p style={angleTagStyle}>{q.angle_name}</p>
                <p style={questionTextStyle}>{q.question}</p>
              </div>
            ))}
          </div>
          <button style={primaryBtn} onClick={proceedToAnswers}>
            开始回答 →
          </button>
        </section>
      )}

      {/* ── ANSWERS ───────────────────────────────────────────────── */}
      {phase === "answers" && (
        <section style={sectionStyle}>
          <h2 style={h2Style}>逐题回答</h2>
          <p style={instrStyle}>随便写，一两句也行。引子只是入口，不用跟着走。</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {questions.map((q, i) => (
              <div key={i}>
                <p style={angleTagStyle}>{q.angle_name}</p>
                <p style={questionTextStyle}>{q.question}</p>
                {q.openers.length > 0 && (
                  <div style={{ margin: "6px 0 10px 0" }}>
                    {q.openers.map((op, j) => (
                      <p key={j} style={openerStyle}>💡 {op}</p>
                    ))}
                  </div>
                )}
                <textarea
                  style={{ ...answerTextareaStyle }}
                  value={answers[i] ?? ""}
                  onChange={(e) => {
                    const next = [...answers];
                    next[i] = e.target.value;
                    setAnswers(next);
                  }}
                  placeholder="随便写…"
                  rows={4}
                />
              </div>
            ))}
          </div>
          <button
            style={{ ...primaryBtn, opacity: answers.some((a) => a.trim()) ? 1 : 0.4 }}
            disabled={!answers.some((a) => a.trim()) || loading}
            onClick={runSynthesis}
          >
            {loading ? "归纳中…" : "运行归纳算法 →"}
          </button>
        </section>
      )}

      {/* ── SYNTHESIS ─────────────────────────────────────────────── */}
      {phase === "synthesis" && synthesis && (
        <section style={sectionStyle}>
          <h2 style={h2Style}>归纳结果</h2>
          {synthesis.recurring.length > 0 && (
            <div style={phraseBoxStyle}>
              {synthesis.recurring.map((p, i) => (
                <span key={i} style={phraseTagStyle}>"{p}"</span>
              ))}
            </div>
          )}
          <p style={synthesisMessageStyle}>{synthesis.message}</p>
          {synthesis.branch !== "divergent" && (
            <button style={primaryBtn} onClick={proceedToCenter}>
              命名中心 →
            </button>
          )}
          {synthesis.branch === "divergent" && (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button style={secondaryBtn} onClick={() => {
                setPhase("answers");
                void saveMapData({ phase: "answers" });
              }}>
                继续回答问题
              </button>
              <button style={primaryBtn} onClick={proceedToCenter}>
                直接告诉我
              </button>
            </div>
          )}
        </section>
      )}

      {/* ── CENTER ────────────────────────────────────────────────── */}
      {phase === "center" && (
        <section style={sectionStyle}>
          <h2 style={h2Style}>它是？</h2>
          <p style={instrStyle}>
            中心可以是人，可以是地方，可以是机构或系统。用你自己的词。
          </p>
          <input
            style={centerInputStyle}
            value={center}
            onChange={(e) => setCenter(e.target.value)}
            placeholder="名字或一句话…"
            autoFocus
          />
          <button
            style={{ ...primaryBtn, opacity: center.trim() ? 1 : 0.4 }}
            disabled={!center.trim() || loading}
            onClick={submitCenter}
          >
            {loading ? "生成中心卡片…" : "确定 →"}
          </button>
        </section>
      )}

      {/* ── COMPLETE: center card ─────────────────────────────────── */}
      {phase === "complete" && centerCard && (
        <section style={sectionStyle}>
          <h2 style={h2Style}>中心卡片</h2>
          <p style={instrStyle}>
            这张卡片会 pin 在后续所有写作页面的顶部。这是你自己说过的话。
          </p>
          <div style={centerCardStyle}>
            <p style={centerCardNameStyle}>{centerCard.center}</p>
            {centerCard.phrases.length > 0 && (
              <div>
                <p style={centerCardLabelStyle}>你说过的词</p>
                <div style={phraseBoxStyle}>
                  {centerCard.phrases.map((p, i) => (
                    <span key={i} style={phraseTagStyle}>"{p}"</span>
                  ))}
                </div>
              </div>
            )}
            {centerCard.core_question && (
              <div>
                <p style={centerCardLabelStyle}>核心问题</p>
                <p style={centerCardTextStyle}>{centerCard.core_question}</p>
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              style={primaryBtn}
              onClick={() => router.push(`/write/project/${draftId}/act`)}
            >
              定结构 →
            </button>
            <button
              style={{ ...secondaryBtn, opacity: loading ? 0.5 : 1 }}
              disabled={loading}
              onClick={beginWriting}
            >
              {loading ? "准备中…" : "直接开始写 →"}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const mainStyle: React.CSSProperties = {
  maxWidth: 680,
  margin: "0 auto",
  padding: "56px 28px 120px",
  fontFamily: "system-ui, sans-serif",
  color: "#1a1a1a",
};
const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 40,
};
const kickerStyle: React.CSSProperties = {
  fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#9b8a6b",
};
const progressStyle: React.CSSProperties = {
  display: "flex", gap: 6, alignItems: "center",
};
const progressDotStyle: React.CSSProperties = {
  width: 8, height: 8, borderRadius: "50%",
};
const sectionStyle: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: 20,
};
const h2Style: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 28, fontWeight: 400, letterSpacing: -0.5, margin: 0,
};
const instrStyle: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 16, color: "#555", lineHeight: 1.65, margin: 0,
};
const textareaStyle: React.CSSProperties = {
  width: "100%", padding: "14px 16px", fontSize: 15, lineHeight: 1.7,
  border: "1px solid #d0c8b8", borderRadius: 3, resize: "vertical",
  fontFamily: 'Georgia, "Times New Roman", serif',
  color: "#1a1a1a", background: "#fafaf8", boxSizing: "border-box",
};
const answerTextareaStyle: React.CSSProperties = {
  ...textareaStyle, rows: 4,
} as React.CSSProperties;
const primaryBtn: React.CSSProperties = {
  alignSelf: "flex-start", padding: "12px 20px", background: "#1a1a1a",
  color: "white", border: "none", borderRadius: 3, fontSize: 14,
  letterSpacing: 0.4, cursor: "pointer",
};
const secondaryBtn: React.CSSProperties = {
  alignSelf: "flex-start", padding: "12px 20px", background: "white",
  color: "#1a1a1a", border: "1px solid #1a1a1a", borderRadius: 3,
  fontSize: 14, letterSpacing: 0.4, cursor: "pointer",
};
const questionPreviewStyle: React.CSSProperties = {
  padding: "16px 18px", background: "#fafaf8", border: "1px solid #e8e3d8",
  borderRadius: 3,
};
const angleTagStyle: React.CSSProperties = {
  fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase",
  color: "#9b8a6b", margin: "0 0 6px",
};
const questionTextStyle: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 16, lineHeight: 1.6, margin: 0,
};
const openerStyle: React.CSSProperties = {
  fontSize: 13, color: "#8a7a55", fontStyle: "italic",
  lineHeight: 1.55, margin: "0 0 4px 0",
};
const phraseBoxStyle: React.CSSProperties = {
  display: "flex", flexWrap: "wrap", gap: 8, margin: "8px 0",
};
const phraseTagStyle: React.CSSProperties = {
  padding: "4px 10px", background: "#f5f0e8", border: "1px solid #d0c8b8",
  borderRadius: 2, fontSize: 14,
  fontFamily: 'Georgia, "Times New Roman", serif',
};
const synthesisMessageStyle: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 17, lineHeight: 1.7, color: "#1a1a1a",
  padding: "20px 22px", background: "#fafaf8", border: "1px solid #e8e3d8",
  borderRadius: 3,
};
const centerInputStyle: React.CSSProperties = {
  width: "100%", padding: "14px 16px", fontSize: 18,
  fontFamily: 'Georgia, "Times New Roman", serif',
  border: "1px solid #d0c8b8", borderRadius: 3, boxSizing: "border-box",
};
const centerCardStyle: React.CSSProperties = {
  padding: "24px 26px", background: "#1a1a1a", color: "white",
  borderRadius: 4, display: "flex", flexDirection: "column", gap: 20,
};
const centerCardNameStyle: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 26, fontWeight: 400, margin: 0,
};
const centerCardLabelStyle: React.CSSProperties = {
  fontSize: 10, letterSpacing: 2, textTransform: "uppercase",
  color: "#9b8a6b", margin: "0 0 8px",
};
const centerCardTextStyle: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 15, lineHeight: 1.65, margin: 0, opacity: 0.9,
};
const errorStyle: React.CSSProperties = {
  color: "#b91c1c", fontSize: 13, padding: "10px 14px",
  background: "#fff5f5", border: "1px solid #fca5a5", borderRadius: 3,
};

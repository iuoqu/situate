"use client";

import { useState } from "react";

import type { CoachFinding } from "@/app/api/drafts/[id]/coach/route";

/**
 * CoachingPulse — B.5.
 *
 * Surfaces the single highest-leverage coaching finding for a draft.
 * Distinct from InlineAIPanel (which shows all diagnoser results):
 * this shows one observation + one Socratic question, with a dismiss.
 *
 * Usage:
 *   <CoachingPulse draftId={draftId} text={fullText} />
 */

interface Props {
  draftId: string;
  text: string;
  sectionId?: string;
  minLength?: number;
}

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; finding: CoachFinding | null }
  | { status: "dismissed" }
  | { status: "error"; message: string };

const SEVERITY_LABEL: Record<number, string> = {
  9: "核心结构",
  7: "因果骨架",
  6: "地点弧光",
  5: "意识承担",
  4: "因果脉络",
  3: "地点 / 经济",
};

function severityLabel(score: number): string {
  return SEVERITY_LABEL[score] ?? "结构反馈";
}

const pulseButtonStyle: React.CSSProperties = {
  fontFamily: "system-ui, sans-serif",
  fontSize: 11,
  textTransform: "uppercase" as const,
  letterSpacing: 1.5,
  color: "#9b8a6b",
  background: "none",
  border: "1px solid #e8e3d8",
  borderRadius: 2,
  padding: "5px 12px",
  cursor: "pointer",
};

const cardStyle: React.CSSProperties = {
  border: "1px solid #e8e3d8",
  borderLeft: "3px solid #c8a96b",
  borderRadius: 2,
  padding: "16px 20px",
  marginTop: 16,
  background: "#fdfbf7",
};

const labelStyle: React.CSSProperties = {
  fontFamily: "system-ui, sans-serif",
  fontSize: 10,
  textTransform: "uppercase" as const,
  letterSpacing: 1.5,
  color: "#9b8a6b",
  marginBottom: 10,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const observationStyle: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.7,
  color: "#2a2a2a",
  marginBottom: 12,
};

const questionStyle: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.7,
  color: "#7a5c2e",
  fontStyle: "italic",
  borderLeft: "2px solid #e8c87b",
  paddingLeft: 12,
  margin: 0,
};

const dismissStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: 11,
  color: "#bbb",
  fontFamily: "system-ui, sans-serif",
  padding: 0,
};

export function CoachingPulse({ draftId, text, sectionId, minLength = 200 }: Props) {
  const [state, setState] = useState<State>({ status: "idle" });

  if (text.trim().length < minLength) return null;
  if (state.status === "dismissed") return null;

  async function run() {
    setState({ status: "loading" });
    try {
      const res = await fetch(`/api/drafts/${draftId}/coach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, sectionId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as Record<string, unknown>;
        setState({ status: "error", message: String(err.error ?? "请求失败") });
        return;
      }
      const data = await res.json() as { finding: CoachFinding | null };
      setState({ status: "done", finding: data.finding });
    } catch (e) {
      setState({ status: "error", message: e instanceof Error ? e.message : "网络错误" });
    }
  }

  if (state.status === "idle") {
    return (
      <button style={pulseButtonStyle} onClick={run}>
        结构脉冲
      </button>
    );
  }

  if (state.status === "loading") {
    return (
      <span style={{ ...pulseButtonStyle, opacity: 0.5, cursor: "default", border: "none", padding: 0 }}>
        分析中…
      </span>
    );
  }

  if (state.status === "error") {
    return (
      <span style={{ fontSize: 12, color: "#c00", fontFamily: "system-ui, sans-serif" }}>
        {state.message}
      </span>
    );
  }

  if (state.status === "done") {
    if (!state.finding) {
      return (
        <span style={{ fontSize: 12, color: "#888", fontFamily: "system-ui, sans-serif" }}>
          结构完整，没有发现需要关注的问题。
        </span>
      );
    }
    const { finding } = state;
    return (
      <div style={cardStyle}>
        <div style={labelStyle}>
          <span>{severityLabel(finding.severityScore)}</span>
          <button
            style={dismissStyle}
            onClick={() => setState({ status: "dismissed" })}
            title="忽略"
          >
            忽略
          </button>
        </div>
        <p style={observationStyle}>{finding.observation}</p>
        <p style={questionStyle}>{finding.socraticQuestion}</p>
      </div>
    );
  }

  return null;
}

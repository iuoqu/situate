"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { CoachFinding } from "@/app/api/drafts/[id]/coach/route";

/**
 * CoachingPulse — B.5.
 *
 * On mount: fetches the latest unacknowledged surfaced event from the
 * DB (GET /api/drafts/[id]/coach). This restores state across page
 * reloads without re-running the LLM.
 *
 * On dismiss: PATCHes the event to authorResponse="acknowledged" so
 * it doesn't resurface.
 *
 * Re-run prompt: when the author edits ≥100 words beyond the last run,
 * a "重新分析" prompt appears.
 */

interface Props {
  draftId: string;
  text: string;
  sectionId?: string;
  minLength?: number;
}

type State =
  | { status: "booting" }
  | { status: "idle" }
  | { status: "running" }
  | { status: "done"; finding: CoachFinding; wordCountAtRun: number }
  | { status: "clean"; wordCountAtRun: number }
  | { status: "dismissed"; wordCountAtRun: number }
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

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
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

const rerunHintStyle: React.CSSProperties = {
  fontFamily: "system-ui, sans-serif",
  fontSize: 11,
  color: "#9b8a6b",
  marginTop: 8,
  display: "flex",
  alignItems: "center",
  gap: 8,
};

export function CoachingPulse({ draftId, text, sectionId, minLength = 200 }: Props) {
  const [state, setState] = useState<State>({ status: "booting" });
  const mountedRef = useRef(true);

  const wc = useMemo(() => wordCount(text), [text]);

  // On mount: fetch any existing unacknowledged event
  useEffect(() => {
    mountedRef.current = true;
    if (text.trim().length < minLength) {
      setState({ status: "idle" });
      return;
    }
    fetch(`/api/drafts/${draftId}/coach`)
      .then((r) => r.json())
      .then((data: { finding: CoachFinding | null }) => {
        if (!mountedRef.current) return;
        if (data.finding) {
          setState({ status: "done", finding: data.finding, wordCountAtRun: wc });
        } else {
          setState({ status: "idle" });
        }
      })
      .catch(() => {
        if (mountedRef.current) setState({ status: "idle" });
      });
    return () => { mountedRef.current = false; };
    // Only run on mount — draftId doesn't change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId]);

  if (text.trim().length < minLength) return null;

  async function run() {
    setState({ status: "running" });
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
      if (data.finding) {
        setState({ status: "done", finding: data.finding, wordCountAtRun: wc });
      } else {
        setState({ status: "clean", wordCountAtRun: wc });
      }
    } catch (e) {
      setState({ status: "error", message: e instanceof Error ? e.message : "网络错误" });
    }
  }

  async function dismiss(eventId: string) {
    setState((prev) => {
      const wcr = prev.status === "done" ? prev.wordCountAtRun : wc;
      return { status: "dismissed", wordCountAtRun: wcr };
    });
    await fetch(`/api/drafts/${draftId}/coach`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId }),
    }).catch(() => {});
  }

  // Re-run prompt: significant edits after a previous run
  const showRerun =
    (state.status === "done" || state.status === "clean" || state.status === "dismissed") &&
    Math.abs(wc - state.wordCountAtRun) >= 100;

  if (state.status === "booting") return null;

  if (state.status === "idle") {
    return (
      <button style={pulseButtonStyle} onClick={run}>
        结构脉冲
      </button>
    );
  }

  if (state.status === "running") {
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
        {" "}
        <button style={{ ...dismissStyle, color: "#c00" }} onClick={run}>重试</button>
      </span>
    );
  }

  if (state.status === "clean") {
    return (
      <div>
        <span style={{ fontSize: 12, color: "#888", fontFamily: "system-ui, sans-serif" }}>
          结构完整，没有发现需要关注的问题。
        </span>
        {showRerun && (
          <div style={rerunHintStyle}>
            <span>已有较多新内容 —</span>
            <button style={pulseButtonStyle} onClick={run}>重新分析</button>
          </div>
        )}
      </div>
    );
  }

  if (state.status === "dismissed") {
    if (!showRerun) return null;
    return (
      <div style={rerunHintStyle}>
        <span>已有较多新内容 —</span>
        <button style={pulseButtonStyle} onClick={run}>重新分析</button>
      </div>
    );
  }

  if (state.status === "done") {
    const { finding } = state;
    return (
      <div>
        <div style={cardStyle}>
          <div style={labelStyle}>
            <span>{severityLabel(finding.severityScore)}</span>
            <button
              style={dismissStyle}
              onClick={() => dismiss(finding.eventId)}
              title="忽略"
            >
              忽略
            </button>
          </div>
          <p style={observationStyle}>{finding.observation}</p>
          <p style={questionStyle}>{finding.socraticQuestion}</p>
        </div>
        {showRerun && (
          <div style={rerunHintStyle}>
            <span>已有较多新内容 —</span>
            <button style={pulseButtonStyle} onClick={run}>重新分析</button>
          </div>
        )}
      </div>
    );
  }

  return null;
}

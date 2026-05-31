"use client";

import { useState } from "react";
import type {
  VitalityResult,
  VitalitySignal,
} from "@/lib/coach/meta/vitality";

/**
 * Traffic-light vitality badge. Renders the meta-aggregation from
 * `computeVitality`. No LLM call here — pure render of pre-computed
 * signals.
 *
 * Used in:
 *   - guided/mirror stage (top of the observations panel)
 *   - inline-ai-panel (optional, after observations)
 *   - review page (optional)
 */
export function VitalityBadge({ result }: { result: VitalityResult }) {
  const [open, setOpen] = useState(false);

  const palette = {
    vital: { bg: "#f3f7ed", border: "#5e8a4a", glyph: "✓", label: "有活力" },
    borderline: {
      bg: "#faf5e9",
      border: "#a07a30",
      glyph: "◐",
      label: "边缘",
    },
    flat: { bg: "#faf0e9", border: "#a04040", glyph: "✗", label: "活力不足" },
  } as const;
  const p = palette[result.verdict];

  return (
    <div
      style={{
        background: p.bg,
        borderLeft: `3px solid ${p.border}`,
        padding: "12px 14px",
        borderRadius: 3,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
        }}
      >
        <span
          style={{
            color: p.border,
            fontWeight: 700,
            fontSize: 18,
            lineHeight: 1.4,
            minWidth: 18,
          }}
        >
          {p.glyph}
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
            故事活力预测 · {p.label}
          </div>
          <div
            style={{
              fontSize: 14,
              color: "#1a1a1a",
              lineHeight: 1.6,
              fontFamily: 'Georgia, "Times New Roman", serif',
            }}
          >
            {result.summary}
          </div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            style={{
              marginTop: 8,
              fontSize: 12,
              color: p.border,
              background: "transparent",
              border: `1px solid ${p.border}`,
              borderRadius: 2,
              padding: "3px 8px",
              cursor: "pointer",
            }}
          >
            {open ? "收起 5 项指标" : "看 5 项指标明细"}
          </button>
          {open && (
            <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
              {result.signals.map((s) => (
                <SignalRow key={s.id} signal={s} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SignalRow({ signal: s }: { signal: VitalitySignal }) {
  const glyph =
    s.state === true ? "✓" : s.state === false ? "✗" : "·";
  const color =
    s.state === true
      ? "#5e8a4a"
      : s.state === false
        ? "#a04040"
        : "#888";
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #ece6da",
        borderRadius: 2,
        padding: "8px 10px",
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
        <span style={{ color, fontWeight: 700, minWidth: 14 }}>{glyph}</span>
        <span style={{ fontWeight: 600, color: "#1a1a1a" }}>{s.label}</span>
        <span style={{ color: "#666", fontSize: 12 }}>{s.reason}</span>
      </div>
      {s.suggestion && s.state === false && (
        <div
          style={{
            marginTop: 4,
            paddingLeft: 22,
            fontSize: 12,
            color: "#555",
            fontStyle: "italic",
          }}
        >
          → {s.suggestion}
        </div>
      )}
    </div>
  );
}

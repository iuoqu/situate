"use client";

import type { LayObservation } from "@/lib/coach/lay-translator";

/**
 * Shared rendering for the bank's lay-translated observations.
 *
 * Used by /write/guided's mirror stage, template editor's inline
 * AI button, and review's user-facing AI button.
 *
 * Each observation gets a colored left border and an emoji marker:
 *   ✓ working   (green)   — what's already on the page
 *   ✗ missing   (red)     — what readers can't find
 *   ○ consider  (amber)   — a pattern worth noticing
 *   ⚠ projection (slate)  — AI's speculation beyond text
 */
export function ObservationList({
  observations,
}: {
  observations: LayObservation[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {observations.map((o, i) => (
        <ObservationBox key={i} observation={o} />
      ))}
    </div>
  );
}

function ObservationBox({ observation: o }: { observation: LayObservation }) {
  const palette: Record<
    LayObservation["kind"],
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

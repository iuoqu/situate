"use client";

import { useState } from "react";
import type {
  VitalityResult,
  ReadinessSignal,
} from "@/lib/coach/meta/vitality";

/**
 * Readiness signals badge. Renders the meta-aggregation from
 * `computeVitality`. Per METHODOLOGY v2.0:
 *
 *   §3 Aggregation ≠ verdict: this is aggregation. NO verdict label,
 *     NO traffic-light palette, NO good/bad aesthetic.
 *   §3.4 + §13: no aesthetic ranking, no praise.
 *   §14: aggregation as copilot view is permitted; the writer reads
 *     the signal counts as part of their own judgment.
 *
 * Single neutral panel; per-signal rows with √/✗/· glyphs (informational,
 * not aesthetic). No verdict, no overall color, no summary label like
 * "vital" or "flat".
 */
export function VitalityBadge({ result }: { result: VitalityResult }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        background: "#fbfaf6",
        border: "1px solid #e0d8c4",
        borderRadius: 3,
        padding: "12px 14px",
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 10,
              color: "#7a6940",
              fontWeight: 700,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              marginBottom: 3,
            }}
          >
            结构信号报告
          </div>
          <div
            style={{
              fontSize: 13,
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
              color: "#7a6940",
              background: "transparent",
              border: "1px solid #c2b594",
              borderRadius: 2,
              padding: "3px 8px",
              cursor: "pointer",
            }}
          >
            {open ? "收起信号明细" : `查看 ${result.signals.length} 项信号明细`}
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

function SignalRow({ signal: s }: { signal: ReadinessSignal }) {
  // Glyphs are informational status markers, not value judgments.
  // ✓ = signal is firing, ✗ = signal is not firing, · = not evaluated
  const glyph = s.state === true ? "✓" : s.state === false ? "✗" : "·";
  const glyphColor =
    s.state === true
      ? "#5e8a4a"
      : s.state === false
        ? "#7a6940"
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
        <span style={{ color: glyphColor, fontWeight: 700, minWidth: 14 }}>
          {glyph}
        </span>
        <span style={{ fontWeight: 600, color: "#1a1a1a" }}>{s.label}</span>
        <span style={{ color: "#666", fontSize: 12 }}>{s.fact}</span>
      </div>
    </div>
  );
}

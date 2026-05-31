"use client";

import { useState } from "react";

import {
  type PreviewResponse,
  translateBankToLay,
} from "@/lib/coach/lay-translator";
import { computeVitality } from "@/lib/coach/meta/vitality";

import { ObservationList } from "./observation-list";
import { VitalityBadge } from "./vitality-badge";

/**
 * InlineAIPanel — drop-in coach feedback widget.
 *
 * Takes a `text` (assembled prose) and an optional `intent` block,
 * exposes a "Let AI read this" button, and renders the bank's
 * lay-translated observations inline below the button when complete.
 *
 * Used in template-editor (per-draft button below the section list)
 * and review-client (replaces the staff-only hand-off for general
 * users). The component is staff-agnostic — it calls /api/coach/diagnose
 * which auths via the user's Supabase session.
 */

const TARGET_PROVIDERS = [
  "anthropic:claude-sonnet-4-6",
  "anthropic:claude-opus-4-7",
  "deepseek:deepseek-chat",
  "alibaba:qwen3-max",
];

const DEFAULT_DIAGNOSER_IDS = [
  "stakes_absent",
  "causal_spine",
  "economy",
  "inferred_intent",
  "center_consensus",
  "place_arc",
  "the_turn",
];

export function InlineAIPanel({
  text,
  intent,
  minWords = 100,
  showLabel = "🪞 让 AI 读这一段",
  runningLabel = "AI 正在读……",
  hint,
}: {
  /** The assembled prose to diagnose. */
  text: string;
  /** Optional intent block (K / 设定 / 转变 / backstory). */
  intent?: string;
  /** Minimum word count below which the button is disabled. */
  minWords?: number;
  showLabel?: string;
  runningLabel?: string;
  hint?: string;
}) {
  const [response, setResponse] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wordCount = countWords(text);
  const canRun = !loading && wordCount >= minWords;

  async function run() {
    setError(null);
    setLoading(true);
    try {
      const diagnoserIds = intent?.trim()
        ? [...DEFAULT_DIAGNOSER_IDS, "intent_realization", "character_consistency"]
        : DEFAULT_DIAGNOSER_IDS;
      const resp = await fetch("/api/coach/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          providers: TARGET_PROVIDERS,
          diagnoser_ids: diagnoserIds,
          ...(intent?.trim() ? { intent: intent.trim() } : {}),
        }),
        credentials: "same-origin",
      });
      if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${body.slice(0, 200)}`);
      }
      const data = (await resp.json()) as PreviewResponse;
      setResponse(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const observations = response ? translateBankToLay(response) : null;
  const vitality = response
    ? computeVitality(response, intent?.trim() || undefined)
    : null;

  return (
    <section
      style={{
        padding: 16,
        background: "#fbfaf6",
        border: "1px dashed #c0b495",
        borderRadius: 5,
        margin: "18px 0",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <strong style={{ fontSize: 14, color: "#5a4810" }}>
          🪞 AI 读读看
        </strong>
        <span style={{ fontSize: 12, color: "#888" }}>
          {hint ??
            "看 4 个 AI 读者从你的文字里读到什么——支点、subtext、遗漏。"}
        </span>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center" }}>
        <button
          onClick={run}
          disabled={!canRun}
          style={canRun ? btnPrimary : btnPrimaryDisabled}
          aria-busy={loading}
        >
          {loading ? runningLabel : showLabel}
        </button>
        <span style={{ fontSize: 12, color: "#999" }}>
          约 60-90 秒 · 当前 {wordCount} 字
          {wordCount < minWords && ` (至少 ${minWords} 字)`}
        </span>
      </div>

      {error && (
        <div
          style={{
            marginTop: 10,
            padding: 10,
            background: "#fde8e8",
            border: "1px solid #d4a0a0",
            borderRadius: 3,
            fontSize: 13,
            color: "#7a2020",
          }}
        >
          {error}
        </div>
      )}

      {vitality && (
        <div style={{ marginTop: 14 }}>
          <VitalityBadge result={vitality} />
        </div>
      )}

      {observations && (
        <div style={{ marginTop: 14 }}>
          <ObservationList observations={observations} />
        </div>
      )}
    </section>
  );
}

function countWords(s: string): number {
  const trimmed = s.trim();
  if (!trimmed) return 0;
  const latin = trimmed.split(/\s+/).filter((w) => /[A-Za-zÀ-ÿ]/.test(w)).length;
  const cjk = (trimmed.match(/[一-鿿぀-ヿ가-힯]/g) ?? []).length;
  return latin + cjk;
}

const btnPrimary: React.CSSProperties = {
  padding: "9px 16px",
  background: "#8a6d20",
  color: "white",
  border: "none",
  borderRadius: 3,
  fontSize: 13,
  letterSpacing: 0.3,
  cursor: "pointer",
};
const btnPrimaryDisabled: React.CSSProperties = {
  ...btnPrimary,
  background: "#bbb",
  cursor: "not-allowed",
};

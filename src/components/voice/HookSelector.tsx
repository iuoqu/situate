"use client";

import type { PromptSuggestionHook } from "@/app/api/prompt-suggestions/route";

/**
 * HookSelector — render 5 AI-generated story hooks + an "I'll write my own"
 * option. Designed as a pure display component so it can be reused by:
 *
 *   - the existing `/submit` text form (free-tier hook surface)
 *   - the upcoming Week-0 `EntryChoice` voice flow
 *   - `/demo/voice` for development testing
 *
 * The parent owns the fetch lifecycle (loading / error / hooks state) and
 * decides what happens when a hook is picked — `HookSelector` just emits.
 */

export interface HookSelectorLabels {
  kicker?: string; // header kicker, e.g. "Five possible angles"
  hint?: string; // short hint under the header
  writeOwn?: string; // escape-hatch button text
  loadingText?: string;
}

export interface HookSelectorProps {
  hooks: PromptSuggestionHook[];
  loading?: boolean;
  error?: string | null;
  onSelect: (hook: PromptSuggestionHook) => void;
  onWriteOwn?: () => void;
  /** Hide "I'll write my own" — useful when the host UI already has its own escape hatch. */
  hideWriteOwn?: boolean;
  labels?: HookSelectorLabels;
}

const DEFAULT_LABELS: Required<HookSelectorLabels> = {
  kicker: "Five possible angles",
  hint: "Pick one to seed your draft — or write something else entirely.",
  writeOwn: "I’ll write my own.",
  loadingText: "Generating five ideas from your pin(s)…",
};

export function HookSelector({
  hooks,
  loading = false,
  error = null,
  onSelect,
  onWriteOwn,
  hideWriteOwn = false,
  labels,
}: HookSelectorProps) {
  const L = { ...DEFAULT_LABELS, ...labels };

  if (loading) {
    return (
      <div style={shellStyle}>
        <p style={statusStyle}>{L.loadingText}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={shellStyle}>
        <p style={errorStyle}>{error}</p>
      </div>
    );
  }

  if (hooks.length === 0) {
    return null;
  }

  return (
    <div style={shellStyle}>
      <header style={headerStyle}>
        <span style={kickerStyle}>{L.kicker}</span>
        <span style={hintStyle}>{L.hint}</span>
      </header>
      <ol style={listStyle}>
        {hooks.map((hook, idx) => (
          <li key={idx} style={itemStyle}>
            <button
              type="button"
              onClick={() => onSelect(hook)}
              style={hookButtonStyle}
            >
              <div style={ordinalStyle}>
                {String(idx + 1).padStart(2, "0")}
              </div>
              <div style={hookBodyStyle}>
                <div style={titleStyle}>{hook.title}</div>
                <div style={premiseStyle}>{hook.premise}</div>
              </div>
            </button>
          </li>
        ))}
      </ol>
      {!hideWriteOwn && onWriteOwn && (
        <button
          type="button"
          onClick={onWriteOwn}
          style={writeOwnButtonStyle}
        >
          {L.writeOwn}
        </button>
      )}
    </div>
  );
}

const shellStyle: React.CSSProperties = {
  border: "1px solid #e8e3d8",
  borderRadius: 4,
  padding: 20,
  background: "#fbfaf6",
  display: "flex",
  flexDirection: "column",
  gap: 14,
  fontFamily: "system-ui, sans-serif",
  color: "#1a1a1a",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const kickerStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: 1.5,
  textTransform: "uppercase",
  color: "#9b8a6b",
};

const hintStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#666",
  lineHeight: 1.5,
};

const listStyle: React.CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const itemStyle: React.CSSProperties = {
  margin: 0,
};

const hookButtonStyle: React.CSSProperties = {
  display: "flex",
  gap: 14,
  alignItems: "flex-start",
  width: "100%",
  textAlign: "left",
  padding: 14,
  background: "white",
  border: "1px solid #e8e3d8",
  borderRadius: 3,
  cursor: "pointer",
  fontFamily: "inherit",
  color: "inherit",
  transition: "border-color 120ms ease, box-shadow 120ms ease",
};

const ordinalStyle: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 18,
  color: "#9b8a6b",
  letterSpacing: -0.4,
  paddingTop: 2,
  minWidth: 28,
};

const hookBodyStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  flex: 1,
};

const titleStyle: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 17,
  fontWeight: 400,
  letterSpacing: -0.2,
};

const premiseStyle: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 14,
  color: "#555",
  lineHeight: 1.55,
};

const writeOwnButtonStyle: React.CSSProperties = {
  alignSelf: "flex-start",
  padding: "8px 12px",
  background: "transparent",
  border: "none",
  color: "#666",
  fontSize: 12,
  letterSpacing: 0.4,
  textDecoration: "underline",
  cursor: "pointer",
};

const statusStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: "#666",
  fontStyle: "italic",
};

const errorStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: "#7f1d1d",
  background: "#fce9e9",
  padding: 10,
  borderRadius: 3,
};

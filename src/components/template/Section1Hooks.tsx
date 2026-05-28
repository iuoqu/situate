"use client";

import { useState } from "react";

import type {
  PromptSuggestionHook,
  PromptSuggestionsRequest,
  PromptSuggestionsResponse,
} from "@/app/api/prompt-suggestions/route";
import { HookSelector } from "@/components/voice/HookSelector";
import type { SupportedLanguage } from "@/db/schema";

/**
 * Section1Hooks — AI-hook generator embedded in Section 1 (Arrival)
 * of the template editor.
 *
 * Hooks need a coordinate to be useful (the model writes situated
 * premises). This component only renders its "Get 5 angles" button
 * when Section 1 has its own location set. The parent passes the
 * coord in; on pick, the parent receives the hook and decides what
 * to do (the template-editor appends the premise to the textarea as
 * a starter prompt).
 *
 * No state lives in the draft for "which hook was picked" — once the
 * user starts editing the textarea the hook is just text like
 * anything else. Authors are encouraged to delete the premise lines
 * once they've used them as scaffolding.
 */

export interface Section1HooksProps {
  longitude: number;
  latitude: number;
  language: SupportedLanguage;
  onPick: (hook: PromptSuggestionHook) => void;
}

export function Section1Hooks({
  longitude,
  latitude,
  language,
  onPick,
}: Section1HooksProps) {
  const [open, setOpen] = useState(false);
  const [hooks, setHooks] = useState<PromptSuggestionHook[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setOpen(true);
    setLoading(true);
    setError(null);
    setHooks([]);
    try {
      const body: PromptSuggestionsRequest = {
        coordinates: [{ longitude, latitude }],
        language,
      };
      const res = await fetch("/api/prompt-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Hook generator returned ${res.status}`);
      }
      const data = (await res.json()) as PromptSuggestionsResponse;
      setHooks(data.hooks ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't generate hooks");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={generate} style={triggerButtonStyle}>
        ✨ Need an idea? Get 5 angles for this place →
      </button>
    );
  }

  return (
    <div style={panelStyle}>
      <HookSelector
        hooks={hooks}
        loading={loading}
        error={error}
        onSelect={(hook) => {
          onPick(hook);
          setOpen(false);
        }}
        hideWriteOwn
        labels={{
          kicker: "Five possible angles",
          hint:
            "Pick one to seed your Arrival prompt — or close this and write something else.",
        }}
      />
      <button
        type="button"
        onClick={() => setOpen(false)}
        style={dismissButtonStyle}
      >
        Close, I&rsquo;ll write my own.
      </button>
    </div>
  );
}

const triggerButtonStyle: React.CSSProperties = {
  alignSelf: "flex-start",
  padding: "10px 14px",
  background: "#fef3c7",
  color: "#92400e",
  border: "1px solid #d97706",
  borderRadius: 3,
  fontSize: 13,
  letterSpacing: 0.3,
  cursor: "pointer",
  fontFamily: "inherit",
};
const panelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
};
const dismissButtonStyle: React.CSSProperties = {
  alignSelf: "flex-start",
  background: "transparent",
  border: "none",
  color: "#666",
  fontSize: 12,
  letterSpacing: 0.3,
  cursor: "pointer",
  textDecoration: "underline",
  padding: 0,
};

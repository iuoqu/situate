"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Section1Hooks } from "@/components/template/Section1Hooks";
import { SectionLocationPicker } from "@/components/template/SectionLocationPicker";
import type { DraftSection, SupportedLanguage } from "@/db/schema";

/**
 * TemplateEditor — the multi-section guided write surface (Year 1
 * default for free-tier authors).
 *
 * Layout:
 *
 *   [ title field, full-width ]
 *
 *   [01. Section label              save status indicator ]
 *   [    prompt — italic editorial copy                   ]
 *   [    textarea (autosizes by row count)                ]
 *   [    word count · suggested range                     ]
 *
 *   [02. ... ]
 *   [05. ... ]
 *
 *   [ "Save and exit" link · "Continue" → disclosure (future) ]
 *
 * Auto-save:
 *   - Every change debounces a 600ms timer.
 *   - On timer fire, PATCH /api/drafts/[id] with the diffed fields only.
 *   - Status indicator shows: idle / saving… / saved · {seconds ago} /
 *     error (retry).
 *   - LocalStorage mirror is the "you didn't lose anything" net: every
 *     section.content is written into localStorage under the draft id
 *     synchronously on every keystroke. If the network save 500s and
 *     the user reloads, the page seeds from localStorage when it's
 *     newer than what the server returned.
 *
 * No Mapbox here yet — the per-section MultiLocationPicker lands in a
 * later commit. Section locations remain null for now; submission
 * handoff (Week 5) will require at least Section 1 to have a coordinate.
 */

interface TemplateSectionView {
  id: string;
  label: string;
  prompt: string;
  wordRangeMin: number;
  wordRangeMax: number;
  canHaveOwnLocation: boolean;
  showHookSelector: boolean;
}

interface TemplateView {
  id: string;
  name: string;
  description: string;
  sections: TemplateSectionView[];
}

interface Props {
  draftId: string;
  template: TemplateView;
  initialTitle: string;
  initialSections: DraftSection[];
  language: SupportedLanguage;
}

type SaveState = "idle" | "saving" | "saved" | "error";

const AUTOSAVE_DEBOUNCE_MS = 600;
const STATUS_RESET_MS = 2400;

function localKey(draftId: string) {
  return `situate.draft.${draftId}`;
}

export function TemplateEditor({
  draftId,
  template,
  initialTitle,
  initialSections,
  language,
}: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [sections, setSections] = useState<DraftSection[]>(initialSections);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  // On first mount, see if localStorage has unsaved changes newer than the
  // server-rendered initial state. If so, seed from local — we never want
  // the user to feel like they lost typing because of a transient network
  // failure.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(localKey(draftId));
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        title?: string;
        sections?: DraftSection[];
        ts?: number;
      };
      if (!parsed.ts) return;
      // Server's "fresh draft" baseline has empty sections; if local has
      // anything in it, prefer local. (For an already-edited draft this
      // could conflict with another tab's writes — small audience for
      // now, accept the corner case.)
      const localHasContent =
        (parsed.title && parsed.title.length > 0) ||
        (parsed.sections?.some((s) => s.content.length > 0) ?? false);
      if (localHasContent) {
        if (parsed.title !== undefined) setTitle(parsed.title);
        if (parsed.sections) {
          // Reconcile by section_id so a template revision doesn't lose
          // typed content from removed sections.
          setSections((prev) =>
            prev.map((s) => {
              const localMatch = parsed.sections!.find(
                (l) => l.section_id === s.section_id,
              );
              return localMatch ? { ...s, content: localMatch.content } : s;
            }),
          );
        }
      }
    } catch {
      // Corrupt JSON; ignore.
    }
  }, [draftId]);

  // Mirror to localStorage on every change (synchronous, cheap).
  useEffect(() => {
    try {
      window.localStorage.setItem(
        localKey(draftId),
        JSON.stringify({ title, sections, ts: Date.now() }),
      );
    } catch {
      // Quota / safe-mode: ignore. We still have the server save.
    }
  }, [draftId, title, sections]);

  // Debounced server save.
  const saveTimerRef = useRef<number | null>(null);
  const statusResetTimerRef = useRef<number | null>(null);

  const flushSave = useCallback(
    async (next: { title: string; sections: DraftSection[] }) => {
      setSaveState("saving");
      setErrorText(null);
      try {
        const res = await fetch(`/api/drafts/${draftId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: next.title.trim(),
            sections: next.sections,
          }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? "save failed");
        }
        setSaveState("saved");
        setLastSavedAt(Date.now());
        // After a short delay, drop back to "idle" so the indicator
        // doesn't permanently shout "saved" once everything is calm.
        if (statusResetTimerRef.current)
          window.clearTimeout(statusResetTimerRef.current);
        statusResetTimerRef.current = window.setTimeout(
          () => setSaveState("idle"),
          STATUS_RESET_MS,
        );
      } catch (err) {
        setSaveState("error");
        setErrorText(err instanceof Error ? err.message : "save failed");
      }
    },
    [draftId],
  );

  const scheduleSave = useCallback(
    (next: { title: string; sections: DraftSection[] }) => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(
        () => flushSave(next),
        AUTOSAVE_DEBOUNCE_MS,
      );
    },
    [flushSave],
  );

  // Schedule save whenever title or sections change. Initial-mount run is
  // expected to no-op against the server; that's fine — the request is
  // small and idempotent.
  const isFirstRenderRef = useRef(true);
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    scheduleSave({ title, sections });
  }, [title, sections, scheduleSave]);

  // Save on page hide (tab close, navigation away). Best-effort.
  useEffect(() => {
    function onHide() {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      const payload = JSON.stringify({
        title: title.trim(),
        sections,
      });
      try {
        // sendBeacon survives navigation. The API route accepts JSON via
        // POST, but `sendBeacon` only sends with Content-Type:
        // application/x-www-form-urlencoded or text/plain — we use a
        // Blob so it ends up as a plain-text JSON body. The server's
        // PATCH handler parses JSON regardless of content-type.
        navigator.sendBeacon?.(
          `/api/drafts/${draftId}`,
          new Blob([payload], { type: "text/plain" }),
        );
      } catch {
        // No-op; localStorage already has the data.
      }
    }
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [draftId, title, sections]);

  const updateSection = useCallback(
    (sectionId: string, patch: Partial<DraftSection>) => {
      setSections((prev) =>
        prev.map((s) =>
          s.section_id === sectionId ? { ...s, ...patch } : s,
        ),
      );
    },
    [],
  );

  // Compose word counts once per render for cheap display.
  const wordCounts = useMemo(
    () =>
      sections.reduce<Record<string, number>>((acc, s) => {
        acc[s.section_id] = countWords(s.content);
        return acc;
      }, {}),
    [sections],
  );
  const totalWords = useMemo(
    () => Object.values(wordCounts).reduce((a, b) => a + b, 0),
    [wordCounts],
  );

  // For each section, what coordinate would it inherit from "upstream"
  // if it didn't set its own? We scan backwards through prior sections
  // and pick the latest one that has its own coord. Section 1 always
  // gets NULL (nothing upstream of it).
  const inheritedCoords = useMemo(() => {
    const result: Array<
      | { longitude: number; latitude: number; placeDescription: string | null }
      | null
    > = [];
    for (let i = 0; i < sections.length; i++) {
      let inherited:
        | { longitude: number; latitude: number; placeDescription: string | null }
        | null = null;
      for (let j = i - 1; j >= 0; j--) {
        const s = sections[j];
        if (
          typeof s.longitude === "number" &&
          typeof s.latitude === "number"
        ) {
          inherited = {
            longitude: s.longitude,
            latitude: s.latitude,
            placeDescription: s.place_description ?? null,
          };
          break;
        }
      }
      result.push(inherited);
    }
    return result;
  }, [sections]);

  // Section 1's own coord drives the hook generator. We extract it once
  // here so the Hook component re-renders only when this section's pin
  // changes (not on every keystroke).
  const section1Coord = useMemo(() => {
    const first = sections[0];
    if (!first) return null;
    if (typeof first.longitude !== "number" || typeof first.latitude !== "number")
      return null;
    return { longitude: first.longitude, latitude: first.latitude };
  }, [sections]);

  return (
    <main style={mainStyle}>
      <header style={headerStyle}>
        <Link href="/write" style={backLinkStyle}>
          ← Pick a different path
        </Link>
        <p style={kickerStyle}>{template.name}</p>
        <input
          type="text"
          placeholder="Untitled story"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          style={titleInputStyle}
          aria-label="Story title"
        />
        <div style={metaRowStyle}>
          <SaveIndicator
            state={saveState}
            lastSavedAt={lastSavedAt}
            errorText={errorText}
            onRetry={() => flushSave({ title, sections })}
          />
          <span style={totalWordsStyle}>{totalWords} words total</span>
        </div>
      </header>

      <ol style={sectionListStyle}>
        {template.sections.map((sectionDef, idx) => {
          const data =
            sections.find((s) => s.section_id === sectionDef.id) ??
            sections[idx];
          const count = wordCounts[sectionDef.id] ?? 0;
          return (
            <li key={sectionDef.id} style={sectionItemStyle}>
              <header style={sectionHeaderStyle}>
                <div style={sectionOrdinalStyle}>
                  {String(idx + 1).padStart(2, "0")}
                </div>
                <div>
                  <h2 style={sectionLabelStyle}>{sectionDef.label}</h2>
                  <p style={sectionPromptStyle}>{sectionDef.prompt}</p>
                </div>
              </header>
              <SectionLocationPicker
                sectionId={sectionDef.id}
                longitude={data?.longitude ?? null}
                latitude={data?.latitude ?? null}
                placeDescription={data?.place_description ?? null}
                inheritedCoord={inheritedCoords[idx] ?? null}
                isFirstSection={idx === 0}
                onChange={(patch) =>
                  updateSection(sectionDef.id, {
                    longitude: patch.longitude,
                    latitude: patch.latitude,
                    place_description: patch.placeDescription,
                  })
                }
              />
              {idx === 0 && sectionDef.showHookSelector && section1Coord && (
                <Section1Hooks
                  longitude={section1Coord.longitude}
                  latitude={section1Coord.latitude}
                  language={language}
                  onPick={(hook) => {
                    // Prepend the hook's premise as a starter prompt
                    // (italicised in display because of the leading "> "
                    // which Markdown-style readers render as quote). We
                    // wrap with blank lines so the author can write
                    // freely below without their content getting glued
                    // to the seed.
                    const seed = `> ${hook.title}\n> ${hook.premise}\n\n`;
                    const existing = data?.content ?? "";
                    const next =
                      existing.length === 0
                        ? seed
                        : existing.startsWith(">")
                          ? // Replace previous seed if user picks again
                            seed +
                            existing.replace(/^>[^\n]*\n>[^\n]*\n+/, "")
                          : seed + existing;
                    updateSection(sectionDef.id, { content: next });
                  }}
                />
              )}
              <textarea
                value={data?.content ?? ""}
                onChange={(e) =>
                  updateSection(sectionDef.id, { content: e.target.value })
                }
                rows={6}
                style={textareaStyle}
                aria-label={`${sectionDef.label} content`}
                placeholder="Write here. Auto-saves as you go."
              />
              <div style={sectionFooterStyle}>
                <span style={wordCountStyle}>
                  {count} {count === 1 ? "word" : "words"}
                </span>
                <span style={rangeStyle}>
                  Suggested: {sectionDef.wordRangeMin}&ndash;
                  {sectionDef.wordRangeMax}
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      <footer style={footerStyle}>
        <p style={footerNoteStyle}>
          When you&rsquo;re ready, continue to review &amp; submit —
          we&rsquo;ll show the assembled draft, ask where it&rsquo;s
          set, and send it to the editorial pipeline.
        </p>
        <Link
          href={`/write/template/${draftId}/review`}
          style={
            totalWords >= 800
              ? continueButtonStyle
              : continueButtonDisabledStyle
          }
          aria-disabled={totalWords < 800}
          onClick={(e) => {
            if (totalWords < 800) e.preventDefault();
          }}
        >
          Continue to review →
        </Link>
        {totalWords < 800 && (
          <p style={continueHintStyle}>
            Need at least 800 words across all sections before you can
            submit. You have {totalWords}.
          </p>
        )}
      </footer>
    </main>
  );
}

// ── helpers / sub-components ──────────────────────────────────────────────

function SaveIndicator({
  state,
  lastSavedAt,
  errorText,
  onRetry,
}: {
  state: SaveState;
  lastSavedAt: number | null;
  errorText: string | null;
  onRetry: () => void;
}) {
  // Tick once every 10s so "saved · 23s ago" stays fresh.
  const [, force] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 10_000);
    return () => window.clearInterval(id);
  }, []);

  if (state === "saving") {
    return <span style={indicatorMutedStyle}>Saving…</span>;
  }
  if (state === "saved") {
    return <span style={indicatorOkStyle}>Saved</span>;
  }
  if (state === "error") {
    return (
      <span style={indicatorErrorStyle}>
        Save failed{errorText ? `: ${errorText}` : ""}.{" "}
        <button onClick={onRetry} style={retryButtonStyle}>
          Retry
        </button>
      </span>
    );
  }
  if (lastSavedAt) {
    const ago = Math.max(1, Math.floor((Date.now() - lastSavedAt) / 1000));
    const human =
      ago < 60
        ? `${ago}s`
        : ago < 3600
          ? `${Math.floor(ago / 60)}m`
          : `${Math.floor(ago / 3600)}h`;
    return <span style={indicatorMutedStyle}>Saved · {human} ago</span>;
  }
  return <span style={indicatorMutedStyle}>Draft loaded.</span>;
}

function countWords(s: string): number {
  const trimmed = s.trim();
  if (!trimmed) return 0;
  const latin = trimmed.split(/\s+/).filter((w) => /[A-Za-zÀ-ÿ]/.test(w)).length;
  const cjk = (trimmed.match(/[一-鿿぀-ヿ가-힯]/g) ?? []).length;
  return latin + cjk;
}

// ── styles ────────────────────────────────────────────────────────────────

const mainStyle: React.CSSProperties = {
  maxWidth: 760,
  margin: "0 auto",
  padding: "60px 28px 120px",
  fontFamily: "system-ui, sans-serif",
  color: "#1a1a1a",
};
const headerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  marginBottom: 30,
};
const backLinkStyle: React.CSSProperties = {
  fontSize: 12,
  letterSpacing: 0.5,
  color: "#666",
  textDecoration: "none",
  alignSelf: "flex-start",
};
const kickerStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: 2,
  textTransform: "uppercase",
  color: "#9b8a6b",
  margin: 0,
};
const titleInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 0",
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 38,
  fontWeight: 400,
  letterSpacing: -0.6,
  background: "transparent",
  border: "none",
  borderBottom: "1px solid #e8e3d8",
  outline: "none",
  color: "#1a1a1a",
};
const metaRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginTop: 4,
  fontSize: 12,
  color: "#888",
};
const totalWordsStyle: React.CSSProperties = {
  fontVariantNumeric: "tabular-nums",
};
const sectionListStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "flex",
  flexDirection: "column",
  gap: 36,
};
const sectionItemStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
};
const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  gap: 18,
  alignItems: "flex-start",
};
const sectionOrdinalStyle: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 20,
  color: "#9b8a6b",
  paddingTop: 2,
  minWidth: 34,
};
const sectionLabelStyle: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 24,
  fontWeight: 400,
  letterSpacing: -0.3,
  margin: 0,
};
const sectionPromptStyle: React.CSSProperties = {
  margin: "6px 0 0",
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 15,
  color: "#555",
  lineHeight: 1.6,
  fontStyle: "italic",
};
const textareaStyle: React.CSSProperties = {
  width: "100%",
  padding: 14,
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 17,
  lineHeight: 1.7,
  color: "#1a1a1a",
  background: "white",
  border: "1px solid #e8e3d8",
  borderRadius: 3,
  resize: "vertical",
  minHeight: 140,
  outline: "none",
};
const sectionFooterStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  fontSize: 11,
  letterSpacing: 0.4,
  color: "#888",
};
const wordCountStyle: React.CSSProperties = {
  fontVariantNumeric: "tabular-nums",
};
const rangeStyle: React.CSSProperties = {
  color: "#aaa",
};
const footerStyle: React.CSSProperties = {
  marginTop: 64,
  paddingTop: 18,
  borderTop: "1px solid #e8e3d8",
  display: "flex",
  flexDirection: "column",
  gap: 14,
  alignItems: "flex-start",
};
const footerNoteStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: "#888",
  lineHeight: 1.6,
};
const continueButtonStyle: React.CSSProperties = {
  padding: "12px 20px",
  background: "#1a1a1a",
  color: "white",
  border: "none",
  borderRadius: 3,
  fontSize: 14,
  letterSpacing: 0.4,
  cursor: "pointer",
  textDecoration: "none",
};
const continueButtonDisabledStyle: React.CSSProperties = {
  ...continueButtonStyle,
  background: "#c5beac",
  cursor: "not-allowed",
};
const continueHintStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: "#9b8a6b",
};
const indicatorMutedStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#888",
};
const indicatorOkStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#3a6b3a",
};
const indicatorErrorStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#7f1d1d",
};
const retryButtonStyle: React.CSSProperties = {
  marginLeft: 4,
  background: "transparent",
  border: "none",
  color: "#7f1d1d",
  textDecoration: "underline",
  cursor: "pointer",
  fontSize: 12,
};

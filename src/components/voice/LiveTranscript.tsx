"use client";

import { useEffect, useRef, useState } from "react";

import type { SuggestResponse } from "@/app/api/transcribe/suggest/route";

/**
 * LiveTranscript — Week 1 of voice-to-fiction onboarding.
 *
 * Two responsibilities:
 *
 *   1. Render the running transcript (the parent owns the string and passes
 *      it in; we just lay it out and auto-scroll).
 *
 *   2. Drive `/api/transcribe/suggest` calls. The TODO is explicit that we
 *      must not over-interrupt; we apply three client-side gates before
 *      asking the model at all:
 *
 *        - Transcript must have grown by ≥ MIN_DELTA_CHARS since the last
 *          call. No point asking again about the same prose.
 *        - At least MIN_INTERVAL_MS must have elapsed since the last call.
 *        - At least MIN_INTERRUPT_INTERVAL_MS must have elapsed since the
 *          *last surfaced* interrupt — even if the model says interrupt,
 *          we suppress it if we just interrupted.
 *
 *      The model itself is the final gate; the server prompt enforces the
 *      "only ask about who / sensory / stakes, never style" rule.
 */

export interface LiveTranscriptProps {
  transcript: string;
  /** True while the recorder is actively listening — gates the suggest loop. */
  isRecording: boolean;
  /** Whisper language hint, surfaced to the suggest call too. */
  language?: string | null;
}

interface SurfacedQuestion {
  id: string;
  text: string;
  reason: SuggestResponse["reason"];
  surfacedAt: number;
}

const MIN_DELTA_CHARS = 280; // grow this much before re-asking
const MIN_INTERVAL_MS = 25_000; // earliest cadence between calls to /suggest
const MIN_INTERRUPT_INTERVAL_MS = 75_000; // earliest cadence between surfaced interrupts
const RECENTLY_ASKED_WINDOW = 4; // pass last N questions back as "don't repeat" hint

export function LiveTranscript({
  transcript,
  isRecording,
  language = null,
}: LiveTranscriptProps) {
  const [questions, setQuestions] = useState<SurfacedQuestion[]>([]);
  const [latestReason, setLatestReason] = useState<SuggestResponse["reason"]>("none");
  const [thinking, setThinking] = useState(false);

  const lastCallAtRef = useRef(0);
  const lastInterruptAtRef = useRef(0);
  const transcriptAtLastCallRef = useRef("");
  const recentlyAskedRef = useRef<string[]>([]);
  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);
  const transcriptRef = useRef(transcript);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  // Auto-scroll the transcript panel to the bottom as new text arrives.
  useEffect(() => {
    const el = transcriptScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [transcript]);

  // Suggest loop. We poll every 8 s while recording; the actual call to
  // /api/transcribe/suggest is gated by the delta + interval rules above.
  useEffect(() => {
    if (!isRecording) return;
    let cancelled = false;

    async function tick() {
      const now = Date.now();
      const current = transcriptRef.current;
      const deltaChars = current.length - transcriptAtLastCallRef.current.length;
      const sinceLastCall = now - lastCallAtRef.current;
      if (deltaChars < MIN_DELTA_CHARS) return;
      if (sinceLastCall < MIN_INTERVAL_MS) return;
      if (current.trim().length < 200) return;

      lastCallAtRef.current = now;
      transcriptAtLastCallRef.current = current;
      setThinking(true);
      try {
        const res = await fetch("/api/transcribe/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript: current,
            language,
            recently_asked: recentlyAskedRef.current,
          }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as SuggestResponse;
        if (cancelled) return;
        setLatestReason(data.reason);
        if (data.should_interrupt && data.questions.length > 0) {
          // Suppress if we already interrupted recently.
          if (now - lastInterruptAtRef.current < MIN_INTERRUPT_INTERVAL_MS) {
            return;
          }
          lastInterruptAtRef.current = now;
          const surfaced: SurfacedQuestion[] = data.questions.map((q, i) => ({
            id: `${now}-${i}`,
            text: q,
            reason: data.reason,
            surfacedAt: now,
          }));
          setQuestions((prev) => [...prev, ...surfaced]);
          recentlyAskedRef.current = [
            ...recentlyAskedRef.current,
            ...data.questions,
          ].slice(-RECENTLY_ASKED_WINDOW);
        }
      } catch {
        // Network blip — silently skip. The recording session must not break.
      } finally {
        if (!cancelled) setThinking(false);
      }
    }

    const id = window.setInterval(tick, 8_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [isRecording, language]);

  // Reset transient state when a new recording session starts.
  useEffect(() => {
    if (isRecording) {
      transcriptAtLastCallRef.current = transcriptRef.current;
      lastCallAtRef.current = 0;
      lastInterruptAtRef.current = 0;
    }
  }, [isRecording]);

  return (
    <div style={wrapperStyle}>
      <section style={transcriptColumnStyle}>
        <header style={columnHeaderStyle}>
          <span style={columnTitleStyle}>Transcript</span>
          <span style={mutedStyle}>
            {transcript.length === 0
              ? "Nothing yet — start recording."
              : `${countWords(transcript)} words`}
          </span>
        </header>
        <div ref={transcriptScrollRef} style={transcriptBoxStyle}>
          {transcript.length === 0 ? (
            <p style={placeholderStyle}>
              Your words will appear here, ~12 seconds at a time.
            </p>
          ) : (
            <p style={transcriptTextStyle}>{transcript}</p>
          )}
        </div>
      </section>

      <aside style={sidePanelStyle}>
        <header style={columnHeaderStyle}>
          <span style={columnTitleStyle}>Quiet questions</span>
          {thinking && <span style={mutedStyle}>listening…</span>}
        </header>
        {questions.length === 0 ? (
          <p style={placeholderStyle}>
            {isRecording
              ? "No interruptions yet. Keep going — we only ask when something concrete is missing."
              : "Once you start recording, occasional one-line questions may appear here. Style suggestions never will."}
          </p>
        ) : (
          <ul style={questionListStyle}>
            {[...questions].reverse().map((q) => (
              <li key={q.id} style={questionItemStyle}>
                <div style={reasonStyle}>{labelForReason(q.reason)}</div>
                <div style={questionTextStyle}>{q.text}</div>
              </li>
            ))}
          </ul>
        )}
        {latestReason === "none" && questions.length === 0 && isRecording && (
          <p style={mutedStyle}>
            Heuristic: only nudge for missing characters, sensory anchors, or
            stakes — never style.
          </p>
        )}
      </aside>
    </div>
  );
}

function labelForReason(reason: SuggestResponse["reason"]): string {
  switch (reason) {
    case "who":
      return "WHO";
    case "sensory":
      return "SENSORY";
    case "stakes":
      return "WHY IT MATTERS";
    default:
      return "—";
  }
}

function countWords(s: string): number {
  const trimmed = s.trim();
  if (!trimmed) return 0;
  const latin = trimmed.split(/\s+/).filter((w) => /[A-Za-zÀ-ÿ]/.test(w)).length;
  const cjk = (trimmed.match(/[一-鿿぀-ヿ가-힯]/g) ?? []).length;
  return latin + cjk;
}

const wrapperStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.6fr) minmax(220px, 1fr)",
  gap: 18,
  alignItems: "stretch",
  fontFamily: "system-ui, sans-serif",
  color: "#1a1a1a",
};

const transcriptColumnStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  minHeight: 280,
};

const sidePanelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  padding: 16,
  border: "1px solid #e8e3d8",
  borderRadius: 4,
  background: "#fbfaf6",
};

const columnHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
};

const columnTitleStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: 1.5,
  textTransform: "uppercase",
  color: "#666",
};

const transcriptBoxStyle: React.CSSProperties = {
  border: "1px solid #e8e3d8",
  borderRadius: 4,
  padding: 18,
  minHeight: 240,
  maxHeight: 360,
  overflowY: "auto",
  background: "white",
};

const transcriptTextStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 17,
  lineHeight: 1.65,
  whiteSpace: "pre-wrap",
};

const placeholderStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: "#888",
  fontStyle: "italic",
  lineHeight: 1.55,
};

const mutedStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#888",
  letterSpacing: 0.3,
};

const questionListStyle: React.CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const questionItemStyle: React.CSSProperties = {
  borderLeft: "2px solid #9b8a6b",
  paddingLeft: 10,
  paddingTop: 2,
  paddingBottom: 2,
};

const reasonStyle: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: 1.5,
  textTransform: "uppercase",
  color: "#9b8a6b",
  marginBottom: 3,
};

const questionTextStyle: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 15,
  lineHeight: 1.45,
};

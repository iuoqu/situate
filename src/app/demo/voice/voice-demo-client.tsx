"use client";

import { useEffect, useState } from "react";

import { LiveTranscript } from "@/components/voice/LiveTranscript";
import {
  type RecorderState,
  VoiceRecorder,
  clearAutosave,
  loadAutosave,
} from "@/components/voice/VoiceRecorder";

const DRAFT_KEY = "demo-week1";
const LANGUAGE_OPTIONS = [
  { value: "", label: "Auto-detect" },
  { value: "en", label: "English" },
  { value: "zh", label: "中文" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
];

export function VoiceDemoClient() {
  const [transcript, setTranscript] = useState("");
  const [, setDurationSec] = useState(0);
  const [recorderState, setRecorderState] = useState<RecorderState>("idle");
  const [language, setLanguage] = useState<string>("");
  const [hydrated, setHydrated] = useState(false);

  // Restore any auto-saved draft for this key — a refresh mid-session should
  // not nuke the transcript.
  useEffect(() => {
    const saved = loadAutosave(DRAFT_KEY);
    if (saved) {
      setTranscript(saved.transcript);
      setDurationSec(saved.durationSec);
    }
    setHydrated(true);
  }, []);

  function appendChunk(text: string) {
    setTranscript((prev) => (prev ? prev + " " + text : text).replace(/\s+/g, " "));
  }

  function discardDraft() {
    const ok =
      typeof window !== "undefined"
        ? window.confirm("Discard the saved transcript? This cannot be undone.")
        : false;
    if (!ok) return;
    clearAutosave(DRAFT_KEY);
    setTranscript("");
    setDurationSec(0);
  }

  return (
    <main style={mainStyle}>
      <header style={{ marginBottom: 28 }}>
        <p style={kickerStyle}>Voice-to-fiction · Week 1 demo</p>
        <h1 style={h1Style}>Speak it.</h1>
        <p style={leadStyle}>
          Talk for five to ten minutes about a place you know. You&rsquo;ll see
          your words transcribed every twelve seconds. Occasionally a quiet
          question may appear on the right — only when something concrete is
          missing.
        </p>
      </header>

      <section style={settingsRowStyle}>
        <label style={labelStyle}>
          <span style={labelTextStyle}>Spoken language</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            disabled={recorderState === "recording" || recorderState === "paused"}
            style={selectStyle}
          >
            {LANGUAGE_OPTIONS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        {hydrated && transcript.length > 0 && (
          <button onClick={discardDraft} style={ghostButtonStyle}>
            Discard saved draft
          </button>
        )}
      </section>

      <section style={{ marginBottom: 22 }}>
        <VoiceRecorder
          draftKey={DRAFT_KEY}
          language={language || null}
          transcript={transcript}
          onTranscriptChunk={appendChunk}
          onDurationChange={setDurationSec}
          onStateChange={setRecorderState}
        />
      </section>

      <section>
        <LiveTranscript
          transcript={transcript}
          isRecording={recorderState === "recording"}
          language={language || null}
        />
      </section>

      <footer style={footerStyle}>
        <p style={mutedStyle}>
          This demo is local-only. Nothing is sent to a database; only the
          transcript text is mirrored to <code>localStorage</code> every
          30 seconds, under <code>{`situate.voice.draft.${DRAFT_KEY}`}</code>.
        </p>
      </footer>
    </main>
  );
}

const mainStyle: React.CSSProperties = {
  maxWidth: 980,
  margin: "0 auto",
  padding: "60px 28px 120px",
  fontFamily: "system-ui, sans-serif",
  color: "#1a1a1a",
};

const kickerStyle: React.CSSProperties = {
  fontFamily: "system-ui",
  fontSize: 11,
  letterSpacing: 2,
  textTransform: "uppercase",
  color: "#9b8a6b",
  margin: 0,
};

const h1Style: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 44,
  fontWeight: 400,
  letterSpacing: -0.8,
  margin: "10px 0 0",
};

const leadStyle: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 17,
  color: "#555",
  lineHeight: 1.6,
  marginTop: 12,
  maxWidth: 640,
};

const settingsRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 18,
  alignItems: "flex-end",
  flexWrap: "wrap",
  marginBottom: 18,
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 5,
};

const labelTextStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: 1.5,
  textTransform: "uppercase",
  color: "#666",
};

const selectStyle: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: 14,
  fontFamily: "inherit",
  border: "1px solid #c8c2b3",
  borderRadius: 3,
  background: "white",
  color: "#1a1a1a",
  minWidth: 180,
};

const ghostButtonStyle: React.CSSProperties = {
  padding: "8px 12px",
  background: "white",
  color: "#666",
  border: "1px solid #c8c2b3",
  borderRadius: 3,
  fontFamily: "system-ui",
  fontSize: 12,
  letterSpacing: 0.4,
  cursor: "pointer",
};

const footerStyle: React.CSSProperties = {
  marginTop: 40,
  borderTop: "1px solid #e8e3d8",
  paddingTop: 18,
};

const mutedStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#888",
  lineHeight: 1.5,
};

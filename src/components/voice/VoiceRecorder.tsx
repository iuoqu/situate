"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * VoiceRecorder — Week 1 of voice-to-fiction onboarding.
 *
 * Owns the microphone, runs a segmented `MediaRecorder` loop (stop+restart
 * every ~12 s so each segment is an independently decodable WebM/Opus blob),
 * posts each finished segment to `/api/transcribe`, and emits the returned
 * text via `onTranscriptChunk`.
 *
 * Why segment-by-restart instead of a single recording with timeslices?
 * MediaRecorder's `timeslice` parameter splits the stream into Blob frames
 * that share one moov/header — they aren't standalone files and won't decode
 * by themselves. Stopping and restarting gives us complete WebM containers
 * we can hand straight to Whisper. The audio loss at each restart boundary
 * is ~50–100 ms; acceptable for prose dictation.
 *
 * Auto-save: writes `{ transcript, durationSec, updatedAt }` to localStorage
 * under `situate.voice.draft.<draftKey>` every 30 s. Audio blobs are not
 * persisted (too large for localStorage and not useful — the transcript is
 * the artifact).
 */

export interface VoiceRecorderProps {
  /** Unique identifier so multiple drafts can coexist in localStorage. */
  draftKey: string;
  /** Whisper language hint, e.g. "en", "zh", "ja". Null = auto-detect. */
  language?: string | null;
  /** Live transcript text — owned by the parent. Used here only for auto-save. */
  transcript: string;
  /** Called with the recognised text for each finished audio segment. */
  onTranscriptChunk: (text: string) => void;
  /** Called every second with the active recording duration in seconds. */
  onDurationChange?: (sec: number) => void;
  /** Called whenever the recorder transitions between idle/recording/paused/stopped/error. */
  onStateChange?: (state: RecorderState) => void;
  /** Hard cap on recording duration. Default 10 minutes. */
  maxDurationSec?: number;
  /** Audio segment length sent to Whisper. Default 12 s. */
  segmentMs?: number;
}

export type RecorderState = "idle" | "recording" | "paused" | "stopped" | "error";

const AUTOSAVE_INTERVAL_MS = 30_000;

export function autosaveKey(draftKey: string) {
  return `situate.voice.draft.${draftKey}`;
}

export interface AutosavePayload {
  transcript: string;
  durationSec: number;
  updatedAt: string;
}

export function loadAutosave(draftKey: string): AutosavePayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(autosaveKey(draftKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AutosavePayload;
    if (
      typeof parsed?.transcript !== "string" ||
      typeof parsed?.durationSec !== "number"
    )
      return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearAutosave(draftKey: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(autosaveKey(draftKey));
}

export function VoiceRecorder({
  draftKey,
  language = null,
  transcript,
  onTranscriptChunk,
  onDurationChange,
  onStateChange,
  maxDurationSec = 600,
  segmentMs = 12_000,
}: VoiceRecorderProps) {
  const [state, setState] = useState<RecorderState>("idle");

  useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

  const [durationSec, setDurationSec] = useState(0);
  const [pendingSegments, setPendingSegments] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const segmentChunksRef = useRef<BlobPart[]>([]);
  const segmentTimerRef = useRef<number | null>(null);
  const tickerRef = useRef<number | null>(null);
  // The segment loop continues as long as `keepGoingRef.current` is true. We
  // toggle it false on pause and final stop; that way the `onstop` handler
  // knows whether to chain a new segment or wind down cleanly.
  const keepGoingRef = useRef(false);
  // Mirrors `transcript` for the auto-save interval (interval callbacks see
  // stale closures otherwise).
  const transcriptRef = useRef(transcript);
  const durationRef = useRef(0);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  // ── Duration ticker ──────────────────────────────────────────────────────

  const startTicker = useCallback(() => {
    if (tickerRef.current != null) return;
    tickerRef.current = window.setInterval(() => {
      setDurationSec((prev) => {
        const next = prev + 1;
        durationRef.current = next;
        onDurationChange?.(next);
        if (next >= maxDurationSec) {
          // Hard cap. Trigger a stop on the next tick of the event loop.
          window.setTimeout(() => stopRecording(false), 0);
        }
        return next;
      });
    }, 1000);
  }, [maxDurationSec, onDurationChange]);

  const stopTicker = useCallback(() => {
    if (tickerRef.current != null) {
      window.clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  }, []);

  // ── Segment loop ─────────────────────────────────────────────────────────

  const uploadSegment = useCallback(
    async (blob: Blob) => {
      setPendingSegments((n) => n + 1);
      try {
        const form = new FormData();
        const ext = blob.type.includes("mp4") ? "mp4" : "webm";
        form.append("audio", blob, `segment.${ext}`);
        if (language) form.append("language", language);
        const res = await fetch("/api/transcribe", {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          const detail = await res.text();
          throw new Error(`transcribe ${res.status}: ${detail.slice(0, 200)}`);
        }
        const data = (await res.json()) as { text?: string };
        const text = (data.text ?? "").trim();
        if (text) onTranscriptChunk(text);
      } catch (err) {
        // We don't surface per-segment errors fatally — a dropped segment
        // just means a missing patch of transcript. Log for the developer.
        // eslint-disable-next-line no-console
        console.warn("voice segment upload failed:", err);
      } finally {
        setPendingSegments((n) => Math.max(0, n - 1));
      }
    },
    [language, onTranscriptChunk],
  );

  const startSegment = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;

    const mimeType = pickMimeType();
    const mr = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);
    segmentChunksRef.current = [];

    mr.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        segmentChunksRef.current.push(e.data);
      }
    };

    mr.onstop = () => {
      const parts = segmentChunksRef.current;
      segmentChunksRef.current = [];
      if (parts.length > 0) {
        const blob = new Blob(parts, { type: mr.mimeType || "audio/webm" });
        if (blob.size > 0) uploadSegment(blob);
      }
      if (keepGoingRef.current) {
        // Chain the next segment. Use a microtask boundary so the previous
        // recorder finishes tearing down first.
        window.setTimeout(() => {
          if (keepGoingRef.current) startSegment();
        }, 0);
      }
    };

    mr.start();
    recorderRef.current = mr;

    // Rotate after segmentMs.
    segmentTimerRef.current = window.setTimeout(() => {
      if (recorderRef.current === mr && mr.state === "recording") {
        mr.stop();
      }
    }, segmentMs);
  }, [segmentMs, uploadSegment]);

  // ── Public actions ───────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    if (state === "recording") return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      keepGoingRef.current = true;
      setState("recording");
      startTicker();
      startSegment();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "could not access microphone";
      setError(message);
      setState("error");
    }
  }, [startSegment, startTicker, state]);

  const pauseRecording = useCallback(() => {
    if (state !== "recording") return;
    keepGoingRef.current = false;
    if (segmentTimerRef.current != null) {
      window.clearTimeout(segmentTimerRef.current);
      segmentTimerRef.current = null;
    }
    // Stop the current segment so it gets transcribed; resume will start
    // a fresh one.
    const mr = recorderRef.current;
    if (mr && mr.state === "recording") mr.stop();
    stopTicker();
    setState("paused");
  }, [state, stopTicker]);

  const resumeRecording = useCallback(() => {
    if (state !== "paused") return;
    if (!streamRef.current) return;
    keepGoingRef.current = true;
    setState("recording");
    startTicker();
    startSegment();
  }, [startSegment, startTicker, state]);

  const stopRecording = useCallback(
    (manual: boolean) => {
      keepGoingRef.current = false;
      if (segmentTimerRef.current != null) {
        window.clearTimeout(segmentTimerRef.current);
        segmentTimerRef.current = null;
      }
      const mr = recorderRef.current;
      if (mr && (mr.state === "recording" || mr.state === "paused")) {
        mr.stop();
      }
      recorderRef.current = null;
      const stream = streamRef.current;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      stopTicker();
      setState("stopped");
      // Force one final auto-save so the post-stop state lands on disk.
      writeAutosave(draftKey, transcriptRef.current, durationRef.current);
      // We intentionally don't reference `manual` further; both paths are
      // identical save logic. Keep the param so callers can distinguish
      // user-stops from cap-stops in the future.
      void manual;
    },
    [draftKey, stopTicker],
  );

  const reset = useCallback(() => {
    stopRecording(true);
    setDurationSec(0);
    durationRef.current = 0;
    clearAutosave(draftKey);
    setState("idle");
  }, [draftKey, stopRecording]);

  // ── Auto-save loop (every 30 s while recording or paused) ────────────────

  useEffect(() => {
    if (state !== "recording" && state !== "paused") return;
    const id = window.setInterval(() => {
      writeAutosave(draftKey, transcriptRef.current, durationRef.current);
    }, AUTOSAVE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [draftKey, state]);

  // ── Unmount cleanup ──────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      keepGoingRef.current = false;
      if (segmentTimerRef.current != null) {
        window.clearTimeout(segmentTimerRef.current);
      }
      if (tickerRef.current != null) {
        window.clearInterval(tickerRef.current);
      }
      const mr = recorderRef.current;
      if (mr && (mr.state === "recording" || mr.state === "paused")) {
        mr.stop();
      }
      const stream = streamRef.current;
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────

  const remainingSec = Math.max(0, maxDurationSec - durationSec);
  const atCap = durationSec >= maxDurationSec;

  return (
    <div style={shellStyle}>
      <div style={timerRowStyle}>
        <div style={timerStyle}>
          {formatDuration(durationSec)}
          <span style={timerMaxStyle}> / {formatDuration(maxDurationSec)}</span>
        </div>
        <div style={badgeRowStyle}>
          <StateBadge state={state} />
          {pendingSegments > 0 && (
            <span style={pendingBadgeStyle}>
              transcribing {pendingSegments}…
            </span>
          )}
        </div>
      </div>

      <div style={controlsRowStyle}>
        {state === "idle" && (
          <button onClick={startRecording} style={primaryButtonStyle}>
            ● Start recording
          </button>
        )}
        {state === "recording" && (
          <>
            <button onClick={pauseRecording} style={secondaryButtonStyle}>
              ‖ Pause
            </button>
            <button onClick={() => stopRecording(true)} style={primaryButtonStyle}>
              ■ Stop
            </button>
          </>
        )}
        {state === "paused" && (
          <>
            <button onClick={resumeRecording} style={primaryButtonStyle}>
              ● Resume
            </button>
            <button onClick={() => stopRecording(true)} style={secondaryButtonStyle}>
              ■ Stop
            </button>
          </>
        )}
        {state === "stopped" && (
          <button onClick={reset} style={secondaryButtonStyle}>
            ↺ Re-record
          </button>
        )}
        {state === "error" && (
          <button onClick={startRecording} style={primaryButtonStyle}>
            Try again
          </button>
        )}
      </div>

      <div style={hintStyle}>
        {atCap
          ? "Reached the 10-minute cap. Stop or re-record to continue."
          : state === "recording"
            ? `Recording — ${formatDuration(remainingSec)} left.`
            : state === "paused"
              ? "Paused. Resume to keep going."
              : state === "stopped"
                ? "Recording finished. Transcript saved locally."
                : state === "error"
                  ? error ?? "Microphone error."
                  : "Tap start, speak naturally. We'll save a draft every 30 seconds."}
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return undefined;
}

function writeAutosave(
  draftKey: string,
  transcript: string,
  durationSec: number,
) {
  if (typeof window === "undefined") return;
  try {
    const payload: AutosavePayload = {
      transcript,
      durationSec,
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(autosaveKey(draftKey), JSON.stringify(payload));
  } catch {
    // localStorage may be unavailable or full. Soft-fail.
  }
}

function formatDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(totalSec % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

function StateBadge({ state }: { state: RecorderState }) {
  const label =
    state === "recording"
      ? "REC"
      : state === "paused"
        ? "PAUSED"
        : state === "stopped"
          ? "STOPPED"
          : state === "error"
            ? "ERROR"
            : "READY";
  const colour =
    state === "recording"
      ? "#c8421b"
      : state === "paused"
        ? "#9b8a6b"
        : state === "error"
          ? "#dc2626"
          : "#1a1a1a";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 9px",
        border: `1px solid ${colour}`,
        color: colour,
        fontFamily: "system-ui",
        fontSize: 11,
        letterSpacing: 1.5,
        textTransform: "uppercase",
        borderRadius: 2,
      }}
    >
      {state === "recording" && <span style={dotStyle(colour)} />}
      {label}
    </span>
  );
}

const dotStyle = (colour: string): React.CSSProperties => ({
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: colour,
  animation: "pulse 1.2s ease-in-out infinite",
  display: "inline-block",
});

const shellStyle: React.CSSProperties = {
  border: "1px solid #e8e3d8",
  borderRadius: 4,
  padding: 20,
  background: "white",
  display: "flex",
  flexDirection: "column",
  gap: 14,
  fontFamily: "system-ui, sans-serif",
  color: "#1a1a1a",
};

const timerRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: 14,
};

const timerStyle: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 32,
  fontVariantNumeric: "tabular-nums",
  letterSpacing: -0.4,
};

const timerMaxStyle: React.CSSProperties = {
  fontSize: 16,
  color: "#888",
};

const badgeRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const pendingBadgeStyle: React.CSSProperties = {
  fontFamily: "system-ui",
  fontSize: 11,
  color: "#9b8a6b",
  letterSpacing: 0.4,
};

const controlsRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "10px 16px",
  background: "#1a1a1a",
  color: "white",
  border: "none",
  borderRadius: 3,
  fontFamily: "system-ui",
  fontSize: 14,
  letterSpacing: 0.4,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "10px 16px",
  background: "white",
  color: "#1a1a1a",
  border: "1px solid #c8c2b3",
  borderRadius: 3,
  fontFamily: "system-ui",
  fontSize: 14,
  letterSpacing: 0.4,
  cursor: "pointer",
};

const hintStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#666",
  lineHeight: 1.5,
};

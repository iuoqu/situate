/**
 * OpenAI helpers for the voice-to-fiction pipeline.
 *
 * We don't pull in the OpenAI SDK — the only call shape we need right now is
 * `POST /v1/audio/transcriptions` (multipart), and the SDK would add ~1 MB to
 * the bundle for that one endpoint. Plain `fetch` is enough.
 */

const WHISPER_ENDPOINT = "https://api.openai.com/v1/audio/transcriptions";

// `whisper-1` is the cheap workhorse at $0.006/min input audio. The newer
// `gpt-4o-transcribe` variants support true server-streamed text but cost
// 5–10× more; we stay on whisper-1 for Week 1 and emulate "streaming" by
// having the client post audio segments every ~12s.
export const WHISPER_MODEL = "whisper-1";

export function requireOpenAIKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error(
      "OPENAI_API_KEY is not set. Set it in .env (local) or Vercel env vars (prod).",
    );
  }
  return key;
}

export interface WhisperResult {
  text: string;
}

/**
 * Transcribe one audio segment via Whisper. The caller hands us a Blob (the
 * browser's MediaRecorder output, typically WebM/Opus); we forward it as a
 * multipart upload and return the recognized text.
 */
export async function transcribeAudioSegment(
  audio: Blob,
  options: { language?: string | null; filename?: string } = {},
): Promise<WhisperResult> {
  const upstream = new FormData();
  // Whisper REST infers the codec from the filename extension, so we have to
  // give it one. WebM is what Chrome / Edge produce; Safari produces MP4-in-
  // MP4A. The audio MIME we forward keeps Whisper happy in both cases.
  const filename =
    options.filename ?? (audio.type.includes("mp4") ? "segment.mp4" : "segment.webm");
  upstream.append("file", audio, filename);
  upstream.append("model", WHISPER_MODEL);
  upstream.append("response_format", "json");
  if (options.language) upstream.append("language", options.language);

  const response = await fetch(WHISPER_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${requireOpenAIKey()}` },
    body: upstream,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Whisper request failed (${response.status}): ${detail.slice(0, 500)}`,
    );
  }

  const data = (await response.json()) as { text?: string };
  return { text: (data.text ?? "").trim() };
}

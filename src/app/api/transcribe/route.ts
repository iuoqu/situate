import { NextRequest, NextResponse } from "next/server";

import { transcribeAudioSegment } from "@/lib/openai-client";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * POST /api/transcribe
 *
 * Voice capture (Week 1 of voice-to-fiction onboarding). The browser
 * `MediaRecorder` produces a complete audio segment every ~12 s and posts it
 * here as `multipart/form-data` with a single `file` field. We forward to
 * OpenAI Whisper (`whisper-1`) and return `{ text }`.
 *
 * This is "streaming" only at the segment level — each POST returns one
 * Whisper response. True server-pushed text streaming is a property of
 * `gpt-4o-transcribe` (5–10× the cost) and isn't worth it for the per-12-s
 * cadence we already get from segment uploads.
 *
 * Cost: ~$0.006/min input audio → a 5-min recording is $0.03.
 */

export const runtime = "nodejs"; // multipart audio + outbound multipart needs Node.
export const maxDuration = 30; // a 12-s segment is rarely > a few seconds to transcribe

export async function POST(req: NextRequest) {
  // Closed-beta gate. Every Whisper call costs real money; we never want
  // this endpoint reachable by an unauthenticated caller.
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "expected multipart/form-data with an `audio` file field" },
      { status: 400 },
    );
  }

  const audio = form.get("audio");
  if (!(audio instanceof Blob)) {
    return NextResponse.json(
      { error: "missing `audio` field" },
      { status: 400 },
    );
  }
  if (audio.size === 0) {
    // Silence segment — return empty without burning a Whisper call.
    return NextResponse.json({ text: "" });
  }
  // 25 MB is Whisper's per-file limit. A 12-s WebM/Opus segment is ~150 KB,
  // so anything above ~5 MB is almost certainly a misuse (or a 5-min single
  // upload — which we'd rather force the client to break up).
  if (audio.size > 5 * 1024 * 1024) {
    return NextResponse.json(
      { error: "segment too large; keep individual uploads under 5 MB" },
      { status: 413 },
    );
  }

  const language =
    typeof form.get("language") === "string"
      ? (form.get("language") as string)
      : null;

  try {
    const result = await transcribeAudioSegment(audio, { language });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "transcription failed";
    // 502: upstream Whisper failure. The client can drop the segment and
    // continue recording without breaking the session.
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

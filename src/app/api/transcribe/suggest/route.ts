import type Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

import { anthropicClient } from "@/lib/ai-editor/client";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * POST /api/transcribe/suggest
 *
 * Mid-recording follow-up prompts. While the author is dictating, the client
 * calls this every so often with the running transcript; we ask Haiku 4.5
 * whether a brief, non-style follow-up question is warranted.
 *
 * Per Voice-to-fiction TODO: only interrupt for missing characters / sensory
 * detail / why-it-matters. NEVER for style. The point is to keep authors
 * generating raw material — interrupting more than once a minute or two
 * destroys the flow we're trying to bootstrap.
 *
 * The client also rate-limits (don't call this every keystroke), but the
 * model is the final gate: when in doubt it must answer
 * `should_interrupt: false`.
 *
 * Cost: ~$0.001 / call (a few hundred input tokens of transcript +
 * ≤ 80 output tokens via the tool).
 */

const HAIKU_MODEL = "claude-haiku-4-5-20251001";

const SUGGEST_SYSTEM_PROMPT = `You are a quiet editorial assistant listening over the shoulder of an author who is dictating a short story aloud, for the first time, into a voice recorder. The author can hear you. Each time you are called, you see the running transcript and decide whether to ask ONE brief follow-up question.

YOUR JOB IS NOT TO COACH STYLE.

Almost every call should return should_interrupt = false. You are not a writing teacher; you are a patient listener who occasionally asks for a concrete missing piece so the author can keep going. Most authors do better when left alone.

ONLY consider interrupting when ONE of these is clearly missing AND you can ask in 12 words or less:

1. WHO is in this scene. The transcript has been going for a minute or more and we still have no concrete people — only places, weather, abstractions. A single question like "Who's there with them?" or "Whose hands are doing this?" is OK.

2. SENSORY ANCHOR. The transcript narrates events at a distance with no sound / smell / texture / light. A single question like "What does the room smell like?" or "What sound is in the background?" is OK.

3. WHY IT MATTERS. The transcript has described an event but the stakes are missing — we don't know why this person cares. A single question like "Why is this the moment they remember?" or "What is at risk for them here?" is OK.

DO NOT INTERRUPT FOR:
- Style, prose quality, word choice, register.
- Genre or structure ("is this a flashback?").
- Plot suggestions ("what if she goes back?").
- Information you already heard earlier in the transcript.
- Anything that asks the author to defend or label their choices.
- Anything that interrupts mid-sentence.

PACING RULES (apply BEFORE deciding to interrupt):

- If the transcript is under ~200 characters of real content (excluding filler like "um", "uh", "let me think"), return should_interrupt = false. The author is still warming up.
- If the most recent ~3 sentences are themselves dense with people, sensory detail, AND stakes, return false. They're cooking; don't break the rhythm.
- If you've been asked this same kind of question recently (the call site will sometimes pass a "recently asked" hint via the user message), don't repeat the category.
- If you're not sure, return false. Default is silence.

OUTPUT:

Always call the tool. When should_interrupt = false, return an empty questions array. When true, return ONE question (occasionally two, but only if they are genuinely different categories and both essential). Questions must be ≤ 12 words, conversational, and in the same language as the transcript.`;

const SUGGEST_TOOL: Anthropic.Tool = {
  name: "suggest_followups",
  description:
    "Submit a follow-up decision for the current voice-recording transcript.",
  input_schema: {
    type: "object",
    properties: {
      should_interrupt: {
        type: "boolean",
        description:
          "True only if a brief follow-up question is genuinely warranted. Default false.",
      },
      reason: {
        type: "string",
        description:
          "One short phrase naming the missing category: 'who', 'sensory', 'stakes', or 'none'.",
        enum: ["who", "sensory", "stakes", "none"],
      },
      questions: {
        type: "array",
        items: { type: "string" },
        description:
          "Empty when should_interrupt = false. One question (rarely two), each ≤ 12 words, in the transcript's language.",
        maxItems: 2,
      },
    },
    required: ["should_interrupt", "reason", "questions"],
  },
};

export interface SuggestResponse {
  should_interrupt: boolean;
  reason: "who" | "sensory" | "stakes" | "none";
  questions: string[];
}

export const runtime = "nodejs";
export const maxDuration = 15;

export async function POST(req: NextRequest) {
  // Closed-beta gate.
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "expected JSON body" },
      { status: 400 },
    );
  }

  const {
    transcript,
    recently_asked,
    language,
  } = (body ?? {}) as {
    transcript?: unknown;
    recently_asked?: unknown;
    language?: unknown;
  };

  if (typeof transcript !== "string") {
    return NextResponse.json(
      { error: "`transcript` must be a string" },
      { status: 400 },
    );
  }

  // Cheap pre-gate: don't bother Anthropic with tiny transcripts. The TODO
  // says don't over-interrupt; this is the first line of defence.
  if (transcript.trim().length < 200) {
    const empty: SuggestResponse = {
      should_interrupt: false,
      reason: "none",
      questions: [],
    };
    return NextResponse.json(empty);
  }

  const userPayload = {
    transcript_so_far: transcript,
    language: typeof language === "string" ? language : "unknown",
    recently_asked:
      Array.isArray(recently_asked)
        ? recently_asked.filter((q): q is string => typeof q === "string")
        : [],
  };

  try {
    const response = await anthropicClient().messages.create({
      model: HAIKU_MODEL,
      max_tokens: 256,
      // The system prompt is large and stable across calls; cache it so each
      // mid-recording call only pays for the transcript delta.
      system: [
        {
          type: "text",
          text: SUGGEST_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [SUGGEST_TOOL],
      tool_choice: { type: "tool", name: "suggest_followups" },
      messages: [
        {
          role: "user",
          content: `Decide whether to interrupt:\n\n${JSON.stringify(
            userPayload,
            null,
            2,
          )}`,
        },
      ],
    });

    const toolUse = response.content.find(
      (b): b is Extract<typeof b, { type: "tool_use" }> =>
        b.type === "tool_use" && b.name === "suggest_followups",
    );
    if (!toolUse) {
      // Treat as "no suggestion" rather than failing the call — the recording
      // session must continue regardless.
      const empty: SuggestResponse = {
        should_interrupt: false,
        reason: "none",
        questions: [],
      };
      return NextResponse.json(empty);
    }

    const raw = toolUse.input as Partial<SuggestResponse> & {
      questions?: unknown;
    };
    const result: SuggestResponse = {
      should_interrupt: raw.should_interrupt === true,
      reason:
        raw.reason === "who" ||
        raw.reason === "sensory" ||
        raw.reason === "stakes"
          ? raw.reason
          : "none",
      questions: Array.isArray(raw.questions)
        ? raw.questions
            .filter((q): q is string => typeof q === "string")
            .slice(0, 2)
        : [],
    };
    // Belt-and-braces: if the model said interrupt but produced no question,
    // suppress the interrupt.
    if (result.should_interrupt && result.questions.length === 0) {
      result.should_interrupt = false;
      result.reason = "none";
    }
    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "suggest call failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

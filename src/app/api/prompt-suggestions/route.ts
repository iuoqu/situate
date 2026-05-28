import type Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

import { AI_EDITOR_MODEL, anthropicClient } from "@/lib/ai-editor/client";
import type { SupportedLanguage } from "@/db/schema";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * POST /api/prompt-suggestions
 *
 * Story-hook generator. Given one or more coordinates the author has dropped
 * on the map, return 5 short story ideas (`{title, premise}`) they can pick
 * from to seed a draft. Free for all users — this is the AI surface visible
 * to free-tier authors and the conversion lure for the paid voice path.
 *
 * Cost: ~$0.02–0.03 / call (Sonnet 4.6, system prompt cached after the
 * first call within a 5-minute window).
 *
 * The endpoint is intentionally context-light: just coordinates + language
 * + an optional free-text context hint. Reverse-geocoding via Mapbox would
 * give the model a place name to work with, but Claude already knows
 * world geography for any major city and the marginal accuracy gain isn't
 * worth the extra round trip. Rural / obscure coordinates produce vaguer
 * hooks; that's an acceptable failure mode for a "give me ideas" tool.
 */

const HOOK_SYSTEM_PROMPT = `You are a story-hook generator for Situate Editions, a literary magazine that publishes flash fiction anchored to real places. An author has dropped pins on the map and wants 5 different angles they could write into.

YOUR JOB IS TO GIVE THEM IDEAS, NOT WRITE THE STORY.

Each hook is one possible way into the location(s). The hook is the seed; the author writes the prose. Keep hooks short — title (3–6 words) + premise (1–2 concrete sentences).

CONSTITUTIONAL CONSTRAINTS (do not violate any):

1. SPECIFICITY OVER CATEGORY. Each hook must be about specific individuals doing specific things, not "the people of X" or "everyone in Y." A retired tram driver checking the cables one last time is a story; "Lisbonites and their melancholy" is a verdict, and the grammar betrays it.

2. PLACE IS GENERATIVE. Each hook must depend on this specific place — something only this corner of this city/landscape would produce. If the same hook would work for any city with cafés, it fails.

3. NO REAL LIVING PEOPLE. Hooks must use unnamed or clearly fictional individuals. No "Beyoncé in Houston." Public-figure roles (a mayor, a goalkeeper) are fine if unnamed.

4. NO MASS-SUFFERING SATIRE OR REVISIONISM. Genocide, recent disasters, ongoing wars are not hook material.

5. NO TOURISM CLICHÉ. Avoid:
   - Neon-sign Tokyo, Eiffel-Tower Paris, yellow-cab New York, foggy Hong Kong harbour, etc.
   - "Mysterious East" / "Latin warmth" / "European elegance" — any framing that treats the place as exotic.
   - Stock characters: the wise old fisherman, the precocious street kid, the world-weary expat.
   - Postcard imagery in the premise.

6. DIVERSITY ACROSS THE 5. The 5 hooks must vary in tone, scale, and angle. If three of them are quiet domestic interiors, you've failed. Mix: a labour-of-work story; a chance encounter; a moment of weather/infrastructure; an interior thought-life; a sideways genre note. Different protagonists each time (don't make all 5 about a 60-year-old man).

7. CONCRETE OVER ABSTRACT. Premises must contain at least one sensory or material detail: a smell, a tool, a weather condition, a specific street feature, a particular hour of day. "She remembered the city" is not a premise; "She counts the green cracks in the tile floor of the all-night noodle place under the Liuzhou bypass" is.

LANGUAGE: write the hooks in the requested language. Match its register — Japanese hooks should feel natural in Japanese, not translated-from-English Japanese.

OUTPUT: call the submit_hooks tool exactly once with all 5 hooks.`;

const HOOK_TOOL: Anthropic.Tool = {
  name: "submit_hooks",
  description:
    "Submit 5 story-hook ideas for the author's chosen coordinates.",
  input_schema: {
    type: "object",
    properties: {
      hooks: {
        type: "array",
        minItems: 5,
        maxItems: 5,
        description: "Exactly 5 hooks, varied in tone and angle.",
        items: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "3–6 words. Concrete; not a category label.",
            },
            premise: {
              type: "string",
              description:
                "1–2 sentences. Must contain at least one sensory or material detail. Same language as requested.",
            },
          },
          required: ["title", "premise"],
        },
      },
    },
    required: ["hooks"],
  },
};

export interface PromptSuggestionHook {
  title: string;
  premise: string;
}

export interface PromptSuggestionsResponse {
  hooks: PromptSuggestionHook[];
}

export interface PromptSuggestionsRequest {
  coordinates: Array<{ longitude: number; latitude: number }>;
  language: SupportedLanguage;
  context?: string;
}

const VALID_LANGUAGES = new Set<SupportedLanguage>([
  "en",
  "zh_CN",
  "zh_TW",
  "ja",
  "ko",
]);

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  // Closed-beta gate. AI hooks are billed to our Anthropic account.
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

  const { coordinates, language, context } = (body ?? {}) as Partial<
    PromptSuggestionsRequest
  >;

  if (
    !Array.isArray(coordinates) ||
    coordinates.length === 0 ||
    coordinates.length > 6
  ) {
    return NextResponse.json(
      { error: "`coordinates` must be a non-empty array of ≤ 6 points" },
      { status: 400 },
    );
  }
  const validCoords = coordinates.every(
    (c) =>
      c &&
      typeof c.longitude === "number" &&
      typeof c.latitude === "number" &&
      Math.abs(c.longitude) <= 180 &&
      Math.abs(c.latitude) <= 90,
  );
  if (!validCoords) {
    return NextResponse.json(
      { error: "each coordinate must have numeric longitude and latitude" },
      { status: 400 },
    );
  }

  if (typeof language !== "string" || !VALID_LANGUAGES.has(language as SupportedLanguage)) {
    return NextResponse.json(
      { error: "`language` must be one of en, zh_CN, zh_TW, ja, ko" },
      { status: 400 },
    );
  }

  const safeContext =
    typeof context === "string" && context.trim().length > 0
      ? context.trim().slice(0, 600)
      : null;

  const userPayload = {
    coordinates: coordinates.map((c) => ({
      lon: Number(c.longitude.toFixed(5)),
      lat: Number(c.latitude.toFixed(5)),
    })),
    language,
    optional_context_from_author: safeContext,
  };

  try {
    const response = await anthropicClient().messages.create({
      model: AI_EDITOR_MODEL,
      max_tokens: 1024,
      // Stable across calls; ephemeral cache keeps the per-call cost low.
      system: [
        {
          type: "text",
          text: HOOK_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [HOOK_TOOL],
      tool_choice: { type: "tool", name: "submit_hooks" },
      messages: [
        {
          role: "user",
          content: `Generate hooks for:\n\n${JSON.stringify(
            userPayload,
            null,
            2,
          )}`,
        },
      ],
    });

    const toolUse = response.content.find(
      (b): b is Extract<typeof b, { type: "tool_use" }> =>
        b.type === "tool_use" && b.name === "submit_hooks",
    );
    if (!toolUse) {
      return NextResponse.json(
        { error: "model returned no hooks" },
        { status: 502 },
      );
    }

    const raw = toolUse.input as { hooks?: unknown };
    const rawHooks = Array.isArray(raw.hooks) ? raw.hooks : [];
    const hooks: PromptSuggestionHook[] = rawHooks
      .map((h): PromptSuggestionHook | null => {
        if (
          h &&
          typeof h === "object" &&
          typeof (h as { title?: unknown }).title === "string" &&
          typeof (h as { premise?: unknown }).premise === "string"
        ) {
          const obj = h as { title: string; premise: string };
          return {
            title: obj.title.trim(),
            premise: obj.premise.trim(),
          };
        }
        return null;
      })
      .filter((h): h is PromptSuggestionHook => h !== null)
      .slice(0, 5);

    if (hooks.length === 0) {
      return NextResponse.json(
        { error: "model returned malformed hooks" },
        { status: 502 },
      );
    }

    const result: PromptSuggestionsResponse = { hooks };
    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "hook generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

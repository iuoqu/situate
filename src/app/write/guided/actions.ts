"use server";

import { db } from "@/db";
import { storyDrafts, type DraftSection } from "@/db/schema";
import {
  DEFAULT_TRADITION_ID,
  getTradition,
} from "@/lib/traditions/registry";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Server action: create a draft from the guided write flow's output
 * and return its ID so the client can redirect to the review screen.
 *
 * Strategy: use the default tradition (situate-spine) which has 5
 * sections, but dump all of guided's prose into the FIRST section
 * (Arrival). The author can then split it across sections in the
 * template editor or just leave it as one block and submit.
 *
 * We don't try to auto-split the prose into 5 sections — that's the
 * author's editorial choice. We just bridge guided's free-form output
 * to the template editor + submit pipeline.
 */

interface CreateGuidedDraftInput {
  prose: string;
  anchor: string;
  title?: string;
}

interface CreateGuidedDraftResult {
  draftId: string;
}

export async function createGuidedDraft(
  input: CreateGuidedDraftInput,
): Promise<CreateGuidedDraftResult> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("not authenticated");
  }

  const tradition = getTradition(DEFAULT_TRADITION_ID)!;
  const sections: DraftSection[] = tradition.sections.map((s, idx) => ({
    index: idx,
    section_id: s.id,
    content: "",
    longitude: null,
    latitude: null,
    place_description: null,
    section_metadata: {},
  }));

  // Dump guided's prose into the first section. The anchor goes in as
  // a comment-style header (the editor can show it; submission strips
  // section metadata).
  if (sections[0]) {
    const proseBody = input.prose.trim();
    const anchorTrimmed = input.anchor.trim();
    sections[0].content = anchorTrimmed
      ? `${anchorTrimmed}\n\n${proseBody}`
      : proseBody;
    sections[0].section_metadata = {
      ...sections[0].section_metadata,
      created_from: "guided",
    };
  }

  // Title: use the explicit title if provided, otherwise the anchor's
  // first 30 chars, otherwise the prose's first line truncated.
  const titleSource =
    input.title?.trim() ||
    input.anchor.trim() ||
    input.prose.trim().split("\n")[0] ||
    "Guided draft";
  const title = titleSource.slice(0, 80);

  const [row] = await db
    .insert(storyDrafts)
    .values({
      userId: user.id,
      title,
      templateId: tradition.id,
      traditionProfileId: tradition.id,
      sections: sections as unknown as object,
      stage: "editing",
    })
    .returning({ id: storyDrafts.id });

  return { draftId: row.id };
}

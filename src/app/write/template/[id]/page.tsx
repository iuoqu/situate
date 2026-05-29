import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

import { db } from "@/db";
import { storyDrafts, type DraftSection } from "@/db/schema";
import {
  DEFAULT_TRADITION_ID,
  getTradition,
} from "@/lib/traditions/registry";
import { getServerSupabase } from "@/lib/supabase/server";

import { TemplateEditor } from "./template-editor";

export const metadata = {
  title: "Write · Situate Editions",
};

export const dynamic = "force-dynamic";

type RouteParams = Promise<{ id: string }>;

export default async function TemplateWritePage({
  params,
}: {
  params: RouteParams;
}) {
  const { id } = await params;

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(
      `/auth/login?reason=auth_required&next=${encodeURIComponent(
        `/write/template/${id}`,
      )}`,
    );
  }

  const [draft] = await db
    .select()
    .from(storyDrafts)
    .where(and(eq(storyDrafts.id, id), eq(storyDrafts.userId, user.id)))
    .limit(1);

  if (!draft) notFound();
  if (!draft.templateId) {
    // Voice-freeform drafts use a different editor surface; not built yet.
    redirect("/write");
  }

  // Tradition profile (0011) is the source of truth for the editor
  // scaffold — its sections + delete policy + place-required flag.
  // Legacy drafts that pre-date 0011 fall back to the default tradition;
  // the DB default ensures new rows always have one.
  const tradition =
    getTradition(draft.traditionProfileId) ??
    getTradition(DEFAULT_TRADITION_ID)!;

  // Reconcile the stored jsonb sections against the tradition's current
  // section list. We preserve content for any section_id that still
  // exists in the tradition, and drop content for sections that the
  // tradition has removed (Pearls deletions, or future tradition
  // revisions). Sections in the tradition that the draft doesn't have
  // yet (Pearls author deleted then restored) get blank entries.
  const stored = (Array.isArray(draft.sections) ? draft.sections : []) as
    | DraftSection[]
    | unknown[];

  // For traditions that allow deletion, we want to preserve the
  // *author's current set* (not re-add sections they deleted). We
  // figure that out by:
  //  - if the stored row has any sections matching the tradition's
  //    section ids, use those + their order
  //  - otherwise, seed from tradition (fresh draft / migrated)
  const storedById = new Map<string, DraftSection>(
    (stored as DraftSection[])
      .filter((s) => typeof s?.section_id === "string")
      .map((s) => [s.section_id, s]),
  );

  const traditionSectionIds = new Set(tradition.sections.map((s) => s.id));
  const hasAuthorDeletedSomething = tradition.allowSectionDeletion &&
    storedById.size > 0 &&
    Array.from(storedById.keys()).every((id) =>
      traditionSectionIds.has(id),
    ) &&
    storedById.size < tradition.sections.length;

  let normalisedSections: DraftSection[];
  if (hasAuthorDeletedSomething) {
    // Preserve only what the author chose to keep, in tradition order.
    normalisedSections = tradition.sections
      .filter((ts) => storedById.has(ts.id))
      .map((ts, idx) => {
        const m = storedById.get(ts.id)!;
        return { ...m, index: idx, section_id: ts.id };
      });
  } else {
    normalisedSections = tradition.sections.map((ts, idx) => {
      const m = storedById.get(ts.id);
      if (m) return { ...m, index: idx, section_id: ts.id };
      return {
        index: idx,
        section_id: ts.id,
        content: "",
        longitude: null,
        latitude: null,
        place_description: null,
        section_metadata: {},
      };
    });
  }

  return (
    <TemplateEditor
      draftId={draft.id}
      tradition={{
        id: tradition.id,
        name: tradition.name,
        description: tradition.description,
        placeRequired: tradition.placeRequired,
        minSections: tradition.minSections,
        maxSections: tradition.maxSections,
        allowSectionDeletion: tradition.allowSectionDeletion,
        sections: tradition.sections.map((s) => ({
          id: s.id,
          label: s.label,
          prompt: s.prompt,
          wordRangeMin: s.wordRange.min,
          wordRangeMax: s.wordRange.max,
          canHaveOwnLocation: s.canHaveOwnLocation,
          showHookSelector: s.showHookSelector ?? false,
          required: s.required ?? false,
        })),
      }}
      initialTitle={draft.title ?? ""}
      initialSections={normalisedSections}
      language={draft.language}
    />
  );
}

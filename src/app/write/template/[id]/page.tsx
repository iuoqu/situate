import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

import { db } from "@/db";
import { storyDrafts, type DraftSection } from "@/db/schema";
import { getTemplate } from "@/lib/templates/registry";
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

  const template = getTemplate(draft.templateId);
  if (!template) notFound();

  // Normalise the JSONB sections column into the typed shape the editor
  // expects. If the row was created before the template's current section
  // list existed (template revision), pad/clip so the editor doesn't
  // crash on missing entries.
  const stored = (Array.isArray(draft.sections) ? draft.sections : []) as
    | DraftSection[]
    | unknown[];

  const normalisedSections: DraftSection[] = template.sections.map(
    (templateSection, idx) => {
      const match = (stored as DraftSection[]).find(
        (s) => s?.section_id === templateSection.id,
      );
      if (match) {
        return {
          ...match,
          index: idx,
          section_id: templateSection.id,
        };
      }
      return {
        index: idx,
        section_id: templateSection.id,
        content: "",
        longitude: null,
        latitude: null,
        place_description: null,
        section_metadata: {},
      };
    },
  );

  return (
    <TemplateEditor
      draftId={draft.id}
      template={{
        id: template.id,
        name: template.name,
        description: template.description,
        sections: template.sections.map((s) => ({
          id: s.id,
          label: s.label,
          prompt: s.prompt,
          wordRangeMin: s.wordRange.min,
          wordRangeMax: s.wordRange.max,
          canHaveOwnLocation: s.canHaveOwnLocation,
          showHookSelector: s.showHookSelector ?? false,
        })),
      }}
      initialTitle={draft.title ?? ""}
      initialSections={normalisedSections}
    />
  );
}

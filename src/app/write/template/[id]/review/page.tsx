import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

import { db } from "@/db";
import { storyDrafts, type DraftSection } from "@/db/schema";
import { getTemplate } from "@/lib/templates/registry";
import { getServerSupabase } from "@/lib/supabase/server";

import { ReviewAndSubmit } from "./review-client";

export const metadata = {
  title: "Review & submit · Situate Editions",
};

export const dynamic = "force-dynamic";

type RouteParams = Promise<{ id: string }>;

export default async function ReviewPage({ params }: { params: RouteParams }) {
  const { id } = await params;

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(
      `/auth/login?reason=auth_required&next=${encodeURIComponent(
        `/write/template/${id}/review`,
      )}`,
    );
  }

  const [draft] = await db
    .select()
    .from(storyDrafts)
    .where(and(eq(storyDrafts.id, id), eq(storyDrafts.userId, user.id)))
    .limit(1);
  if (!draft) notFound();

  // Already-submitted drafts: redirect to the submission status page
  // for this draft (looked up by FK).
  if (draft.stage === "submitted") {
    const { submissions } = await import("@/db/schema");
    const [linked] = await db
      .select({ id: submissions.id })
      .from(submissions)
      .where(eq(submissions.draftId, draft.id))
      .limit(1);
    redirect(linked ? `/my/submissions/${linked.id}` : "/my");
  }
  if (draft.stage === "trashed") {
    redirect(`/write/template/${id}`);
  }

  const template = draft.templateId ? getTemplate(draft.templateId) : null;
  if (!template) notFound();

  const sections = (
    (Array.isArray(draft.sections) ? draft.sections : []) as DraftSection[]
  ).map((s, idx) => ({
    index: idx,
    section_id: s.section_id,
    content: s.content ?? "",
    label:
      template.sections.find((ts) => ts.id === s.section_id)?.label ??
      s.section_id,
  }));

  return (
    <ReviewAndSubmit
      draftId={draft.id}
      title={draft.title ?? ""}
      sections={sections}
      authorEmail={user.email ?? ""}
    />
  );
}

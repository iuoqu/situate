import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { storyDrafts } from "@/db/schema";
import { getServerSupabase } from "@/lib/supabase/server";

import { ActClient } from "./act-client";

export const dynamic = "force-dynamic";

/**
 * /write/project/[draftId]/act — Phase 2: situate.act
 *
 * Server component: auth + ownership check, then hands off to ActClient
 * for the time shape → place shape → characters → arcs flow.
 */
export default async function ProjectActPage({
  params,
}: {
  params: Promise<{ draftId: string }>;
}) {
  const { draftId } = await params;
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/auth/login?reason=auth_required&next=/write/project/${draftId}/act`);
  }

  const [draft] = await db
    .select({
      id: storyDrafts.id,
      mapData: storyDrafts.mapData,
      actData: storyDrafts.actData,
      userId: storyDrafts.userId,
    })
    .from(storyDrafts)
    .where(eq(storyDrafts.id, draftId))
    .limit(1);

  if (!draft || draft.userId !== user.id) {
    redirect("/write");
  }

  // Must have completed map phase before accessing act
  const mapData = draft.mapData as { phase?: string } | null;
  if (!mapData || mapData.phase !== "complete") {
    redirect(`/write/project/${draftId}/map`);
  }

  return (
    <ActClient
      draftId={draft.id}
      mapData={draft.mapData as object}
      initialActData={draft.actData as object ?? {}}
    />
  );
}

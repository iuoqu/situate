import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { storyDrafts } from "@/db/schema";
import { getServerSupabase } from "@/lib/supabase/server";

import { MapClient } from "./map-client";

export const dynamic = "force-dynamic";

/**
 * /write/project/[draftId]/map — Phase 1: situate.map
 *
 * Server component: auth + draft ownership check, then hands off to
 * MapClient for the interactive material → questions → answers →
 * synthesis → center flow.
 */
export default async function ProjectMapPage({
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
    redirect(`/auth/login?reason=auth_required&next=/write/project/${draftId}/map`);
  }

  const [draft] = await db
    .select({
      id: storyDrafts.id,
      driveType: storyDrafts.driveType,
      truthDeclaration: storyDrafts.truthDeclaration,
      mapData: storyDrafts.mapData,
      userId: storyDrafts.userId,
    })
    .from(storyDrafts)
    .where(eq(storyDrafts.id, draftId))
    .limit(1);

  if (!draft || draft.userId !== user.id) {
    redirect("/write");
  }

  return (
    <MapClient
      draftId={draft.id}
      initialMapData={draft.mapData as object ?? {}}
    />
  );
}

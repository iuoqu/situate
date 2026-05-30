import { redirect } from "next/navigation";

import { isStaffEmail } from "@/lib/auth/staff";
import { getServerSupabase } from "@/lib/supabase/server";

import { GuidedWriteClient } from "./guided-client";

export const metadata = {
  title: "Guided write · Situate Editions",
  robots: "noindex, nofollow",
};

export const dynamic = "force-dynamic";

/**
 * /write/guided — prototype guided writing surface for users who have
 * a story but don't know how to start. NOT the template editor's
 * 5-section structure; instead a conversational 5-stage flow:
 *   1. mode select (memoir / fiction / blend)
 *   2. anchor capture (1-2 lines: the thing that won't go away)
 *   3. concrete drill (5 short fields: who/when/where/what changed/why remember)
 *   4. free dump (whatever else the user wants to say)
 *   5. bank mirror (translated to lay language)
 *
 * Staff-only for now — wraps existing /api/dev/coach-preview. When the
 * prototype proves out, we'll add user-facing auth + persistence.
 *
 * No draft persistence in v0. User's work lives in client state only.
 */
export default async function GuidedWritePage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(
      `/auth/login?reason=auth_required&next=${encodeURIComponent("/write/guided")}`,
    );
  }
  if (!isStaffEmail(user.email)) {
    redirect("/write");
  }
  return <GuidedWriteClient />;
}

import { redirect } from "next/navigation";

import { getServerSupabase } from "@/lib/supabase/server";

import { GuidedWriteClient } from "./guided-client";

export const metadata = {
  title: "Guided write (内测) · Situate Editions",
  robots: "noindex, nofollow",
};

export const dynamic = "force-dynamic";

/**
 * /write/guided — conversational 5-stage write surface for users who
 * have a story but don't know how to start.
 *
 *   1. mode select (memoir / fiction / blend)
 *   2. anchor capture (1-2 lines)
 *   3. concrete drill (5 short optional fields)
 *   4. free dump + optional character/place workshops
 *   5. bank mirror (lay-language observations)
 *   6. finish (readiness assessment + save as draft → /review)
 *
 * Currently 内测版 (internal beta) — open to all logged-in users but
 * marked clearly as an experimental surface. The bank is called via
 * /api/coach/diagnose which authenticates the user's Supabase session
 * (no dev token cookie needed).
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
  return <GuidedWriteClient userEmail={user.email ?? ""} />;
}

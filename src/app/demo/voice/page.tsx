import { redirect } from "next/navigation";

import { getServerSupabase } from "@/lib/supabase/server";

import { VoiceDemoClient } from "./voice-demo-client";

export const metadata = {
  title: "Voice capture demo · Situate Editions",
  description:
    "Internal Week-1 demo of the voice-to-fiction recorder, live transcript, and Haiku-driven mid-recording prompts.",
};

export const dynamic = "force-dynamic";

export default async function VoiceDemoPage() {
  // Closed-beta gate. /demo/voice burns real OpenAI + Anthropic budget per
  // request — must be authed.
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/login?reason=auth_required&next=/demo/voice`);

  return <VoiceDemoClient />;
}

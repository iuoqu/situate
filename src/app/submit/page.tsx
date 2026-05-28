import { redirect } from "next/navigation";

import { getActivePrinciples } from "@/app/actions";
import { getReaderPrefs } from "@/lib/reader-prefs";
import { getServerSupabase } from "@/lib/supabase/server";

import { SubmitForm } from "./submit-form";

export const dynamic = "force-dynamic";

type Search = Promise<{ lang?: string }>;

export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const sp = await searchParams;

  // Closed-beta gate. The /submit form is treated as a "feature" per the
  // invite-only policy — read-side pages stay public.
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/login?reason=auth_required&next=/submit`);

  const { language } = await getReaderPrefs({ langParam: sp.lang });

  // Fetch active principles for the F7 attestation — the legal-attestation
  // label dynamically references the live constitution version + count, so
  // it survives v0.1 → v0.2 → ... without code changes.
  const principles = await getActivePrinciples();
  const version = principles[0]?.version ?? "v0.1";
  const codes = principles.map((p) => p.code).join(", ");
  const constitutionSignature = `${version}, ${codes || "P1–P10"}`;

  return (
    <SubmitForm
      locale={language}
      constitutionSignature={constitutionSignature}
    />
  );
}

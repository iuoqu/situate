import { getActivePrinciples } from "@/app/actions";

import { SubmitForm } from "./submit-form";

export const dynamic = "force-dynamic";

export default async function SubmitPage() {
  // Fetch active principles for the F7 attestation — the legal-attestation
  // label dynamically references the live constitution version + count, so
  // it survives v0.1 → v0.2 → ... without code changes.
  const principles = await getActivePrinciples();
  const version = principles[0]?.version ?? "v0.1";
  const codes = principles.map((p) => p.code).join(", ");
  const constitutionSignature = `${version}, ${codes || "P1–P10"}`;

  return <SubmitForm constitutionSignature={constitutionSignature} />;
}

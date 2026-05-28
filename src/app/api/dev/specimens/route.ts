import { NextResponse, type NextRequest } from "next/server";

import { requireBearerToken } from "@/lib/skeleton-diagnostic/auth";
import { listSpecimens } from "@/lib/eval/specimens";

/**
 * GET /api/dev/specimens
 *
 * Returns the specimen catalog for the /dev/eval UI: paths + expectations
 * + length metadata. Text bodies are NOT included to keep the payload
 * small — the page fetches individual text on demand if it needs to.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const unauthorized = requireBearerToken(req);
  if (unauthorized) return unauthorized;

  const specimens = listSpecimens();

  const train = specimens.filter((s) => !s.is_partial && !s.is_holdout).length;
  const holdout = specimens.filter((s) => !s.is_partial && s.is_holdout).length;
  const partial = specimens.filter((s) => s.is_partial).length;

  return NextResponse.json({
    total: specimens.length,
    train,
    holdout,
    partial,
    specimens: specimens.map((s) => ({
      path: s.path,
      bucket: s.is_partial ? "partial" : s.is_holdout ? "holdout" : "train",
      bytes: Buffer.byteLength(s.text, "utf-8"),
      first_line: s.text.split("\n")[0]?.slice(0, 80) ?? "",
      expectation: s.expectation,
    })),
  });
}

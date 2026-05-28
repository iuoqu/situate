import { NextResponse, type NextRequest } from "next/server";

import { requireBearerToken } from "@/lib/skeleton-diagnostic/auth";
import { specimenByPath } from "@/lib/eval/specimens";

/**
 * GET /api/dev/specimens/text?path=<rel>
 *
 * Returns the raw text body of one specimen. Split from /api/dev/specimens
 * (which returns the catalog) to keep that payload small — text is only
 * needed when the UI is about to feed it to /api/generate-variation.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const unauthorized = requireBearerToken(req);
  if (unauthorized) return unauthorized;

  const path = req.nextUrl.searchParams.get("path");
  if (!path) {
    return NextResponse.json({ error: "missing path query param" }, { status: 400 });
  }

  const spec = specimenByPath(path);
  if (!spec) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ path: spec.path, text: spec.text });
}

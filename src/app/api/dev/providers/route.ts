import { NextResponse, type NextRequest } from "next/server";

import { requireBearerToken } from "@/lib/skeleton-diagnostic/auth";
import {
  DEFAULT_PROVIDER_ID,
  listProviders,
} from "@/lib/skeleton-diagnostic/providers/registry";

/**
 * GET /api/dev/providers
 *
 * Lists registered diagnostic providers — { id, displayName, costNote,
 * available } — so the /dev/eval UI can populate its model dropdown and
 * grey out anything missing an API key on the server.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const unauthorized = requireBearerToken(req);
  if (unauthorized) return unauthorized;

  return NextResponse.json({
    default: DEFAULT_PROVIDER_ID,
    providers: listProviders(),
  });
}

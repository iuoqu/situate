import { NextResponse, type NextRequest } from "next/server";

/**
 * Single bearer-token gate shared by every /api/* endpoint in this module.
 * The token lives in DIAGNOSTIC_INTERNAL_TOKEN (Vercel env). Missing token
 * → 503 fail-closed; wrong token → 401.
 *
 * Returns `null` on success — caller proceeds. Returns a `NextResponse` on
 * failure — caller should return it immediately.
 */
export function requireBearerToken(req: NextRequest): NextResponse | null {
  const expected = process.env.DIAGNOSTIC_INTERNAL_TOKEN;
  if (!expected) {
    console.error("DIAGNOSTIC_INTERNAL_TOKEN not set; refusing all requests");
    return NextResponse.json(
      { error: "endpoint not configured" },
      { status: 503 },
    );
  }
  const header = req.headers.get("authorization") ?? "";
  if (header !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

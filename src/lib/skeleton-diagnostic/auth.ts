import { NextResponse, type NextRequest } from "next/server";

const COOKIE_NAME = "dev_token";

/**
 * Single bearer-token gate shared by every /api/* endpoint in this module.
 * The token lives in DIAGNOSTIC_INTERNAL_TOKEN (Vercel env). Missing token
 * → 503 fail-closed; wrong token → 401.
 *
 * Accepts either:
 *   - `Authorization: Bearer <token>` header (for CLI / Python clients)
 *   - `dev_token` cookie (for the /dev/eval browser UI)
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
  const headerMatch = header === `Bearer ${expected}`;
  const cookieMatch = req.cookies.get(COOKIE_NAME)?.value === expected;

  if (!headerMatch && !cookieMatch) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

export const DEV_TOKEN_COOKIE = COOKIE_NAME;

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Session-refresh middleware for Supabase Auth (SSR).
 *
 * Runs on (almost) every request. Its only job is to:
 *   - read the auth cookie off the incoming request,
 *   - call `auth.getUser()` so @supabase/ssr can refresh the access token
 *     if it's near expiry,
 *   - mirror any updated cookies onto the outgoing response.
 *
 * Route gating (redirect to /auth/login, return 401 from API routes) is NOT
 * done here — it lives in the protected pages and route handlers themselves.
 * That keeps the middleware reusable across protection policies.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(toSet) {
          for (const { name, value } of toSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of toSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Triggers a token refresh if the access token is past its halfway point.
  // The returned user is also useful if we ever want to add request-level
  // logging; for now we just discard it.
  await supabase.auth.getUser();

  return response;
}

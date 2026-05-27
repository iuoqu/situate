import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

// Next 15 middleware. Runs at the edge; refreshes the Supabase session
// cookie on every matched request. Per-route protection (redirect-to-login,
// 401-from-API) is enforced inside the route handlers and Server Components
// themselves, not here.
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Exclude static assets and Next's internal routes from the middleware to
  // avoid running Supabase cookie logic on /_next/static, favicon, etc.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

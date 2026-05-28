import { NextResponse, type NextRequest } from "next/server";

import { getServerSupabase } from "@/lib/supabase/server";

/**
 * POST /auth/logout — clears the Supabase session cookie and redirects to
 * the home page. Accepts only POST so a stray `<a href>` can't sign someone
 * out via a CSRF-style link prefetch.
 */
export async function POST(req: NextRequest) {
  const supabase = await getServerSupabase();
  await supabase.auth.signOut();
  const url = new URL(req.url);
  return NextResponse.redirect(new URL("/", url.origin), {
    status: 303, // see-other; convert POST to GET on redirect
  });
}

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Admin Supabase client — uses the SERVICE ROLE key, which bypasses RLS
 * and has full database privileges. Use sparingly and ONLY in server-side
 * code that has already validated the caller's authority for the action.
 *
 * Typical use: `/api/auth/invite` — after our own invite-code check passes,
 * we call `supabase.auth.admin.inviteUserByEmail` to create the auth.users
 * row even though "Allow new users to sign up" is OFF on the project.
 *
 * NEVER expose this client (or anything it touches) to the browser. Any
 * file that imports this MUST be a server-side file (`route.ts`, server
 * action, server-only utility). A `"server-only"` import guards against
 * accidental client-bundle inclusion at build time.
 */

import "server-only";

let cached: SupabaseClient | null = null;

export function getAdminSupabase(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  cached = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return cached;
}

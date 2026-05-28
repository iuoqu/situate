import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for Server Components, Route Handlers, and Server Actions.
 *
 * Uses the ANON key — RLS-bound. Reads + writes the auth cookie via Next's
 * `cookies()` helper. Inside a Server Component the `setAll` no-op path is
 * fine because Next forbids cookie writes outside of middleware / actions /
 * route handlers; @supabase/ssr's middleware companion handles refresh.
 */
export async function getServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(toSet) {
          try {
            for (const { name, value, options } of toSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // `cookies().set` throws when called from a Server Component
            // during render. That's fine — the middleware refreshes the
            // session on every request, so missing a one-off refresh here
            // doesn't lose the session.
          }
        },
      },
    },
  );
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

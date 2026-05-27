"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for Client Components. Reads the public env vars baked
 * into the browser bundle by Next at build time.
 *
 * We do NOT memoise this in a module-level variable — Next's React Fast
 * Refresh dev cycle can leave stale instances pointing at old cookies. A
 * fresh client per call is cheap (no connection, just a JWT wrapper).
 */
export function getBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

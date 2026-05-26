import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

// Reuse the postgres client across hot-reloads in dev so we don't exhaust
// Supabase's connection pool. Also reuse across module loads in serverless
// runtimes when the same JS context survives between invocations.
declare global {
  // eslint-disable-next-line no-var
  var __situate_pg__: ReturnType<typeof postgres> | undefined;
  // eslint-disable-next-line no-var
  var __situate_db__:
    | ReturnType<typeof drizzle<typeof schema>>
    | undefined;
}

// Lazy initialization. Throwing at module load breaks `next build` because
// build-time page-collection imports this file before any env from Vercel
// is available. We defer the check until the first actual query.
function makeDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. Set it in .env (local) or Vercel project env vars (deploy).",
    );
  }
  const client =
    globalThis.__situate_pg__ ??
    postgres(process.env.DATABASE_URL, {
      // Required when running against Supabase's Transaction-mode pooler.
      prepare: false,
      max: 10,
    });
  if (process.env.NODE_ENV !== "production") {
    globalThis.__situate_pg__ = client;
  }
  return drizzle(client, { schema });
}

// Export a Proxy that forwards every property access to a lazily-created
// drizzle instance. Modules can `import { db }` without triggering a
// connection attempt or env-var check at import time.
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop, receiver) {
    const instance = globalThis.__situate_db__ ?? (globalThis.__situate_db__ = makeDb());
    return Reflect.get(instance, prop, receiver);
  },
});

export type Database = ReturnType<typeof drizzle<typeof schema>>;

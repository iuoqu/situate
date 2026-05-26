import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

// Reuse the postgres client across hot-reloads in dev so we don't exhaust
// Supabase's connection pool.
declare global {
  // eslint-disable-next-line no-var
  var __situate_pg__: ReturnType<typeof postgres> | undefined;
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

export const db = drizzle(client, { schema });
export type Database = typeof db;

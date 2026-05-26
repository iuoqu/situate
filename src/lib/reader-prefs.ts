/**
 * Reader-preference helpers. Two surfaces share the same cookie names:
 *   - Server components read via `getReaderPrefs(searchParams)` to seed
 *     the initial render, with `?lang=` / `?access=` query params taking
 *     priority over the cookie (so share-links honor sender intent
 *     without changing the recipient's preference).
 *   - Client components write via `writeReaderPref{Lang,Access}` so the
 *     next page visit picks them up automatically.
 *
 * Server and client code each import only the half they need; the cookie
 * names and validator lists are shared constants here.
 */
import type { ReaderAccessLevel } from "@/app/actions";
import type { SupportedLanguage } from "@/db/schema";

export const LANG_COOKIE = "situate_lang";
export const ACCESS_COOKIE = "situate_access";

const SUPPORTED_LANGS: SupportedLanguage[] = [
  "en",
  "zh_CN",
  "zh_TW",
  "ja",
  "ko",
];
const SUPPORTED_ACCESS: ReaderAccessLevel[] = ["free", "metered", "premium"];

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function isSupportedLang(v: unknown): v is SupportedLanguage {
  return SUPPORTED_LANGS.includes(v as SupportedLanguage);
}

export function isSupportedAccess(v: unknown): v is ReaderAccessLevel {
  return SUPPORTED_ACCESS.includes(v as ReaderAccessLevel);
}

/**
 * Resolve reader preferences from (in priority order):
 *   1. an explicit `?lang=` / `?access=` value from the page's
 *      `searchParams`
 *   2. the `situate_lang` / `situate_access` cookies
 *   3. defaults (en / free)
 *
 * Server components only — uses next/headers cookies(). Pass the
 * page's searchParams in so we don't have to read URL state twice.
 */
export async function getReaderPrefs(input?: {
  langParam?: string;
  accessParam?: string;
}): Promise<{
  language: SupportedLanguage;
  accessLevel: ReaderAccessLevel;
}> {
  // Imported inside the function to keep this file safe to import from
  // both server and (typed-only) client code paths.
  const { cookies } = await import("next/headers");
  const store = await cookies();
  const langRaw = input?.langParam ?? store.get(LANG_COOKIE)?.value;
  const accessRaw = input?.accessParam ?? store.get(ACCESS_COOKIE)?.value;
  return {
    language: isSupportedLang(langRaw) ? langRaw : "en",
    accessLevel: isSupportedAccess(accessRaw) ? accessRaw : "free",
  };
}

// ─── Client-side writers ────────────────────────────────────────────────────
// Plain `document.cookie` writes — safe to call from any client component.
// Marked here as `export` rather than as part of a "use client" file so
// server modules can import the helpers for type-checking; they never call
// them.

export function writeReaderPrefLang(lang: SupportedLanguage): void {
  if (typeof document === "undefined") return;
  document.cookie = `${LANG_COOKIE}=${encodeURIComponent(lang)}; max-age=${ONE_YEAR_SECONDS}; path=/; samesite=lax`;
}

export function writeReaderPrefAccess(access: ReaderAccessLevel): void {
  if (typeof document === "undefined") return;
  document.cookie = `${ACCESS_COOKIE}=${encodeURIComponent(access)}; max-age=${ONE_YEAR_SECONDS}; path=/; samesite=lax`;
}

"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { SupportedLanguage } from "@/db/schema";
import { writeReaderPrefLang } from "@/lib/reader-prefs";

const LANGS: { code: SupportedLanguage; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "zh_CN", label: "简" },
  { code: "zh_TW", label: "繁" },
  { code: "ja", label: "JA" },
  { code: "ko", label: "KO" },
];

/**
 * Floating language switcher used by every editorial surface
 * (/about/constitution, /stories/[id], /editions/[slug]). Writes the
 * `situate_lang` cookie and forces a router replace with `?lang=` so
 * the server re-renders with the new pref.
 */
export function LangSwitch({ current }: { current: SupportedLanguage }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function pick(lang: SupportedLanguage) {
    writeReaderPrefLang(lang);
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    next.set("lang", lang);
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <nav
      style={{
        position: "fixed",
        top: 20,
        right: 24,
        zIndex: 10,
        display: "flex",
        gap: 6,
        background: "rgba(255,255,255,0.92)",
        padding: "6px 8px",
        borderRadius: 4,
        fontFamily: "system-ui, sans-serif",
        fontSize: 11,
        letterSpacing: 1,
        backdropFilter: "blur(6px)",
      }}
    >
      {LANGS.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => pick(code)}
          aria-pressed={code === current}
          style={{
            border: "none",
            background: "transparent",
            padding: "2px 6px",
            color: code === current ? "#1a1a1a" : "#999",
            fontWeight: code === current ? 600 : 400,
            cursor: "pointer",
            fontSize: 11,
            fontFamily: "inherit",
            letterSpacing: "inherit",
          }}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}

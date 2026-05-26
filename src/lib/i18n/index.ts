import type { SupportedLanguage } from "@/db/schema";

import { messages as messages_en, type MessageDictionary } from "./messages/en";
import { messages as messages_ja } from "./messages/ja";
import { messages as messages_ko } from "./messages/ko";
import { messages as messages_zh_CN } from "./messages/zh_CN";
import { messages as messages_zh_TW } from "./messages/zh_TW";

/**
 * Minimal in-house i18n. Keys are typed (TypeScript catches typos).
 * Missing translations fall back to English. Interpolation uses
 * `{name}` placeholders replaced from the optional `vars` argument.
 *
 * Usage (server or client):
 *   t("en",    "submit.field_title")                       → "Title"
 *   t("zh_CN", "submit.scene_word_count", { count: 42 })   → "42 字"
 *
 * The dictionaries ship in the client bundle (~15 KB total). For ~80
 * strings × 5 locales this is acceptable; if it grows past several
 * hundred strings consider lazy-loading per locale.
 */

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

const DICTIONARIES: Record<SupportedLanguage, DeepPartial<MessageDictionary>> = {
  en: messages_en,
  zh_CN: messages_zh_CN,
  zh_TW: messages_zh_TW,
  ja: messages_ja,
  ko: messages_ko,
};

// Dotted-key paths derived from the English dictionary shape. e.g.
// "common.back_to_situate" | "submit.field_title" | ...
type Join<K, P> = K extends string
  ? P extends string
    ? `${K}.${P}`
    : never
  : never;

type DotKeys<T> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends object
        ? Join<K, DotKeys<T[K]>>
        : K;
    }[keyof T & string]
  : never;

export type MessageKey = DotKeys<MessageDictionary>;

export function t(
  locale: SupportedLanguage,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  const lookup = (dict: DeepPartial<MessageDictionary> | undefined) =>
    getByPath(dict, key);

  const value = lookup(DICTIONARIES[locale]) ?? lookup(DICTIONARIES.en) ?? key;
  return interpolate(value, vars);
}

function getByPath(obj: unknown, path: string): string | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  let cursor: unknown = obj;
  for (const segment of path.split(".")) {
    if (cursor && typeof cursor === "object" && segment in cursor) {
      cursor = (cursor as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return typeof cursor === "string" ? cursor : undefined;
}

function interpolate(
  template: string,
  vars: Record<string, string | number> | undefined,
): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

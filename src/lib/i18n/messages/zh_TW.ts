import type { MessageDictionary } from "./en";

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

/**
 * 繁體中文 — TODO. All keys currently fall back to English.
 *
 * To populate: copy the structure from `zh_CN.ts` and translate. Many
 * strings can be mechanically converted from Simplified to Traditional,
 * but typography, vocabulary, and tone vary by region (Taiwan vs Hong
 * Kong vs Singapore) — a translator-curator should review.
 */
export const messages: DeepPartial<MessageDictionary> = {
  // Empty for v1. English fallback active.
};

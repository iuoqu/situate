import type { MessageDictionary } from "./en";

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

/**
 * 한국어 — TODO. All keys currently fall back to English. A translator-
 * curator should populate this.
 */
export const messages: DeepPartial<MessageDictionary> = {
  // Empty for v1. English fallback active.
};

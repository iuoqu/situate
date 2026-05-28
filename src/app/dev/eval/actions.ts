"use server";

import { cookies } from "next/headers";

import { DEV_TOKEN_COOKIE } from "@/lib/skeleton-diagnostic/auth";

/**
 * Save the bearer token (same as DIAGNOSTIC_INTERNAL_TOKEN on the server)
 * as an httpOnly cookie. The /api/dev/* routes will read it from there;
 * the browser never sees it after this call.
 *
 * No verification here — the cookie just gets set. The first API request
 * will return 401 if the token is wrong, and the page handles that.
 */
export async function saveDevToken(token: string) {
  const store = await cookies();
  store.set(DEV_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export async function clearDevToken() {
  const store = await cookies();
  store.delete(DEV_TOKEN_COOKIE);
}

export async function hasDevToken(): Promise<boolean> {
  const store = await cookies();
  return store.has(DEV_TOKEN_COOKIE);
}

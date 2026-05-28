/**
 * scripts/issue-invite.ts — generate one invite code and print it.
 *
 * Usage (via npm run invite:issue):
 *
 *   npm run invite:issue
 *     → 1 use, never expires, no note
 *
 *   npm run invite:issue -- --note "michael at granta"
 *     → 1 use, never expires, with private note
 *
 *   npm run invite:issue -- --uses 10 --expires 30d --note "lithub readers jan"
 *     → 10 uses, expires in 30 days, with note
 *
 * The code is a base32-style 8-character string (A–Z, 2–9; no I/L/O/0/1 to
 * avoid visual ambiguity in copy/paste). Codes are not bound to email.
 */

import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";

import { db } from "@/db";
import { inviteCodes } from "@/db/schema";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 31 chars; skip 0,1,I,L,O

function randomCode(len = 8): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

function parseExpiry(raw: string | undefined): Date | null {
  if (!raw) return null;
  const match = /^(\d+)([dh])$/i.exec(raw.trim());
  if (!match) {
    throw new Error(
      `--expires must look like '30d' or '12h'; got '${raw}'`,
    );
  }
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const ms = unit === "d" ? amount * 86_400_000 : amount * 3_600_000;
  return new Date(Date.now() + ms);
}

function parseArgs(argv: string[]) {
  const opts: { uses: number; expires: string | undefined; note: string | undefined } = {
    uses: 1,
    expires: undefined,
    note: undefined,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === "--uses") {
      opts.uses = Number(next);
      if (!Number.isFinite(opts.uses) || opts.uses < 1) {
        throw new Error(`--uses must be a positive integer; got '${next}'`);
      }
      i++;
    } else if (a === "--expires") {
      opts.expires = next;
      i++;
    } else if (a === "--note") {
      opts.note = next;
      i++;
    } else if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`unknown option: ${a}`);
    }
  }
  return opts;
}

function printHelp() {
  console.log(
    [
      "Usage: npm run invite:issue -- [--uses N] [--expires Nd|Nh] [--note '…']",
      "",
      "Issues one invite code and prints it to stdout.",
      "",
      "Options:",
      "  --uses N         number of redemptions allowed (default 1)",
      "  --expires Nd|Nh  expire after N days or hours (default: never)",
      "  --note '…'       private note saved with the code (default: none)",
    ].join("\n"),
  );
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const expiresAt = parseExpiry(opts.expires);

  // Retry on the (extremely unlikely) primary-key collision.
  let attempts = 0;
  let code: string;
  while (true) {
    code = randomCode();
    const existing = await db
      .select()
      .from(inviteCodes)
      .where(sql`${inviteCodes.code} = ${code}`)
      .limit(1);
    if (existing.length === 0) break;
    if (++attempts > 5) {
      throw new Error("could not generate a unique code after 5 tries");
    }
  }

  await db.insert(inviteCodes).values({
    code,
    note: opts.note ?? null,
    maxUses: opts.uses,
    usesCount: 0,
    expiresAt,
  });

  // Output is intentionally machine-friendly: the code alone on the last
  // line so `npm run invite:issue -- --note 'x' | tail -1` works.
  console.log("");
  console.log(`code:    ${code}`);
  console.log(`uses:    ${opts.uses}`);
  console.log(`expires: ${expiresAt ? expiresAt.toISOString() : "never"}`);
  console.log(`note:    ${opts.note ?? "—"}`);
  console.log("");
  console.log(code);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  });

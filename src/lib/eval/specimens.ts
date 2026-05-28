import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

/**
 * Server-side reader for the story-gate-eval specimen suite. Walks
 * `story-gate-eval/specimens/` at module load, joins each .txt with its
 * `expectations.json` entry. Cached for process lifetime — specimens
 * don't change between requests (next deploy reads them again).
 */

const REPO_ROOT = process.cwd();
const SPEC_ROOT = join(REPO_ROOT, "story-gate-eval", "specimens");
const EXPECT_PATH = join(REPO_ROOT, "story-gate-eval", "expectations.json");

export interface ExpectationEntry {
  is_story?: boolean;
  type?: "描摹" | "随笔" | "说明" | null;
  expected_engine?:
    | "conflict"
    | "recontextualize"
    | "revelation"
    | "inevitability"
    | null;
  confidence_band?: [number, number];
  tradition?: string;
  purpose?: string;
  holdout?: boolean;
  is_partial?: boolean;
  partial_expectations?: {
    S0_present?: boolean;
    D_present?: boolean;
    T_present?: boolean;
    S1_present?: boolean;
  };
  // Free-form metadata fields we don't constrain
  [key: string]: unknown;
}

export interface Specimen {
  path: string;          // POSIX-style path relative to specimens/, e.g. synthetic/faqtiao/01_mood.txt
  text: string;          // full file contents
  expectation: ExpectationEntry | null;
  is_partial: boolean;
  is_holdout: boolean;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
    } else if (entry.endsWith(".txt")) {
      out.push(full);
    }
  }
  return out;
}

let _cache: { specimens: Specimen[]; total: number } | null = null;

export function listSpecimens(): Specimen[] {
  if (_cache) return _cache.specimens;

  const expectationsRaw = readFileSync(EXPECT_PATH, "utf-8");
  const expectations = JSON.parse(expectationsRaw) as Record<
    string,
    ExpectationEntry
  >;

  const absPaths = walk(SPEC_ROOT).sort();
  const specimens: Specimen[] = absPaths.map((abs) => {
    const rel = relative(SPEC_ROOT, abs).split("\\").join("/");
    const expectation = expectations[rel] ?? null;
    return {
      path: rel,
      text: readFileSync(abs, "utf-8"),
      expectation,
      is_partial: expectation?.is_partial === true,
      is_holdout: expectation?.holdout === true,
    };
  });

  _cache = { specimens, total: specimens.length };
  return specimens;
}

export function specimenByPath(path: string): Specimen | undefined {
  return listSpecimens().find((s) => s.path === path);
}

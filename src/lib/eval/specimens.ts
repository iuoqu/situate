import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

/**
 * Server-side reader for the story-gate-eval specimen suite. Walks both:
 *
 *   - story-gate-eval/specimens/         — main labeled corpus (36+ pieces)
 *   - story-gate-eval/diagnoser_experiments/<name>/specimens/
 *                                         — per-diagnoser experiment
 *                                           contrast-pair sets
 *
 * Both contribute to the catalog the /dev/eval UI sees. Experiment paths
 * are prefixed `diagnoser_experiments/<name>/` so they're visually
 * distinct in the table. Each experiment directory MAY have its own
 * `expectations.json`; entries are merged in (experiment-local takes
 * priority over the main file when keys collide).
 *
 * Cached for process lifetime — specimens don't change between requests.
 */

const REPO_ROOT = process.cwd();
const SPEC_ROOT = join(REPO_ROOT, "story-gate-eval", "specimens");
const EXPECT_PATH = join(REPO_ROOT, "story-gate-eval", "expectations.json");
const EXPERIMENTS_ROOT = join(
  REPO_ROOT,
  "story-gate-eval",
  "diagnoser_experiments",
);

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
  /**
   * POSIX-style path:
   * - main corpus: relative to specimens/, e.g. `synthetic/faqtiao/01_mood.txt`
   * - experiments: prefixed, e.g. `diagnoser_experiments/stakes_absent/specimens/01_father_son_with_K.txt`
   */
  path: string;
  text: string;
  expectation: ExpectationEntry | null;
  is_partial: boolean;
  is_holdout: boolean;
}

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
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

function loadExpectations(path: string): Record<string, ExpectationEntry> {
  if (!existsSync(path)) return {};
  try {
    const raw = readFileSync(path, "utf-8");
    return JSON.parse(raw) as Record<string, ExpectationEntry>;
  } catch {
    return {};
  }
}

let _cache: { specimens: Specimen[]; total: number } | null = null;

export function listSpecimens(): Specimen[] {
  if (_cache) return _cache.specimens;

  // Main expectations
  const mainExp = loadExpectations(EXPECT_PATH);

  const specimens: Specimen[] = [];

  // Main corpus
  for (const abs of walk(SPEC_ROOT).sort()) {
    const rel = relative(SPEC_ROOT, abs).split("\\").join("/");
    const expectation = mainExp[rel] ?? null;
    specimens.push({
      path: rel,
      text: readFileSync(abs, "utf-8"),
      expectation,
      is_partial: expectation?.is_partial === true,
      is_holdout: expectation?.holdout === true,
    });
  }

  // Each diagnoser experiment dir
  if (existsSync(EXPERIMENTS_ROOT)) {
    for (const expName of readdirSync(EXPERIMENTS_ROOT)) {
      const expDir = join(EXPERIMENTS_ROOT, expName);
      if (!statSync(expDir).isDirectory()) continue;
      const expSpecDir = join(expDir, "specimens");
      if (!existsSync(expSpecDir)) continue;

      // Experiment-local expectations override main when keyed by the
      // experiment-prefixed path
      const localExp = loadExpectations(join(expDir, "expectations.json"));

      for (const abs of walk(expSpecDir).sort()) {
        const fileName = relative(expSpecDir, abs).split("\\").join("/");
        // Full path used in the UI catalog (prefixed for clarity)
        const fullPath = `diagnoser_experiments/${expName}/specimens/${fileName}`;
        // The local expectations.json keys by bare filename; main may also
        // contain an entry keyed by the full prefixed path.
        const expectation =
          mainExp[fullPath] ?? localExp[fileName] ?? null;
        specimens.push({
          path: fullPath,
          text: readFileSync(abs, "utf-8"),
          expectation,
          is_partial: expectation?.is_partial === true,
          is_holdout: expectation?.holdout === true,
        });
      }
    }
  }

  _cache = { specimens, total: specimens.length };
  return specimens;
}

export function specimenByPath(path: string): Specimen | undefined {
  return listSpecimens().find((s) => s.path === path);
}

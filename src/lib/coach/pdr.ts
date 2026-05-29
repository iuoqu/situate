/**
 * Pair Distinguish Rate — the metric that decides whether a focused
 * diagnoser is ready for production. For N contrast pairs, PDR is the
 * fraction where the model correctly classifies the positive specimen
 * as positive AND the negative specimen as negative.
 *
 * One PDR is computed per (diagnoser, provider). A diagnoser is
 * candidate-ready for production when avg PDR across providers ≥ 0.70.
 */

import type { DiagnoserDefinition } from "./diagnosers/registry";

export interface PairTestRow {
  pair_id: string; // shared stem, e.g. "01_father_son"
  positive_path: string; // e.g. "..._with_K.txt"
  negative_path: string; // e.g. "..._no_K.txt"
  /** Per provider: result on positive specimen */
  positive: Record<string, PairCellResult>;
  /** Per provider: result on negative specimen */
  negative: Record<string, PairCellResult>;
}

export interface PairCellResult {
  judgment: unknown;
  classified: "positive" | "negative" | "ambiguous";
  /** True iff classified === expected */
  correct: boolean;
  raw_meta?: {
    duration_ms: number;
    input_tokens: number;
    output_tokens: number;
  };
  error?: string;
}

export interface PDRReport {
  diagnoser_id: string;
  by_provider: Record<
    string,
    {
      total_pairs: number;
      distinguished: number;
      rate: number;
      // For each pair: did this provider get BOTH sides right?
      pair_results: Array<{
        pair_id: string;
        positive_correct: boolean;
        negative_correct: boolean;
        distinguished: boolean;
        // store the model's actual classifications for inspection
        positive_classified: "positive" | "negative" | "ambiguous";
        negative_classified: "positive" | "negative" | "ambiguous";
      }>;
    }
  >;
  /** Average across providers — what we use to decide readiness. */
  overall_rate: number;
  total_pairs: number;
  providers_run: string[];
}

/**
 * Pair up contrast specimens by filename stem. Looks for pairs of files
 * sharing a stem where one ends in `positive_suffix` and the other in
 * `negative_suffix`.
 *
 * Example: 01_father_son_with_K.txt + 01_father_son_no_K.txt
 *          → pair_id = "01_father_son", positive_suffix = "_with_K.txt"
 */
export function findContrastPairs(
  paths: string[],
  positive_suffix: string,
  negative_suffix: string,
): Array<{ pair_id: string; positive: string; negative: string }> {
  const positives = new Map<string, string>(); // stem → path
  const negatives = new Map<string, string>();
  for (const p of paths) {
    const filename = p.split("/").pop() ?? p;
    if (filename.endsWith(positive_suffix)) {
      const stem = filename.slice(0, -positive_suffix.length);
      positives.set(stem, p);
    } else if (filename.endsWith(negative_suffix)) {
      const stem = filename.slice(0, -negative_suffix.length);
      negatives.set(stem, p);
    }
  }
  const pairs: Array<{ pair_id: string; positive: string; negative: string }> = [];
  for (const [stem, pos] of positives) {
    const neg = negatives.get(stem);
    if (neg) {
      pairs.push({ pair_id: stem, positive: pos, negative: neg });
    }
  }
  pairs.sort((a, b) => a.pair_id.localeCompare(b.pair_id));
  return pairs;
}

/**
 * Compute PDR from a set of completed pair results.
 */
export function computePDR(
  diagnoser: DiagnoserDefinition,
  rows: PairTestRow[],
  providers: string[],
): PDRReport {
  const by_provider: PDRReport["by_provider"] = {};
  for (const prov of providers) {
    let distinguished = 0;
    const pair_results: PDRReport["by_provider"][string]["pair_results"] = [];
    for (const row of rows) {
      const pos = row.positive[prov];
      const neg = row.negative[prov];
      const pos_correct = pos?.correct === true;
      const neg_correct = neg?.correct === true;
      const dist = pos_correct && neg_correct;
      if (dist) distinguished += 1;
      pair_results.push({
        pair_id: row.pair_id,
        positive_correct: pos_correct,
        negative_correct: neg_correct,
        distinguished: dist,
        positive_classified: pos?.classified ?? "ambiguous",
        negative_classified: neg?.classified ?? "ambiguous",
      });
    }
    by_provider[prov] = {
      total_pairs: rows.length,
      distinguished,
      rate: rows.length === 0 ? 0 : distinguished / rows.length,
      pair_results,
    };
  }
  const provRates = providers
    .map((p) => by_provider[p]?.rate ?? 0)
    .filter((r) => Number.isFinite(r));
  const overall_rate =
    provRates.length === 0
      ? 0
      : provRates.reduce((a, b) => a + b, 0) / provRates.length;

  return {
    diagnoser_id: diagnoser.id,
    by_provider,
    overall_rate,
    total_pairs: rows.length,
    providers_run: providers,
  };
}

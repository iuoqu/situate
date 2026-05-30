import { focusedCall, type FocusedCallResult } from "../_call";

/**
 * center_consensus — dual-family, cheap-model, multi-sample structural
 * robustness check.
 *
 * Why two families: a single cheap model run N times measures that
 * model's sticky preferences, NOT the prose's actual structural
 * robustness. Empirically (Chengdu modified specimen), qwen-plus × 7
 * gave 7/7 on the bell sentence — but 4 diverse expensive models
 * actually split 2-2 between the bell and other candidates. The
 * single-family multi-sample was giving false strong consensus.
 *
 * The fix: run two cheap models from two different training families
 * in parallel. Only when BOTH families converge on the same sentence
 * with strong intra-family consensus do we declare a real center.
 *
 *   - qwen-flash (Alibaba family)   × N samples at temp 0.9
 *   - deepseek-v4-flash (DeepSeek family) × N samples at temp 0.9
 *     (with thinking mode disabled for speed)
 *
 * Joint consensus =
 *   both families ≥ 65% intra-family agreement
 *   AND both top picks normalize to the same sentence
 *
 * Cost at N=7 per family is roughly $0.001 per coach-preview run —
 * negligible vs the 4-model expensive fanout.
 */

export const DIAGNOSER_ID = "center_consensus";
export const STATUS = "experimental";

const N_SAMPLES_PER_FAMILY = 7;
const SAMPLE_TEMPERATURE = 0.9;

interface FamilyConfig {
  provider_id: string;
  display_name: string;
}

/**
 * Two cheap providers from different training families. Thinking-mode
 * disable is now handled at the provider config level (see
 * defaultExtraBody in _call.ts) so we don't need per-family knobs
 * here. If you add a third family, just include its provider id.
 */
const FAMILIES: FamilyConfig[] = [
  {
    provider_id: "alibaba:qwen-flash",
    display_name: "Qwen Flash",
  },
  {
    provider_id: "deepseek:deepseek-v4-flash",
    display_name: "DeepSeek V4 Flash",
  },
];

export const SYSTEM_PROMPT = `你只回答一个问题：这段散文的"重心"落在哪一句话上？

定义
- 重心 = 这段 prose 在结构上**最不可被删除**的那一句。删掉它，整段散文的存在意义损失最多
- 不是出现频率最高的内容、不是最长的句子
- 通常是与周围语义/声调断裂的那一句，或者承担转变的那一句
- 如果文本是纯氛围描写、无单一重心，输出"无单一重心"

重要：不要做任何解释或理由。只输出一个字段：center_quote。

通过 submit_center 工具输出。`;

export const TOOL_NAME = "submit_center";
export const TOOL_DESCRIPTION =
  "Quote the single sentence that is the structural center of gravity.";

export const INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    center_quote: {
      type: "string",
      description:
        "Quote one full sentence from the prose verbatim. Or '无单一重心' if the prose has no single structural center.",
    },
  },
  required: ["center_quote"],
};

interface SingleVote {
  center_quote: string;
}

export interface FamilyConsensus {
  provider_id: string;
  display_name: string;
  /** Distinct quotes that appeared, sorted by vote count desc. */
  votes: Array<{ quote: string; count: number; bucket_key: string }>;
  /** Top-voted quote. Empty string if zero successful calls. */
  top_quote: string;
  /** How many samples voted for top_quote. */
  top_count: number;
  /** Successful samples (failed calls excluded). */
  total_samples: number;
  /** top_count / total_samples. */
  agreement_pct: number;
  /** Bucket key of the top quote (used to compare families). */
  top_bucket_key: string;
  /** Failed sample error messages. */
  errors: string[];
}

export interface CenterConsensusResult {
  families: FamilyConsensus[];
  /**
   * Joint consensus: present only if both families have strong
   * intra-family agreement (>= 65%) AND their top picks share the
   * same normalized bucket key.
   */
  joint_consensus: {
    is_strong: boolean;
    quote: string;
  };
}

const STRONG_THRESHOLD = 0.65;

/**
 * Normalize a quote for fuzzy bucketing: strip whitespace, punctuation,
 * keep first ~18 chars as the bucket key. Two quotes hashing to the
 * same key are treated as the same vote.
 */
function bucketKey(quote: string): string {
  return quote
    .replace(/\s+/g, "")
    .replace(/[。，、；：！？.,;:!?""''""'"]/g, "")
    .slice(0, 18);
}

/**
 * Two quotes "share anchor" when one is a normalized prefix of the
 * other. Different models often quote the same structural anchor at
 * different sentence boundaries — e.g. one picks "下午两点。我躺在
 * 床上刷手机。" and another picks the longer "下午两点。我躺在床上刷
 * 手机。早餐没吃...". The longer is a continuation of the shorter;
 * they're the same anchor.
 *
 * Used both for intra-family bucket merging (consolidate scattered
 * votes that point at the same passage) and for joint-family
 * consensus (recognize when two families converge on the same anchor
 * even though their quote boundaries differ).
 */
function sharesAnchor(a: string, b: string): boolean {
  const norm = (s: string): string =>
    s.replace(/\s+/g, "").replace(/[。，、；：！？.,;:!?""''""'"]/g, "");
  const na = norm(a);
  const nb = norm(b);
  if (na.length < 8 || nb.length < 8) return false;
  return na.startsWith(nb) || nb.startsWith(na);
}

/**
 * After initial bucketing, merge any pair of buckets whose quotes
 * share an anchor (prefix-of relation). The longer quote becomes the
 * canonical representation; vote counts are summed. Process from
 * highest-count first so the most-supported representation tends to
 * survive.
 */
function mergeFuzzyBuckets(
  votes: Array<{ quote: string; count: number; bucket_key: string }>,
): Array<{ quote: string; count: number; bucket_key: string }> {
  const sorted = [...votes].sort((a, b) => b.count - a.count);
  const merged: Array<{ quote: string; count: number; bucket_key: string }> = [];
  for (const v of sorted) {
    const target = merged.find((m) => sharesAnchor(m.quote, v.quote));
    if (target) {
      target.count += v.count;
      // Keep the longer quote as canonical so the displayed anchor
      // carries the most context the family produced.
      if (v.quote.length > target.quote.length) {
        target.quote = v.quote;
        target.bucket_key = v.bucket_key;
      }
    } else {
      merged.push({ ...v });
    }
  }
  return merged.sort((a, b) => b.count - a.count);
}

async function runFamily(
  family: FamilyConfig,
  text: string,
): Promise<FamilyConsensus> {
  const calls: Promise<FocusedCallResult<SingleVote>>[] = Array.from(
    { length: N_SAMPLES_PER_FAMILY },
    () =>
      focusedCall<SingleVote>({
        text,
        systemPrompt: SYSTEM_PROMPT,
        toolName: TOOL_NAME,
        toolDescription: TOOL_DESCRIPTION,
        inputSchema: INPUT_SCHEMA,
        providerId: family.provider_id,
        temperature: SAMPLE_TEMPERATURE,
      }),
  );
  const settled = await Promise.allSettled(calls);
  const quotes: string[] = [];
  const errors: string[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled") {
      const q = r.value.result.center_quote?.trim() ?? "";
      if (q) quotes.push(q);
    } else {
      errors.push(
        r.reason instanceof Error ? r.reason.message : String(r.reason),
      );
    }
  }

  const buckets = new Map<
    string,
    { quote: string; count: number; bucket_key: string }
  >();
  for (const q of quotes) {
    const key = bucketKey(q);
    const existing = buckets.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      buckets.set(key, { quote: q, count: 1, bucket_key: key });
    }
  }
  const initialVotes = Array.from(buckets.values()).sort(
    (a, b) => b.count - a.count,
  );
  // Second pass: merge buckets whose quotes share an anchor (one is a
  // normalized prefix of another). Different samples often quote the
  // same passage at different sentence boundaries; without this merge
  // the strict 18-char bucket key splits them into separate votes.
  const votes = mergeFuzzyBuckets(initialVotes);
  const top = votes[0] ?? { quote: "", count: 0, bucket_key: "" };

  return {
    provider_id: family.provider_id,
    display_name: family.display_name,
    votes,
    top_quote: top.quote,
    top_count: top.count,
    total_samples: quotes.length,
    agreement_pct:
      quotes.length === 0 ? 0 : top.count / quotes.length,
    top_bucket_key: top.bucket_key,
    errors,
  };
}

export async function runCenterConsensus(
  text: string,
  _providerId?: string, // ignored — diagnoser uses its own internal providers
): Promise<{
  result: CenterConsensusResult;
  raw: unknown;
  meta: {
    provider_id: string;
    model: string;
    duration_ms: number;
    input_tokens: number;
    output_tokens: number;
    samples_per_family: number;
    family_count: number;
  };
}> {
  const startedAt = Date.now();
  const familyResults = await Promise.all(
    FAMILIES.map((f) => runFamily(f, text)),
  );

  // Joint consensus: both families strong AND their top picks share
  // an anchor (one is a normalized prefix of the other). Strict
  // bucket-key equality misses cases like Qwen 7/7 on a long quote
  // and DeepSeek 6/7 on its prefix — they point at the same anchor.
  const allStrong = familyResults.every(
    (f) => f.agreement_pct >= STRONG_THRESHOLD && f.total_samples > 0,
  );
  const allShareAnchor =
    familyResults.length > 0 &&
    familyResults.every((f) =>
      sharesAnchor(f.top_quote, familyResults[0].top_quote),
    );
  const jointStrong = allStrong && allShareAnchor;

  // For the canonical joint quote, pick the longest top among families
  // — it carries the most context (the shorter ones are prefixes).
  const jointQuote = jointStrong
    ? familyResults
        .map((f) => f.top_quote)
        .reduce((longest, q) => (q.length > longest.length ? q : longest), "")
    : "";

  return {
    result: {
      families: familyResults,
      joint_consensus: {
        is_strong: jointStrong,
        quote: jointQuote,
      },
    },
    raw: { familyResults },
    meta: {
      provider_id: "dual-family",
      model: FAMILIES.map((f) => f.provider_id).join("+"),
      duration_ms: Date.now() - startedAt,
      input_tokens: 0,
      output_tokens: 0,
      samples_per_family: N_SAMPLES_PER_FAMILY,
      family_count: FAMILIES.length,
    },
  };
}

import { focusedCall, type FocusedCallResult } from "../_call";

/**
 * center_consensus — single-question, cheap-model, multi-sample
 * structural robustness check.
 *
 * The other inferred-style diagnosers run 4 different expensive models
 * once each, and we compute inter-model consensus on the "center of
 * gravity" sentence. That measures cross-reader agreement.
 *
 * This diagnoser measures a different thing: intra-model robustness
 * under sampling noise. We run qwen-plus N times at high temperature
 * and check whether it keeps picking the same sentence. If a sentence
 * is structurally load-bearing — independently identifiable as the
 * pivot — even a less sophisticated reader will keep landing on it.
 * If the prose has no single structural center, the votes will scatter.
 *
 * Two robustness signals, two purposes:
 *   - inter-model consensus (existing): "do different careful readers agree?"
 *   - intra-model sampling (this): "is the structural cue robust under noise?"
 *
 * Both pointing to the same sentence = strong center.
 * Either alone = soft center.
 * Both diverging = no center.
 *
 * Cost: roughly 1/100 of the existing 4-model fan-out at N=7 samples.
 */

export const DIAGNOSER_ID = "center_consensus";
export const STATUS = "experimental";

const N_SAMPLES = 7;
const SAMPLE_TEMPERATURE = 0.9;
const CHEAP_PROVIDER_ID = "alibaba:qwen-plus";

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

export interface CenterConsensusResult {
  /** All distinct quotes that appeared, sorted by vote count desc. */
  votes: Array<{ quote: string; count: number }>;
  /** The top-voted quote. Empty string if no successful calls. */
  top_quote: string;
  /** How many samples voted for top_quote. */
  top_count: number;
  /** Total successful samples (failed calls excluded). */
  total_samples: number;
  /** top_count / total_samples. */
  agreement_pct: number;
  /** Failed sample messages, if any. */
  errors: string[];
}

/**
 * Normalize a quote for fuzzy bucketing: strip whitespace and
 * punctuation differences, keep first ~16 chars as the bucket key.
 * Two quotes hashing to the same key are treated as the same vote.
 */
function bucketKey(quote: string): string {
  return quote
    .replace(/\s+/g, "")
    .replace(/[。，、；：！？.,;:!?""''""'"]/g, "")
    .slice(0, 16);
}

export async function runCenterConsensus(
  text: string,
  _providerId?: string, // ignored — this diagnoser uses its own cheap model
): Promise<{
  result: CenterConsensusResult;
  raw: unknown;
  meta: {
    provider_id: string;
    model: string;
    duration_ms: number;
    input_tokens: number;
    output_tokens: number;
    samples: number;
  };
}> {
  const startedAt = Date.now();
  const calls: Promise<FocusedCallResult<SingleVote>>[] = Array.from(
    { length: N_SAMPLES },
    () =>
      focusedCall<SingleVote>({
        text,
        systemPrompt: SYSTEM_PROMPT,
        toolName: TOOL_NAME,
        toolDescription: TOOL_DESCRIPTION,
        inputSchema: INPUT_SCHEMA,
        providerId: CHEAP_PROVIDER_ID,
        temperature: SAMPLE_TEMPERATURE,
      }),
  );
  const settled = await Promise.allSettled(calls);

  const quotes: string[] = [];
  const errors: string[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let lastModel = "qwen-plus";

  for (const r of settled) {
    if (r.status === "fulfilled") {
      const q = r.value.result.center_quote?.trim() ?? "";
      if (q) quotes.push(q);
      totalInputTokens += r.value.meta.input_tokens;
      totalOutputTokens += r.value.meta.output_tokens;
      lastModel = r.value.meta.model;
    } else {
      errors.push(
        r.reason instanceof Error ? r.reason.message : String(r.reason),
      );
    }
  }

  const buckets = new Map<string, { quote: string; count: number }>();
  for (const q of quotes) {
    const key = bucketKey(q);
    const existing = buckets.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      buckets.set(key, { quote: q, count: 1 });
    }
  }
  const votes = Array.from(buckets.values()).sort((a, b) => b.count - a.count);
  const top = votes[0] ?? { quote: "", count: 0 };

  return {
    result: {
      votes,
      top_quote: top.quote,
      top_count: top.count,
      total_samples: quotes.length,
      agreement_pct:
        quotes.length === 0 ? 0 : top.count / quotes.length,
      errors,
    },
    raw: { quotes, errors },
    meta: {
      provider_id: CHEAP_PROVIDER_ID,
      model: lastModel,
      duration_ms: Date.now() - startedAt,
      input_tokens: totalInputTokens,
      output_tokens: totalOutputTokens,
      samples: N_SAMPLES,
    },
  };
}

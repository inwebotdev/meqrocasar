/**
 * USD-per-million-token pricing for the OpenRouter models this app calls
 * for structured generation, used to estimate the cost of a run from its
 * reported token usage. Pure data + one pure function: no network, no
 * `fs`, no `server-only`.
 *
 * Prices are illustrative OpenRouter list prices for DeepSeek/Qwen at the
 * time this layer was built and are not fetched live; update this table
 * if a model's pricing changes materially.
 */

export interface ModelPricing {
  /** USD per 1M input (prompt) tokens. */
  in: number;
  /** USD per 1M output (completion) tokens. */
  out: number;
}

export const MODEL_PRICING_USD_PER_MILLION: Record<string, ModelPricing> = {
  "qwen/qwen-2.5-72b-instruct": { in: 0.36, out: 0.4 },
  "deepseek/deepseek-chat": { in: 0.28, out: 0.42 },
};

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
}

/**
 * Estimates the USD cost of one call's token usage for `model`, from
 * `MODEL_PRICING_USD_PER_MILLION`. Returns `0` for an unknown model
 * (never throws) so a pricing-table gap degrades to "unknown cost", not
 * a crash.
 */
export function estimateCostUsd(model: string, usage: TokenUsage): number {
  const pricing = MODEL_PRICING_USD_PER_MILLION[model];
  if (!pricing) {
    return 0;
  }

  return (usage.promptTokens * pricing.in + usage.completionTokens * pricing.out) / 1_000_000;
}

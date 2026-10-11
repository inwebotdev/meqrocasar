/**
 * USD-per-million-token pricing for the OpenRouter models this app calls
 * for structured generation, used to estimate the cost of a run from its
 * reported token usage. Pure data + one pure function: no network, no
 * `fs`, no `server-only`.
 *
 * Prices are OpenRouter list prices (`GET /api/v1/models`, `pricing.prompt`/
 * `pricing.completion`, USD per token, here multiplied by 1e6) as read at
 * the time `docs/ai-step-benchmark.md` was produced (see that file for the
 * date) and are not fetched live; update this table if a model's pricing
 * changes materially, or when adding a new candidate to the benchmark.
 */

export interface ModelPricing {
  /** USD per 1M input (prompt) tokens. */
  in: number;
  /** USD per 1M output (completion) tokens. */
  out: number;
}

export const MODEL_PRICING_USD_PER_MILLION: Record<string, ModelPricing> = {
  "qwen/qwen-2.5-7b-instruct": { in: 0.1, out: 0.2 },
  "qwen/qwen-2.5-72b-instruct": { in: 0.36, out: 0.4 },
  "qwen/qwen3-30b-a3b": { in: 0.12, out: 0.5 },
  "deepseek/deepseek-chat": { in: 0.32, out: 0.89 },
  "deepseek/deepseek-v3.2": { in: 0.259, out: 0.8 },
  "z-ai/glm-4.5-air": { in: 0.13, out: 0.85 },
  "moonshotai/kimi-k2": { in: 0.57, out: 2.3 },
  "google/gemini-2.5-flash": { in: 0.3, out: 2.5 },
  "google/gemini-2.5-flash-lite": { in: 0.1, out: 0.4 },
  "openai/gpt-4.1-mini": { in: 0.4, out: 1.6 },
  "mistralai/mistral-small-3.2-24b-instruct": { in: 0.09375, out: 0.25 },
  "qwen/qwen3.8-flash": { in: 0.15, out: 0.47 },
  "z-ai/glm-5.3-flash": { in: 0.15, out: 0.5 },
  "deepseek/deepseek-v4.1-flash": { in: 0.3, out: 1.2 },
  "z-ai/glm-4.7-flash": { in: 0.0605, out: 0.4 },
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

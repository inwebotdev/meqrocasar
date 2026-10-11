import { describe, expect, it } from "vitest";

import { estimateCostUsd, MODEL_PRICING_USD_PER_MILLION } from "./pricing";

describe("estimateCostUsd", () => {
  it("prices a Qwen call from its prompt/completion token counts", () => {
    const cost = estimateCostUsd("qwen/qwen-2.5-72b-instruct", {
      promptTokens: 1_000_000,
      completionTokens: 1_000_000,
    });

    expect(cost).toBeCloseTo(
      MODEL_PRICING_USD_PER_MILLION["qwen/qwen-2.5-72b-instruct"]!.in +
        MODEL_PRICING_USD_PER_MILLION["qwen/qwen-2.5-72b-instruct"]!.out,
      6,
    );
  });

  it("prices a DeepSeek call", () => {
    const cost = estimateCostUsd("deepseek/deepseek-chat", {
      promptTokens: 500_000,
      completionTokens: 100_000,
    });

    expect(cost).toBeCloseTo(0.5 * 0.32 + 0.1 * 0.89, 6);
  });

  it("returns 0 for an unknown model rather than throwing", () => {
    expect(
      estimateCostUsd("some/unknown-model", { promptTokens: 1000, completionTokens: 1000 }),
    ).toBe(0);
  });
});

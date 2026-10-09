import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { LlmAttempt, LlmFailure, LlmSuccess } from "@/domain/ai/openrouter";
import { SYSTEM_PROMPT_VERSION } from "@/domain/ai/prompt";
import type { ImageProvider } from "@/domain/images/provider";
import type { QuizAnswers } from "@/domain/quiz/schema";

import { ExperienceResultSchema, LlmExperienceSchema, type LlmExperience } from "./schema";
import { createExperienceService, type ExperienceLlm } from "./service";
import type { ExperiencePhoto } from "./types";

function loadValidLlmExperience(): LlmExperience {
  const text = readFileSync(
    path.resolve(__dirname, "../../../test/fixtures/llm/valid.json"),
    "utf-8",
  );
  return LlmExperienceSchema.parse(JSON.parse(text));
}

const answers: QuizAnswers = {
  style: "rustic_vineyard",
  setting: "day_vineyard",
  experience: "intimate_boutique",
  mustHave: "wine_tasting",
};

const THREE_PHOTOS: ExperiencePhoto[] = [
  { url: "https://images.unsplash.com/photo-1", alt: "alt 1", credit: "credit 1" },
  { url: "https://images.unsplash.com/photo-2", alt: "alt 2", credit: "credit 2" },
  { url: "https://images.unsplash.com/photo-3", alt: "alt 3", credit: "credit 3" },
];

function makeLlmStub(result: LlmSuccess | LlmFailure): ExperienceLlm {
  return {
    generate: () => Promise.resolve(result),
  };
}

function makeImagesStub(photosSequence: readonly ExperiencePhoto[][]) {
  const calls: { queries: string[]; answers: QuizAnswers }[] = [];
  let index = 0;

  const provider: ImageProvider = {
    async resolve(queries, resolvedAnswers) {
      calls.push({ queries, answers: resolvedAnswers });
      const photos = photosSequence[Math.min(index, photosSequence.length - 1)] ?? THREE_PHOTOS;
      index += 1;
      return photos;
    },
  };

  return { provider, calls };
}

const fixedGeneratedAt = new Date("2026-01-01T00:00:00.000Z");

function fixedClock(): Date {
  return fixedGeneratedAt;
}

describe("createExperienceService", () => {
  it("returns an LLM-backed result validating against ExperienceResultSchema", async () => {
    const llmValue = loadValidLlmExperience();
    const attempts: LlmAttempt[] = [
      { model: "primary-model", outcome: "ok", status: 200, durationMs: 120 },
    ];
    const llm = makeLlmStub({
      ok: true,
      value: llmValue,
      model: "primary-model",
      attempts,
      usage: { promptTokens: 10, completionTokens: 20 },
    });
    const { provider: images, calls } = makeImagesStub([THREE_PHOTOS]);

    const service = createExperienceService({ llm, images, now: () => 1000, clock: fixedClock });
    const result = await service.generate(answers);

    expect(ExperienceResultSchema.safeParse(result).success).toBe(true);
    expect(result.meta.fallbackUsed).toBe(false);
    expect(result.meta.model).toBe("primary-model");
    expect(result.meta.promptVersion).toBe(SYSTEM_PROMPT_VERSION);
    expect(result.meta.generatedAt).toBe(fixedGeneratedAt.toISOString());
    expect(result.meta.attempts).toEqual([
      { model: "primary-model", outcome: "ok", durationMs: 120 },
    ]);
    expect(result.meta.usage).toEqual({ promptTokens: 10, completionTokens: 20 });
    expect(result.photos).toHaveLength(3);
    expect(result.conceptTitle).toBe(llmValue.conceptTitle);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.queries).toEqual(llmValue.searchQueries);
    expect(calls[0]?.answers).toEqual(answers);
  });

  it("falls back to the local experience when the llm fails, keeping its attempts", async () => {
    const attempts: LlmAttempt[] = [
      { model: "primary-model", outcome: "http-error", status: 500, durationMs: 50 },
      { model: "fallback-model", outcome: "network", durationMs: 30 },
    ];
    const llm = makeLlmStub({ ok: false, attempts });
    const { provider: images, calls } = makeImagesStub([THREE_PHOTOS]);

    const service = createExperienceService({ llm, images, now: () => 2000, clock: fixedClock });
    const result = await service.generate(answers);

    expect(ExperienceResultSchema.safeParse(result).success).toBe(true);
    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.meta.model).toBe("local-fallback");
    expect(result.meta.attempts).toEqual([
      { model: "primary-model", outcome: "http-error", durationMs: 50 },
      { model: "fallback-model", outcome: "network", durationMs: 30 },
    ]);
    expect(result.photos).toHaveLength(3);
    expect(calls).toHaveLength(1);
  });

  it("uses the local fallback when no llm is configured, with no attempts", async () => {
    const { provider: images, calls } = makeImagesStub([THREE_PHOTOS]);

    const service = createExperienceService({ images, now: () => 3000, clock: fixedClock });
    const result = await service.generate(answers);

    expect(ExperienceResultSchema.safeParse(result).success).toBe(true);
    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.meta.model).toBe("local-fallback");
    expect(result.meta.attempts).toBeUndefined();
    expect(result.photos).toHaveLength(3);
    expect(calls).toHaveLength(1);
  });

  it("falls back to the local experience when the assembled llm result fails final validation", async () => {
    const llmValue = loadValidLlmExperience();
    const attempts: LlmAttempt[] = [{ model: "primary-model", outcome: "ok", durationMs: 90 }];
    const llm = makeLlmStub({ ok: true, value: llmValue, model: "primary-model", attempts });
    // First call (for the llm-backed candidate) returns an invalid photo
    // count, forcing ExperienceResultSchema to reject it; the second call
    // (during the defensive local fallback) returns a valid 3-photo set.
    const { provider: images, calls } = makeImagesStub([THREE_PHOTOS.slice(0, 2), THREE_PHOTOS]);

    const service = createExperienceService({ llm, images, now: () => 4000, clock: fixedClock });
    const result = await service.generate(answers);

    expect(ExperienceResultSchema.safeParse(result).success).toBe(true);
    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.meta.model).toBe("local-fallback");
    expect(result.photos).toHaveLength(3);
    expect(calls).toHaveLength(2);
  });
});

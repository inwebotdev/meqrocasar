import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type {
  LlmAttempt,
  StructuredClient,
  StructuredFailure,
  StructuredSuccess,
} from "@/domain/ai/structured";
import type { NarrationRef, NarrationService } from "@/domain/audio/service";
import type { ImageProvider } from "@/domain/images/provider";
import type { Kb, KbVenue } from "@/domain/kb/types";
import type { QuizAnswers } from "@/domain/quiz/schema";
import { foldFacets, transcriptFromLegacyAnswers, type Transcript } from "@/domain/quiz/transcript";

import { ExperienceResultSchema, LlmExperienceV2Schema, type LlmExperienceV2 } from "./schema";
import { createExperienceService } from "./service";
import type { ExperiencePhoto } from "./types";

function loadValidV2(): LlmExperienceV2 {
  const text = readFileSync(
    path.resolve(__dirname, "../../../test/fixtures/llm/valid-v2.json"),
    "utf-8",
  );
  return LlmExperienceV2Schema.parse(JSON.parse(text));
}

const answers: QuizAnswers = {
  style: "rustic_vineyard",
  setting: "day_vineyard",
  experience: "intimate_boutique",
  mustHave: "wine_tasting",
};

const transcript: Transcript = transcriptFromLegacyAnswers(answers);

const VINEDOS_VENUE: KbVenue = {
  id: "v_vinedos-la-redonda",
  name: "Viñedos La Redonda",
  aliases: ["La Redonda"],
  zone: "ezequiel_montes",
  municipality: "Ezequiel Montes",
  rating: 4.6,
  userRatingCount: 3100,
  capacityEstimate: 550,
  capacityApprox: true,
  oneLiner: "El viñedo más grande y antiguo de Querétaro.",
  whyWeddings:
    "Sus jardines entre vides centenarias crean el escenario perfecto para una boda rústica.",
  highlights: ["Jardines", "Vendimia Anual", "Eventos al Aire Libre"],
  facets: {
    styles: ["rustic_vineyard"],
    settings: ["day_vineyard"],
    scale: ["grand"],
    experiences: ["wine_tasting"],
    budget: "medio_alto",
  },
  photos: [{ kind: "registry", ref: "entrada-vinedo-barril", attribution: "shawn kim" }],
  source: "curated",
  confidence: 1,
};

const SECOND_VENUE: KbVenue = {
  id: "v_hacienda-lagunillas",
  name: "Hacienda Lagunillas",
  aliases: [],
  zone: "huimilpan",
  municipality: "Huimilpan",
  capacityEstimate: 120,
  capacityApprox: true,
  oneLiner: "Patio colonial íntimo entre jardines.",
  whyWeddings: "Su jardín íntimo es perfecto para una ceremonia cercana.",
  highlights: ["Jardín", "Capilla", "Terraza"],
  facets: {
    styles: ["colonial", "garden_romantic"],
    settings: ["sunset_garden"],
    scale: ["intimate"],
    experiences: ["gourmet_banquet"],
    budget: "exclusivo",
  },
  photos: [{ kind: "registry", ref: "patio-cantera-rosa", attribution: "Annie Wood" }],
  source: "curated",
  confidence: 1,
};

const kb: Kb = { zones: [], experiences: [], venues: [VINEDOS_VENUE, SECOND_VENUE] };

const THREE_PHOTOS: ExperiencePhoto[] = [
  { url: "https://images.unsplash.com/photo-1", alt: "alt 1", credit: "credit 1" },
  { url: "https://images.unsplash.com/photo-2", alt: "alt 2", credit: "credit 2" },
  { url: "https://images.unsplash.com/photo-3", alt: "alt 3", credit: "credit 3" },
];

function makeLlmStub(
  result: StructuredSuccess<LlmExperienceV2> | StructuredFailure,
): StructuredClient<LlmExperienceV2> {
  return { generate: () => Promise.resolve(result) };
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
    async resolveOne() {
      return THREE_PHOTOS[0] as ExperiencePhoto;
    },
  };

  return { provider, calls };
}

const fixedGeneratedAt = new Date("2026-01-01T00:00:00.000Z");

function fixedClock(): Date {
  return fixedGeneratedAt;
}

describe("createExperienceService — transcript input", () => {
  it("returns an LLM-backed result with real KB venue data, validating against ExperienceResultSchema", async () => {
    const llmValue = loadValidV2();
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

    const service = createExperienceService({
      llm,
      images,
      kb,
      now: () => 1000,
      clock: fixedClock,
    });
    const result = await service.generate({ transcript: transcript });

    expect(ExperienceResultSchema.safeParse(result).success).toBe(true);
    expect(result.meta.fallbackUsed).toBe(false);
    expect(result.meta.model).toBe("primary-model");
    expect(result.meta.generatedAt).toBe(fixedGeneratedAt.toISOString());
    expect(result.transcript).toEqual(transcript);
    expect(result.facets).toEqual(foldFacets(transcript.entries));
    expect(result.answers).toBeUndefined();
    expect(result.itineraryHint).toBe(llmValue.itineraryHint);

    expect(result.venues[0]?.id).toBe("v_vinedos-la-redonda");
    expect(result.venues[0]?.role).toBe("principal");
    expect(result.venues[0]?.rating).toBe(4.6);
    expect(result.venues).toHaveLength(2);

    // The recommended venue's own registry photo fills slot 1; images.resolve
    // still gets called for the remaining slots.
    expect(result.photos).toHaveLength(3);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.queries).toEqual(llmValue.searchQueries);
  });

  it("prefers the recommended venues' real photos over the searched ones for the first slots", async () => {
    const llmValue = loadValidV2();
    const llm = makeLlmStub({
      ok: true,
      value: llmValue,
      model: "primary-model",
      attempts: [{ model: "primary-model", outcome: "ok", durationMs: 90 }],
    });
    const { provider: images } = makeImagesStub([THREE_PHOTOS]);

    const service = createExperienceService({
      llm,
      images,
      kb,
      now: () => 1000,
      clock: fixedClock,
    });
    const result = await service.generate({ transcript: transcript });

    const venuePhotoUrl = result.venues.find((venue) => venue.photoUrl)?.photoUrl;
    expect(venuePhotoUrl).toBeDefined();
    expect(result.photos.some((photo) => photo.url === venuePhotoUrl)).toBe(true);
  });

  it("falls back to the local experience when the llm fails, keeping its attempts and attaching facets/transcript", async () => {
    const attempts: LlmAttempt[] = [
      { model: "primary-model", outcome: "http-error", status: 500, durationMs: 50 },
      { model: "fallback-model", outcome: "network", durationMs: 30 },
    ];
    const llm = makeLlmStub({ ok: false, attempts });
    const { provider: images, calls } = makeImagesStub([THREE_PHOTOS]);

    const service = createExperienceService({
      llm,
      images,
      kb,
      now: () => 2000,
      clock: fixedClock,
    });
    const result = await service.generate({ transcript: transcript });

    expect(ExperienceResultSchema.safeParse(result).success).toBe(true);
    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.meta.model).toBe("local-fallback");
    expect(result.meta.attempts).toEqual([
      { model: "primary-model", outcome: "http-error", durationMs: 50 },
      { model: "fallback-model", outcome: "network", durationMs: 30 },
    ]);
    expect(result.transcript).toEqual(transcript);
    expect(result.facets).toEqual(foldFacets(transcript.entries));
    expect(result.photos).toHaveLength(3);
    expect(calls).toHaveLength(1);
  });

  it("uses the local fallback when no llm is configured, with no attempts", async () => {
    const { provider: images, calls } = makeImagesStub([THREE_PHOTOS]);

    const service = createExperienceService({ images, kb, now: () => 3000, clock: fixedClock });
    const result = await service.generate({ transcript: transcript });

    expect(ExperienceResultSchema.safeParse(result).success).toBe(true);
    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.meta.model).toBe("local-fallback");
    expect(result.meta.attempts).toBeUndefined();
    expect(result.photos).toHaveLength(3);
    expect(calls).toHaveLength(1);
  });

  it("falls back to the local experience when the assembled llm result fails final validation", async () => {
    const llmValue = loadValidV2();
    const llm = makeLlmStub({
      ok: true,
      value: llmValue,
      model: "primary-model",
      attempts: [{ model: "primary-model", outcome: "ok", durationMs: 90 }],
    });
    // No venues in the KB (so no venue photo fills a slot) and the first
    // `images.resolve` call returns 0 photos, forcing `mergePhotos` down to
    // an empty array and `ExperienceResultSchema` to reject the candidate;
    // the second call (during the defensive local fallback) is the normal
    // 3-photo set.
    const emptyKb: Kb = { zones: [], experiences: [], venues: [] };
    const { provider: images, calls } = makeImagesStub([[], THREE_PHOTOS]);

    const service = createExperienceService({
      llm,
      images,
      kb: emptyKb,
      now: () => 4000,
      clock: fixedClock,
    });
    const result = await service.generate({ transcript: transcript });

    expect(ExperienceResultSchema.safeParse(result).success).toBe(true);
    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.photos).toHaveLength(3);
    expect(calls).toHaveLength(2);
  });
});

describe("createExperienceService — legacy QuizAnswers input", () => {
  it("still returns a result equivalent to the pre-transcript pipeline", async () => {
    const llmValue = loadValidV2();
    const llm = makeLlmStub({
      ok: true,
      value: llmValue,
      model: "primary-model",
      attempts: [{ model: "primary-model", outcome: "ok", durationMs: 100 }],
      usage: { promptTokens: 5, completionTokens: 15 },
    });
    const { provider: images, calls } = makeImagesStub([THREE_PHOTOS]);

    const service = createExperienceService({
      llm,
      images,
      kb,
      now: () => 1000,
      clock: fixedClock,
    });
    const result = await service.generate(answers);

    expect(ExperienceResultSchema.safeParse(result).success).toBe(true);
    expect(result.answers).toEqual(answers);
    expect(result.meta.fallbackUsed).toBe(false);
    expect(calls[0]?.answers).toEqual(answers);
  });

  it("falls back to the exact deterministic legacy experience when the llm fails", async () => {
    const llm = makeLlmStub({
      ok: false,
      attempts: [{ model: "primary-model", outcome: "timeout", durationMs: 8000 }],
    });
    const { provider: images } = makeImagesStub([THREE_PHOTOS]);

    const service = createExperienceService({
      llm,
      images,
      kb,
      now: () => 2000,
      clock: fixedClock,
    });
    const result = await service.generate(answers);

    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.answers).toEqual(answers);
    // Deterministic: the legacy fallback tables are keyed by exactly this answer combo.
    expect(result.conceptTitle).toBe("Día de Vendimia en los Viñedos de Ezequiel Montes");
  });
});

function makeNarrationStub(ref: NarrationRef): { service: NarrationService; scripts: string[] } {
  const scripts: string[] = [];
  const service: NarrationService = {
    ensure: async (script) => {
      scripts.push(script);
      return ref;
    },
  };
  return { service, scripts };
}

describe("createExperienceService — narration wiring", () => {
  it("attaches a 'ready' narration ref from the LLM path, ensuring it with the LLM's reelScript", async () => {
    const llmValue = loadValidV2();
    const llm = makeLlmStub({
      ok: true,
      value: llmValue,
      model: "primary-model",
      attempts: [{ model: "primary-model", outcome: "ok", durationMs: 90 }],
    });
    const { provider: images } = makeImagesStub([THREE_PHOTOS]);
    const ref: NarrationRef = {
      status: "ready",
      hash: "a".repeat(64),
      src: "/api/narration/" + "a".repeat(64),
      durationSec: 4.2,
      sentences: [{ text: llmValue.reelScript, startSec: 0, endSec: 4.2 }],
    };
    const { service: narration, scripts } = makeNarrationStub(ref);

    const service = createExperienceService({
      llm,
      images,
      kb,
      narration,
      now: () => 1000,
      clock: fixedClock,
    });
    const result = await service.generate({ transcript });

    expect(ExperienceResultSchema.safeParse(result).success).toBe(true);
    expect(result.narration).toEqual(ref);
    expect(scripts).toEqual([llmValue.reelScript]);
  });

  it("attaches a 'pending' narration ref from the local-fallback path, ensuring it with the deterministic reelScript", async () => {
    const { provider: images } = makeImagesStub([THREE_PHOTOS]);
    const ref: NarrationRef = {
      status: "pending",
      hash: "b".repeat(64),
      src: "/api/narration/" + "b".repeat(64),
    };
    const { service: narration, scripts } = makeNarrationStub(ref);

    const service = createExperienceService({
      images,
      kb,
      narration,
      now: () => 1000,
      clock: fixedClock,
    });
    const result = await service.generate({ transcript });

    expect(ExperienceResultSchema.safeParse(result).success).toBe(true);
    expect(result.narration).toEqual(ref);
    expect(scripts).toEqual([result.reelScript]);
  });

  it("omits narration entirely when the service resolves 'disabled'", async () => {
    const { provider: images } = makeImagesStub([THREE_PHOTOS]);
    const { service: narration } = makeNarrationStub({ status: "disabled" });

    const service = createExperienceService({
      images,
      kb,
      narration,
      now: () => 1000,
      clock: fixedClock,
    });
    const result = await service.generate({ transcript });

    expect(result.narration).toBeUndefined();
    expect(ExperienceResultSchema.safeParse(result).success).toBe(true);
  });

  it("omits narration entirely when no narration service is configured", async () => {
    const { provider: images } = makeImagesStub([THREE_PHOTOS]);

    const service = createExperienceService({ images, kb, now: () => 1000, clock: fixedClock });
    const result = await service.generate({ transcript });

    expect(result.narration).toBeUndefined();
  });
});

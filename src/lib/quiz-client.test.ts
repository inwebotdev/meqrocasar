import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import type { ExperienceResult } from "@/domain/experience/types";
import { resolvedStepFromCurated } from "@/domain/quiz/generated-step";
import { QUIZ_STEPS } from "@/domain/quiz/questions";
import type { Transcript } from "@/domain/quiz/transcript";

import { server } from "../../test/msw/server";
import { ApiClientError, fetchNextStep, generateExperienceFromTranscript } from "./quiz-client";

const QUIZ_NEXT_URL = "http://localhost/api/quiz/next";
const GENERATE_EXPERIENCE_URL = "http://localhost/api/generate-experience";

function fetchFor(url: string) {
  return (_input: string | URL | Request, init?: RequestInit) => fetch(url, init);
}

const emptyTranscript: Transcript = { entries: [] };

const oneEntryTranscript: Transcript = {
  entries: [
    {
      stepId: "style",
      question: QUIZ_STEPS[0]!.question,
      topic: QUIZ_STEPS[0]!.topic,
      chosen: {
        id: "rustic_vineyard",
        title: "Rústico Viñedo & Enológico",
        summary: "La pareja imagina una boda rústica entre viñedos.",
        facets: { style: "rustic_vineyard" },
        refs: { venueIds: ["v_vinedos-la-redonda"], experienceIds: [] },
      },
    },
  ],
};

const curatedMeta = {
  model: "local-fallback",
  durationMs: 12,
  cached: false,
  fallbackUsed: false,
  source: "static" as const,
  attempts: 0,
  promptVersion: "quiz-engine-v1",
};

const validResult: ExperienceResult = {
  conceptTitle: "Atardecer Dorado entre Viñedos",
  palette: [
    { hex: "#4B001A", name: "Vino Profundo" },
    { hex: "#944933", name: "Terracota" },
    { hex: "#E9A844", name: "Ámbar Bernal" },
    { hex: "#FCF9F3", name: "Lino" },
  ],
  narrative:
    "Una celebración íntima entre viñedos centenarios, con atardeceres dorados y copas de vino bajo las estrellas de Ezequiel Montes.",
  reelTagline: "Su historia, entre viñedos y atardeceres.",
  searchQueries: ["boda viñedo querétaro", "atardecer ezequiel montes", "cata de vinos boda"],
  venues: [],
  photos: [
    { url: "https://images.unsplash.com/photo-1", alt: "Viñedo", credit: "Autor A" },
    { url: "https://images.unsplash.com/photo-2", alt: "Atardecer", credit: "Autor B" },
    { url: "https://images.unsplash.com/photo-3", alt: "Cava", credit: "Autor C" },
  ],
  answers: {
    style: "rustic_vineyard",
    setting: "day_vineyard",
    experience: "intimate_boutique",
    mustHave: "wine_tasting",
  },
  meta: {
    model: "test-model",
    fallbackUsed: false,
    durationMs: 1234,
    generatedAt: "2026-01-01T00:00:00.000Z",
  },
};

describe("fetchNextStep", () => {
  it("returns the validated resolved step for a non-done result", async () => {
    const step = resolvedStepFromCurated(QUIZ_STEPS[0]!, 1);
    server.use(
      http.post(QUIZ_NEXT_URL, () =>
        HttpResponse.json({ ok: true, data: { done: false, step, meta: curatedMeta } }),
      ),
    );

    const result = await fetchNextStep(emptyTranscript, fetchFor(QUIZ_NEXT_URL));

    expect(result.done).toBe(false);
    if (!result.done) {
      expect(result.step.id).toBe("style");
      expect(result.step.options).toHaveLength(4);
    }
  });

  it("returns a done result", async () => {
    server.use(
      http.post(QUIZ_NEXT_URL, () =>
        HttpResponse.json({ ok: true, data: { done: true, meta: curatedMeta } }),
      ),
    );

    const result = await fetchNextStep(oneEntryTranscript, fetchFor(QUIZ_NEXT_URL));
    expect(result.done).toBe(true);
  });

  it("throws ApiClientError with the envelope's code on an error envelope", async () => {
    server.use(
      http.post(QUIZ_NEXT_URL, () =>
        HttpResponse.json(
          { ok: false, error: { code: "invalid_transcript", message: "Bad transcript" } },
          { status: 400 },
        ),
      ),
    );

    await expect(fetchNextStep(emptyTranscript, fetchFor(QUIZ_NEXT_URL))).rejects.toMatchObject({
      name: "ApiClientError",
      code: "invalid_transcript",
      status: 400,
      message: "Bad transcript",
    });
  });

  it("throws ApiClientError with code 'network' when the request fails outright", async () => {
    await expect(
      fetchNextStep(emptyTranscript, () => Promise.reject(new Error("boom"))),
    ).rejects.toMatchObject({ name: "ApiClientError", code: "network" });
  });

  it("throws ApiClientError with code 'invalid_response' when the step fails schema validation", async () => {
    server.use(
      http.post(QUIZ_NEXT_URL, () =>
        HttpResponse.json({
          ok: true,
          data: { done: false, step: { id: "x" }, meta: curatedMeta },
        }),
      ),
    );

    await expect(fetchNextStep(emptyTranscript, fetchFor(QUIZ_NEXT_URL))).rejects.toMatchObject({
      name: "ApiClientError",
      code: "invalid_response",
    });
  });
});

describe("generateExperienceFromTranscript", () => {
  it("posts { transcript } and returns the parsed result when the route accepts it", async () => {
    let capturedBody: unknown;
    server.use(
      http.post(GENERATE_EXPERIENCE_URL, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ ok: true, data: validResult });
      }),
    );

    const result = await generateExperienceFromTranscript(
      oneEntryTranscript,
      fetchFor(GENERATE_EXPERIENCE_URL),
    );

    expect(result.conceptTitle).toBe(validResult.conceptTitle);
    expect(capturedBody).toEqual({ transcript: oneEntryTranscript });
  });

  it("falls back to transcriptToLegacyAnswers on a 400 invalid_answers response", async () => {
    let callCount = 0;
    let secondBody: unknown;
    server.use(
      http.post(GENERATE_EXPERIENCE_URL, async ({ request }) => {
        callCount += 1;
        if (callCount === 1) {
          return HttpResponse.json(
            { ok: false, error: { code: "invalid_answers", message: "Bad answers" } },
            { status: 400 },
          );
        }
        secondBody = await request.json();
        return HttpResponse.json({ ok: true, data: validResult });
      }),
    );

    const result = await generateExperienceFromTranscript(
      oneEntryTranscript,
      fetchFor(GENERATE_EXPERIENCE_URL),
    );

    expect(result.conceptTitle).toBe(validResult.conceptTitle);
    expect(callCount).toBe(2);
    expect(secondBody).toEqual({
      style: "rustic_vineyard",
      setting: "sunset_garden",
      experience: "grand_traditional",
      mustHave: "wine_tasting",
    });
  });

  it("does not retry and rethrows on a non-invalid_answers error code", async () => {
    let callCount = 0;
    server.use(
      http.post(GENERATE_EXPERIENCE_URL, () => {
        callCount += 1;
        return HttpResponse.json(
          { ok: false, error: { code: "internal", message: "Boom" } },
          { status: 500 },
        );
      }),
    );

    await expect(
      generateExperienceFromTranscript(oneEntryTranscript, fetchFor(GENERATE_EXPERIENCE_URL)),
    ).rejects.toMatchObject({ name: "ApiClientError", code: "internal" });
    expect(callCount).toBe(1);
  });

  it("does not retry and rethrows on a network failure", async () => {
    await expect(
      generateExperienceFromTranscript(oneEntryTranscript, () => Promise.reject(new Error("boom"))),
    ).rejects.toMatchObject({ name: "ApiClientError", code: "network" });
  });
});

describe("ApiClientError re-export", () => {
  it("is the same error class api-client.ts throws", () => {
    const error = new ApiClientError({ code: "network", message: "offline" });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ApiClientError");
  });
});

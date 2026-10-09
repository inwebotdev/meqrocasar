import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import type { ExperienceResult } from "@/domain/experience/types";
import type { QuizAnswers } from "@/domain/quiz/schema";

import { server } from "../../test/msw/server";
import { ApiClientError, generateExperience } from "./api-client";

const GENERATE_EXPERIENCE_URL = "http://localhost/api/generate-experience";

const answers: QuizAnswers = {
  style: "rustic_vineyard",
  setting: "day_vineyard",
  experience: "intimate_boutique",
  mustHave: "wine_tasting",
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
  venues: [
    {
      id: "vinedos-la-redonda",
      name: "Viñedos La Redonda",
      zone: "Ezequiel Montes",
      municipality: "Ezequiel Montes",
      subtitle: "Viñedo boutique",
      capacity: 120,
      capacityApprox: true,
      features: ["Viñedo", "Cava", "Terraza"],
      priceCategory: "Medio-Alto",
      tags: ["vineyard", "wine"],
      photoId: "entrada-vinedo-barril",
      aliases: [],
      reason: "Coincide con el estilo rústico de viñedo elegido.",
      role: "principal",
    },
  ],
  photos: [
    { url: "https://images.unsplash.com/photo-1", alt: "Viñedo", credit: "Autor A" },
    { url: "https://images.unsplash.com/photo-2", alt: "Atardecer", credit: "Autor B" },
    { url: "https://images.unsplash.com/photo-3", alt: "Cava", credit: "Autor C" },
  ],
  answers,
  meta: {
    model: "test-model",
    fallbackUsed: false,
    durationMs: 1234,
    generatedAt: "2026-01-01T00:00:00.000Z",
  },
};

describe("generateExperience", () => {
  it("returns the parsed ExperienceResult on a 200 ok envelope", async () => {
    server.use(
      http.post(GENERATE_EXPERIENCE_URL, () => HttpResponse.json({ ok: true, data: validResult })),
    );

    const result = await generateExperience(answers, (_input, init) =>
      fetch(GENERATE_EXPERIENCE_URL, init),
    );

    expect(result.conceptTitle).toBe(validResult.conceptTitle);
    expect(result.venues).toHaveLength(1);
  });

  it("throws ApiClientError with the envelope's code on a 400 error envelope", async () => {
    server.use(
      http.post(GENERATE_EXPERIENCE_URL, () =>
        HttpResponse.json(
          { ok: false, error: { code: "invalid_answers", message: "Bad answers" } },
          { status: 400 },
        ),
      ),
    );

    await expect(
      generateExperience(answers, (_input, init) => fetch(GENERATE_EXPERIENCE_URL, init)),
    ).rejects.toMatchObject({
      name: "ApiClientError",
      code: "invalid_answers",
      status: 400,
      message: "Bad answers",
    });
  });

  it("throws ApiClientError with code 'network' when the request fails outright", async () => {
    await expect(
      generateExperience(answers, () => Promise.reject(new Error("boom"))),
    ).rejects.toMatchObject({ name: "ApiClientError", code: "network" });
  });

  it("throws ApiClientError with code 'invalid_response' when data fails schema validation", async () => {
    server.use(
      http.post(GENERATE_EXPERIENCE_URL, () =>
        HttpResponse.json({ ok: true, data: { conceptTitle: "x" } }),
      ),
    );

    await expect(
      generateExperience(answers, (_input, init) => fetch(GENERATE_EXPERIENCE_URL, init)),
    ).rejects.toMatchObject({ name: "ApiClientError", code: "invalid_response" });
  });

  it("ApiClientError carries its code, status and message", () => {
    const error = new ApiClientError({ code: "network", message: "offline" });
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("network");
    expect(error.message).toBe("offline");
    expect(error.status).toBeUndefined();
  });
});

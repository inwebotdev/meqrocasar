import { describe, expect, it } from "vitest";
import type { z } from "zod";

import type { ExperienceResult } from "@/domain/experience/types";

import {
  ExperienceResultSchema,
  LLM_EXPERIENCE_V2_JSON_SCHEMA,
  LlmExperienceV2Schema,
} from "./schema";

describe("LLM_EXPERIENCE_V2_JSON_SCHEMA", () => {
  it("is an object schema requiring all eight V2 response keys", () => {
    expect(LLM_EXPERIENCE_V2_JSON_SCHEMA.type).toBe("object");
    expect(LLM_EXPERIENCE_V2_JSON_SCHEMA.required).toEqual(
      expect.arrayContaining([
        "conceptTitle",
        "colorPalette",
        "narrative",
        "searchQueries",
        "recommendedVenues",
        "reelTagline",
        "itineraryHint",
        "reelScript",
      ]),
    );
    expect(LLM_EXPERIENCE_V2_JSON_SCHEMA.required).toHaveLength(8);
  });
});

describe("LlmExperienceV2Schema", () => {
  const validPayload = {
    conceptTitle: "Noche Virreinal en Casona de Cantera",
    colorPalette: [
      { hex: "#68182E", name: "Vino Tinto" },
      { hex: "#D4AF37", name: "Oro Cantera" },
      { hex: "#F5EDE0", name: "Lino Crudo" },
      { hex: "#2F4839", name: "Verde Musgo" },
    ],
    narrative:
      "Primer párrafo con al menos ciento veinte caracteres describiendo la boda soñada en Querétaro con todo lujo de detalle y emoción. " +
      "Segundo párrafo con más detalles sensoriales sobre la celebración y el entorno virreinal que la rodea.",
    searchQueries: [
      "colonial hacienda wedding",
      "cantera courtyard mexico",
      "candlelit night wedding",
    ],
    recommendedVenues: [
      {
        venueId: "v_casona-de-los-cinco-patios",
        reason: "Por su cantera rosa y patios virreinales que combinan con el estilo elegido.",
      },
    ],
    reelTagline: "Romance Virreinal con Cata de Vinos",
    itineraryHint: "Viernes: cata en La Redonda · Sábado: ceremonia en Lagunillas",
    reelScript:
      "Imaginen su Noche Virreinal entre los muros de cantera de la Casona de los Cinco Patios. Ahí, entre candiles y aromas de temporada, su historia de amor cobra vida.",
  };

  it("accepts a well-formed response referencing a venue by id", () => {
    expect(() => LlmExperienceV2Schema.parse(validPayload)).not.toThrow();
  });

  it("rejects a response missing itineraryHint", () => {
    const { itineraryHint, ...withoutHint } = validPayload;
    expect(itineraryHint).toBeDefined();
    expect(() => LlmExperienceV2Schema.parse(withoutHint)).toThrow();
  });

  it("rejects a response missing reelScript", () => {
    const { reelScript, ...withoutScript } = validPayload;
    expect(reelScript).toBeDefined();
    expect(() => LlmExperienceV2Schema.parse(withoutScript)).toThrow();
  });

  it("rejects a reelScript longer than 320 chars", () => {
    expect(() =>
      LlmExperienceV2Schema.parse({ ...validPayload, reelScript: "x".repeat(321) }),
    ).toThrow();
  });

  it("rejects a recommendedVenues entry using the legacy name/zone shape", () => {
    expect(() =>
      LlmExperienceV2Schema.parse({
        ...validPayload,
        recommendedVenues: [{ name: "Venue", zone: "Zone", reason: "x".repeat(25) }],
      }),
    ).toThrow();
  });
});

describe("ExperienceResultSchema", () => {
  it("infers a type assignable to ExperienceResult (no `as ExperienceResult` cast needed)", () => {
    // Compile-time assertion: if `venues[].zone` or `tags` ever widen back to
    // `string`, this line stops compiling.
    const _check: ExperienceResult = {} as z.infer<typeof ExperienceResultSchema>;

    expect(_check).toBeDefined();
  });

  it("accepts a transcript-based result with no legacy `answers` but with transcript/facets/itineraryHint", () => {
    const result: ExperienceResult = {
      conceptTitle: "Vendimia Dorada entre Viñedos",
      palette: [
        { hex: "#5B1A2B", name: "Vino de Barrica" },
        { hex: "#C9A227", name: "Oro Vendimia" },
        { hex: "#D9C7A3", name: "Beige Barrica" },
        { hex: "#4B5E3A", name: "Verde Viñedo" },
      ],
      narrative: "Primer párrafo.\n\nSegundo párrafo.",
      reelTagline: "Vendimia Dorada",
      reelScript:
        "Imaginen su Vendimia Dorada entre las hileras de Viñedos La Redonda. Ahí, entre copas de vino y luz de atardecer, su historia de amor cobra vida.",
      searchQueries: ["vineyard wedding", "golden hour wedding", "wine cellar reception"],
      venues: [
        {
          id: "v_vinedos-la-redonda",
          name: "Viñedos La Redonda",
          zone: "Ezequiel Montes",
          municipality: "Ezequiel Montes",
          subtitle: "Viñedo histórico",
          capacity: 300,
          capacityApprox: true,
          features: ["Viñedo", "Cava", "Terraza"],
          priceCategory: "Medio-Alto",
          tags: [],
          aliases: [],
          reason: "Conecta con el estilo rústico elegido.",
          role: "principal",
          rating: 4.6,
          userRatingCount: 3100,
          photoUrl: "/api/places/photo?name=places/abc/photos/p1&w=800",
          photoAttribution: "Fulano",
        },
      ],
      photos: [
        { url: "https://images.unsplash.com/photo-1", alt: "a", credit: "c" },
        { url: "https://images.unsplash.com/photo-2", alt: "b", credit: "c" },
        { url: "https://images.unsplash.com/photo-3", alt: "c", credit: "c" },
      ],
      transcript: {
        entries: [
          {
            stepId: "style",
            question: "¿Qué estilo?",
            topic: "Estilo",
            chosen: {
              id: "rustic_vineyard",
              title: "Rústico Viñedo",
              summary: "Rústico Viñedo",
              facets: { style: "rustic_vineyard" },
              refs: { venueIds: [], experienceIds: [] },
            },
          },
        ],
      },
      facets: { style: "rustic_vineyard" },
      itineraryHint: "Viernes: cata · Sábado: ceremonia",
      meta: {
        model: "qwen/qwen3-30b-a3b",
        fallbackUsed: false,
        durationMs: 500,
        generatedAt: new Date(0).toISOString(),
      },
    };

    expect(ExperienceResultSchema.safeParse(result).success).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import type { z } from "zod";

import type { ExperienceResult } from "@/domain/experience/types";

import { ExperienceResultSchema, LLM_EXPERIENCE_JSON_SCHEMA, LlmExperienceSchema } from "./schema";

describe("LLM_EXPERIENCE_JSON_SCHEMA", () => {
  it("is an object schema requiring all six LLM response keys", () => {
    expect(LLM_EXPERIENCE_JSON_SCHEMA.type).toBe("object");
    expect(LLM_EXPERIENCE_JSON_SCHEMA.required).toEqual(
      expect.arrayContaining([
        "conceptTitle",
        "colorPalette",
        "narrative",
        "searchQueries",
        "recommendedVenues",
        "reelTagline",
      ]),
    );
    expect(LLM_EXPERIENCE_JSON_SCHEMA.required).toHaveLength(6);
  });
});

describe("LlmExperienceSchema", () => {
  it("accepts a well-formed LLM response", () => {
    const payload = {
      conceptTitle: "Noche Virreinal en Casona de Cantera",
      colorPalette: [
        { hex: "#68182E", name: "Vino Tinto" },
        { hex: "#D4AF37", name: "Oro Cantera" },
        { hex: "#F5EDE0", name: "Lino Crudo" },
        { hex: "#2F4839", name: "Verde Musgo" },
      ],
      narrative:
        "Primer párrafo con al menos ciento veinte caracteres describiendo la boda soñada en Querétaro con todo lujo de detalle y emoción. ".repeat(
          1,
        ) +
        "Segundo párrafo con más detalles sensoriales sobre la celebración y el entorno virreinal que la rodea.",
      searchQueries: [
        "colonial hacienda wedding",
        "cantera courtyard mexico",
        "candlelit night wedding",
      ],
      recommendedVenues: [
        {
          name: "Casona de los Cinco Patios",
          zone: "Centro Histórico",
          reason: "Por su cantera rosa y patios virreinales que combinan con el estilo elegido.",
        },
      ],
      reelTagline: "Romance Virreinal con Cata de Vinos",
    };

    expect(() => LlmExperienceSchema.parse(payload)).not.toThrow();
  });

  it("rejects an invalid hex color", () => {
    const base = LlmExperienceSchema.parse;
    expect(() =>
      base({
        conceptTitle: "Título válido de boda",
        colorPalette: [
          { hex: "not-a-hex", name: "Vino Tinto" },
          { hex: "#D4AF37", name: "Oro Cantera" },
          { hex: "#F5EDE0", name: "Lino Crudo" },
          { hex: "#2F4839", name: "Verde Musgo" },
        ],
        narrative: "x".repeat(130),
        searchQueries: ["query one here", "query two here", "query three here"],
        recommendedVenues: [{ name: "Venue", zone: "Zone", reason: "x".repeat(25) }],
        reelTagline: "Tagline válido",
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
});

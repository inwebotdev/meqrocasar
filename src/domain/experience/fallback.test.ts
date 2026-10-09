import { describe, expect, it } from "vitest";

import { EXPERIENCE_IDS, MUST_HAVE_IDS, SETTING_IDS, STYLE_IDS } from "@/domain/quiz/questions";
import type { QuizAnswers } from "@/domain/quiz/schema";

import { assembleVenues, buildFallbackExperience } from "./fallback";
import { ExperienceResultSchema } from "./schema";

function allAnswerCombinations(): QuizAnswers[] {
  const combos: QuizAnswers[] = [];

  for (const style of STYLE_IDS) {
    for (const setting of SETTING_IDS) {
      for (const experience of EXPERIENCE_IDS) {
        for (const mustHave of MUST_HAVE_IDS) {
          combos.push({ style, setting, experience, mustHave });
        }
      }
    }
  }

  return combos;
}

describe("buildFallbackExperience", () => {
  const combos = allAnswerCombinations();

  it("covers all 4 x 3 x 3 x 4 = 144 answer combinations", () => {
    expect(combos).toHaveLength(144);
  });

  it("produces a result validating against ExperienceResultSchema for every combination", () => {
    for (const answers of combos) {
      const fallback = buildFallbackExperience(answers);
      const candidate = {
        ...fallback,
        meta: {
          model: "fallback",
          fallbackUsed: true,
          durationMs: 0,
          generatedAt: new Date(0).toISOString(),
        },
      };

      const result = ExperienceResultSchema.safeParse(candidate);
      expect(result.success, JSON.stringify(result.success ? null : result.error.issues)).toBe(
        true,
      );
    }
  });

  it("is deterministic: the same answers always produce the same result", () => {
    const answers: QuizAnswers = {
      style: "colonial",
      setting: "night_casona",
      experience: "grand_traditional",
      mustHave: "callejoneada",
    };

    expect(buildFallbackExperience(answers)).toEqual(buildFallbackExperience(answers));
  });

  it("always returns exactly 2 venues and 3 photos", () => {
    for (const answers of combos.slice(0, 20)) {
      const fallback = buildFallbackExperience(answers);
      expect(fallback.venues).toHaveLength(2);
      expect(fallback.photos).toHaveLength(3);
      expect(fallback.venues[0]?.role).toBe("principal");
      expect(fallback.venues[1]?.role).toBe("destacada");
    }
  });
});

describe("assembleVenues", () => {
  const answers: QuizAnswers = {
    style: "rustic_vineyard",
    setting: "day_vineyard",
    experience: "intimate_boutique",
    mustHave: "wine_tasting",
  };

  it("maps matched LLM venues and marks the first as principal", () => {
    const venues = assembleVenues(
      [
        {
          name: "Viñedos La Redonda",
          zone: "Ezequiel Montes",
          reason: "Por su conexión con el estilo rústico y los viñedos elegidos por la pareja.",
        },
      ],
      answers,
    );

    expect(venues[0]?.id).toBe("vinedos-la-redonda");
    expect(venues[0]?.role).toBe("principal");
    expect(venues).toHaveLength(2);
    expect(venues[1]?.role).toBe("destacada");
  });

  it("drops unmatched venues and fills with rankVenues", () => {
    const venues = assembleVenues(
      [{ name: "Hacienda Inventada del Sol", zone: "Nowhere", reason: "x".repeat(25) }],
      answers,
    );

    expect(venues).toHaveLength(2);
    expect(venues.every((venue) => venue.name !== "Hacienda Inventada del Sol")).toBe(true);
  });

  it("dedupes repeated venues", () => {
    const venues = assembleVenues(
      [
        { name: "Viñedos La Redonda", zone: "Ezequiel Montes", reason: "x".repeat(25) },
        { name: "La Redonda", zone: "Ezequiel Montes", reason: "y".repeat(25) },
      ],
      answers,
    );

    const ids = venues.map((venue) => venue.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

import { describe, expect, it } from "vitest";

import type { QuizAnswers } from "@/domain/quiz/schema";

import { matchVenue, normalizeName, rankVenues } from "./match";

describe("normalizeName", () => {
  it("lowercases, strips accents/punctuation and drops stop words", () => {
    expect(normalizeName("Viñedos La Redonda")).toBe("redonda");
    expect(normalizeName("Hacienda Galindo (Fiesta Americana)")).toBe("galindo fiesta americana");
  });

  it("collapses repeated whitespace", () => {
    expect(normalizeName("  Casona   de   los   5   Patios ")).toBe("casona 5 patios");
  });
});

describe("matchVenue", () => {
  it("resolves an exact alias match", () => {
    expect(matchVenue("Casona de los 5 Patios")?.id).toBe("casona-cinco-patios");
  });

  it("resolves an exact name match regardless of accents/case", () => {
    expect(matchVenue("Viñedos la Redonda")?.id).toBe("vinedos-la-redonda");
  });

  it("resolves a parenthetical alias", () => {
    expect(matchVenue("Hacienda Galindo (Fiesta Americana)")?.id).toBe("hacienda-galindo");
  });

  it("returns undefined for a venue that doesn't exist", () => {
    expect(matchVenue("Hacienda Inventada del Sol")).toBeUndefined();
  });
});

describe("rankVenues", () => {
  it("ranks a vineyard venue first for a vineyard/wine answer set", () => {
    const answers: QuizAnswers = {
      style: "rustic_vineyard",
      setting: "day_vineyard",
      experience: "intimate_boutique",
      mustHave: "wine_tasting",
    };

    const [top] = rankVenues(answers, 2);
    expect(top?.tags).toContain("vineyard");
  });

  it("ranks the Casona first for a colonial/night/callejoneada answer set", () => {
    const answers: QuizAnswers = {
      style: "colonial",
      setting: "night_casona",
      experience: "grand_traditional",
      mustHave: "callejoneada",
    };

    const [top] = rankVenues(answers, 2);
    expect(top?.id).toBe("casona-cinco-patios");
  });

  it("is deterministic across repeated calls", () => {
    const answers: QuizAnswers = {
      style: "modern_elegant",
      setting: "sunset_garden",
      experience: "weekend_getaway",
      mustHave: "gourmet_mexican_banquet",
    };

    const first = rankVenues(answers, 3).map((venue) => venue.id);
    const second = rankVenues(answers, 3).map((venue) => venue.id);
    expect(first).toEqual(second);
  });

  it("respects the limit", () => {
    const answers: QuizAnswers = {
      style: "boho_chic",
      setting: "day_vineyard",
      experience: "grand_traditional",
      mustHave: "fireworks",
    };

    expect(rankVenues(answers, 1)).toHaveLength(1);
  });
});

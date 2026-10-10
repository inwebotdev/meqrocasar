import { describe, expect, it } from "vitest";

import type { QuizAnswers } from "@/domain/quiz/schema";
import { VENUE_TAG_VALUES } from "@/domain/venues/types";

import {
  budgetFromPriceCategory,
  facetsFromLegacyAnswers,
  facetsFromVenueTags,
  zoneValueFromLegacyZone,
} from "./legacy-map";
import { BUDGET_VALUES, STYLE_VALUES, ZONE_VALUES } from "./taxonomy";

describe("facetsFromLegacyAnswers", () => {
  it("maps a rustic-vineyard, intimate, wine-tasting answer set", () => {
    const answers: QuizAnswers = {
      style: "rustic_vineyard",
      setting: "day_vineyard",
      experience: "intimate_boutique",
      mustHave: "wine_tasting",
    };

    expect(facetsFromLegacyAnswers(answers)).toEqual({
      style: "rustic_vineyard",
      setting: "day_vineyard",
      scale: "intimate",
      experience: "wine_tasting",
    });
  });

  it("maps a weekend-getaway answer to both scale and lodging", () => {
    const answers: QuizAnswers = {
      style: "boho_chic",
      setting: "sunset_garden",
      experience: "weekend_getaway",
      mustHave: "callejoneada",
    };

    const facets = facetsFromLegacyAnswers(answers);
    expect(facets.scale).toBe("medium");
    expect(facets.lodging).toBe("needed");
    expect(facets.style).toBe("boho_desert");
    expect(facets.experience).toBe("callejoneada");
  });

  it("maps every style id onto a valid taxonomy style value", () => {
    const styleIds: QuizAnswers["style"][] = [
      "colonial",
      "rustic_vineyard",
      "boho_chic",
      "modern_elegant",
    ];

    for (const style of styleIds) {
      const facets = facetsFromLegacyAnswers({
        style,
        setting: "night_casona",
        experience: "grand_traditional",
        mustHave: "fireworks",
      });
      expect(STYLE_VALUES).toContain(facets.style);
    }
  });
});

describe("facetsFromVenueTags", () => {
  it("has a mapping for every old venue tag", () => {
    for (const tag of VENUE_TAG_VALUES) {
      expect(facetsFromVenueTags([tag])).not.toEqual({});
    }
  });

  it("folds multiple tags with later tags winning the same facet key", () => {
    expect(facetsFromVenueTags(["colonial", "hacienda", "modern"])).toEqual({
      style: "modern_elegant",
    });
  });

  it("maps a casona/colonial/night/callejoneada venue (Casona de los Cinco Patios)", () => {
    expect(facetsFromVenueTags(["colonial", "casona", "night", "callejoneada"])).toEqual({
      style: "colonial",
      setting: "night_casona",
      experience: "callejoneada",
    });
  });

  it("maps a vineyard/wine-cellar/intimate venue (Finca Sala Vivé by Freixenet)", () => {
    expect(facetsFromVenueTags(["vineyard", "wine_cellar", "night", "intimate"])).toEqual({
      style: "rustic_vineyard",
      experience: "wine_tasting",
      setting: "night_casona",
      scale: "intimate",
    });
  });
});

describe("budgetFromPriceCategory", () => {
  it("maps every old price category onto a valid taxonomy budget value", () => {
    expect(budgetFromPriceCategory("Medio")).toBe("medio");
    expect(budgetFromPriceCategory("Medio-Alto")).toBe("medio_alto");
    expect(budgetFromPriceCategory("Exclusivo")).toBe("exclusivo");
    expect(BUDGET_VALUES).toContain(budgetFromPriceCategory("Medio"));
  });
});

describe("zoneValueFromLegacyZone", () => {
  it("maps every old zone display string onto a valid taxonomy zone id", () => {
    const zones: Array<[string, string]> = [
      ["Centro Histórico", "centro_historico"],
      ["Huimilpan", "huimilpan"],
      ["Ezequiel Montes", "ezequiel_montes"],
      ["Bernal", "bernal"],
      ["Tequisquiapan", "tequisquiapan"],
      ["San Juan del Río", "san_juan_del_rio"],
      ["Colón", "colon"],
      ["El Marqués", "el_marques"],
    ];

    for (const [legacy, expected] of zones) {
      const value = zoneValueFromLegacyZone(
        legacy as Parameters<typeof zoneValueFromLegacyZone>[0],
      );
      expect(value).toBe(expected);
      expect(ZONE_VALUES).toContain(value);
    }
  });
});

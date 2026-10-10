import { describe, expect, it } from "vitest";

import {
  BUDGET_VALUES,
  EXPERIENCE_VALUES,
  FACET_KEYS,
  FACET_PRIORITY,
  FacetsSchema,
  facetLabel,
  LODGING_VALUES,
  SCALE_VALUES,
  SEASON_VALUES,
  SETTING_VALUES,
  STYLE_VALUES,
  ZONE_VALUES,
} from "./taxonomy";

describe("FACET_KEYS", () => {
  it("lists every facet key once, style first", () => {
    expect(FACET_KEYS).toEqual([
      "style",
      "setting",
      "scale",
      "zone",
      "experience",
      "budget",
      "lodging",
      "season",
    ]);
  });
});

describe("FACET_PRIORITY", () => {
  it("covers every facet key except style", () => {
    expect(FACET_PRIORITY).toEqual([
      "setting",
      "scale",
      "experience",
      "zone",
      "budget",
      "lodging",
      "season",
    ]);
    expect(FACET_PRIORITY).not.toContain("style");
  });
});

describe("closed enums", () => {
  it("has the exact style values", () => {
    expect(STYLE_VALUES).toEqual([
      "colonial",
      "rustic_vineyard",
      "boho_desert",
      "modern_elegant",
      "garden_romantic",
      "pueblo_magico",
    ]);
  });

  it("has the exact zone values", () => {
    expect(ZONE_VALUES).toEqual([
      "centro_historico",
      "huimilpan",
      "ezequiel_montes",
      "bernal",
      "tequisquiapan",
      "san_juan_del_rio",
      "colon",
      "el_marques",
      "cadereyta",
      "sierra_gorda",
    ]);
  });

  it("has the exact setting, scale, experience, budget, lodging and season values", () => {
    expect(SETTING_VALUES).toEqual([
      "sunset_garden",
      "night_casona",
      "day_vineyard",
      "rooftop_city",
      "chapel_courtyard",
    ]);
    expect(SCALE_VALUES).toEqual(["intimate", "medium", "grand"]);
    expect(EXPERIENCE_VALUES).toEqual([
      "wine_tasting",
      "vendimia",
      "callejoneada",
      "hot_air_balloon",
      "temazcal",
      "cheese_route",
      "fireworks",
      "gourmet_banquet",
      "mariachi_huapango",
      "sierra_gorda_escape",
    ]);
    expect(BUDGET_VALUES).toEqual(["medio", "medio_alto", "exclusivo"]);
    expect(LODGING_VALUES).toEqual(["needed", "not_needed"]);
    expect(SEASON_VALUES).toEqual(["primavera", "verano", "otono", "invierno"]);
  });
});

describe("FacetsSchema", () => {
  it("accepts an empty object (every facet optional)", () => {
    expect(FacetsSchema.parse({})).toEqual({});
  });

  it("accepts a partial, valid set of facets", () => {
    const parsed = FacetsSchema.parse({ style: "colonial", zone: "bernal" });
    expect(parsed).toEqual({ style: "colonial", zone: "bernal" });
  });

  it("rejects an unknown facet key (strict)", () => {
    expect(() => FacetsSchema.parse({ style: "colonial", extra: "nope" })).toThrow();
  });

  it("rejects a value outside the closed enum", () => {
    expect(() => FacetsSchema.parse({ style: "industrial" })).toThrow();
  });
});

describe("facetLabel", () => {
  it("returns the es-MX label for a style, zone and season", () => {
    expect(facetLabel("style", "rustic_vineyard")).toBe("Rústico Viñedo");
    expect(facetLabel("zone", "san_juan_del_rio")).toBe("San Juan del Río");
    expect(facetLabel("season", "otono")).toBe("Otoño");
  });

  it("has a label for every value of every facet", () => {
    for (const value of STYLE_VALUES) expect(facetLabel("style", value)).toBeTruthy();
    for (const value of SETTING_VALUES) expect(facetLabel("setting", value)).toBeTruthy();
    for (const value of SCALE_VALUES) expect(facetLabel("scale", value)).toBeTruthy();
    for (const value of ZONE_VALUES) expect(facetLabel("zone", value)).toBeTruthy();
    for (const value of EXPERIENCE_VALUES) expect(facetLabel("experience", value)).toBeTruthy();
    for (const value of BUDGET_VALUES) expect(facetLabel("budget", value)).toBeTruthy();
    for (const value of LODGING_VALUES) expect(facetLabel("lodging", value)).toBeTruthy();
    for (const value of SEASON_VALUES) expect(facetLabel("season", value)).toBeTruthy();
  });
});

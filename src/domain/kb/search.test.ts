import { describe, expect, it } from "vitest";

import {
  experiencesFor,
  getExperience,
  getVenue,
  getZone,
  scoreVenue,
  searchVenues,
} from "./search";

describe("scoreVenue", () => {
  it("scores a vineyard venue higher as more facets match", () => {
    const venue = getVenue("v_vinedos-la-redonda");
    if (!venue) throw new Error("fixture missing");

    const noMatch = scoreVenue(venue, { style: "modern_elegant" });
    const styleMatch = scoreVenue(venue, { style: "rustic_vineyard" });
    const styleAndExperience = scoreVenue(venue, {
      style: "rustic_vineyard",
      experience: "wine_tasting",
    });

    expect(styleMatch).toBeGreaterThan(noMatch);
    expect(styleAndExperience).toBeGreaterThan(styleMatch);
  });
});

describe("searchVenues", () => {
  it("ranks vineyard venues first for a rustic-vineyard, wine-tasting facet set", () => {
    const results = searchVenues({
      facets: { style: "rustic_vineyard", experience: "wine_tasting" },
      limit: 3,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.facets.styles).toContain("rustic_vineyard");
    expect(results[0]?.facets.experiences).toContain("wine_tasting");
  });

  it("ranks the Casona first for a colonial, night-casona, callejoneada facet set", () => {
    const results = searchVenues({
      facets: { style: "colonial", setting: "night_casona", experience: "callejoneada" },
    });

    expect(results[0]?.id).toBe("v_casona-cinco-patios");
  });

  it("is deterministic: the same facets always produce the same order", () => {
    const facets = { style: "colonial" as const, setting: "night_casona" as const };
    const first = searchVenues({ facets }).map((venue) => venue.id);
    const second = searchVenues({ facets }).map((venue) => venue.id);
    expect(first).toEqual(second);
  });

  it("filters by zone when given", () => {
    const results = searchVenues({ facets: {}, zone: "tequisquiapan" });
    for (const venue of results) {
      expect(venue.zone).toBe("tequisquiapan");
    }
  });

  it("respects limit", () => {
    const results = searchVenues({ facets: {}, limit: 2 });
    expect(results).toHaveLength(2);
  });
});

describe("experiencesFor", () => {
  it("ranks a wine-tasting experience above an unrelated one for a wine-tasting facet", () => {
    const results = experiencesFor({ experience: "wine_tasting" }, 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.facets.experiences).toContain("wine_tasting");
  });

  it("respects limit", () => {
    const results = experiencesFor({}, 3);
    expect(results).toHaveLength(3);
  });
});

describe("getVenue / getExperience / getZone", () => {
  it("resolves a known venue, experience and zone id", () => {
    expect(getVenue("v_casona-cinco-patios")?.name).toBe("Casona de los Cinco Patios");
    expect(getExperience("vendimia-la-redonda")?.name).toBeTruthy();
    expect(getZone("bernal")?.name).toBe("Bernal");
  });

  it("returns undefined for an unknown id", () => {
    expect(getVenue("v_does_not_exist")).toBeUndefined();
    expect(getExperience("does_not_exist")).toBeUndefined();
  });
});

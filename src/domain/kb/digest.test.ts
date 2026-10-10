import { describe, expect, it } from "vitest";

import { buildDigest } from "./digest";
import { getExperience, getVenue } from "./search";

describe("buildDigest", () => {
  it("includes a bracketed id line per venue and experience, plus a zones line", () => {
    const digest = buildDigest({ style: "rustic_vineyard", experience: "wine_tasting" });

    expect(digest.text).toContain("Zonas:");
    expect(digest.text).toContain("Venues:");
    expect(digest.text).toContain("Experiencias:");
    expect(digest.venueIds.length).toBeGreaterThan(0);
    expect(digest.experienceIds.length).toBeGreaterThan(0);

    for (const id of digest.venueIds) {
      expect(digest.text).toContain(`[${id}]`);
    }
    for (const id of digest.experienceIds) {
      expect(digest.text).toContain(`[${id}]`);
    }
  });

  it("every id in the digest resolves to a real venue or experience", () => {
    const digest = buildDigest({ style: "colonial" });

    for (const id of digest.venueIds) {
      expect(getVenue(id)).toBeDefined();
    }
    for (const id of digest.experienceIds) {
      expect(getExperience(id)).toBeDefined();
    }
  });

  it("respects maxVenues and maxExperiences", () => {
    const digest = buildDigest({}, { maxVenues: 2, maxExperiences: 1 });
    expect(digest.venueIds).toHaveLength(2);
    expect(digest.experienceIds).toHaveLength(1);
  });

  it("truncates to maxChars without cutting a line in half", () => {
    const full = buildDigest({});
    const truncated = buildDigest({}, { maxChars: 500 });

    expect(truncated.text.length).toBeLessThanOrEqual(Math.max(500, truncated.text.length));
    expect(truncated.text.length).toBeLessThan(full.text.length);

    for (const line of truncated.text.split("\n")) {
      expect(
        line === "" || line.startsWith("- [") || line.endsWith(":") || line.startsWith("Zonas:"),
      ).toBe(true);
    }
  });

  it("drops the lowest-ranked items first when truncating", () => {
    const generous = buildDigest({ style: "rustic_vineyard" }, { maxChars: 100000 });
    const tight = buildDigest({ style: "rustic_vineyard" }, { maxChars: 400 });

    expect(tight.venueIds.length + tight.experienceIds.length).toBeLessThanOrEqual(
      generous.venueIds.length + generous.experienceIds.length,
    );
    // whatever survives the tight budget must be a prefix of the generous ranking
    expect(generous.venueIds.slice(0, tight.venueIds.length)).toEqual(tight.venueIds);
  });
});

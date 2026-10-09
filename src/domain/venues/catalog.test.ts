import { describe, expect, it } from "vitest";

import { getPhoto } from "@/domain/media/photos";
import { QUIZ_STEPS } from "@/domain/quiz/questions";

import { getVenue, VENUES, venuesByZone, ZONES } from "./catalog";
import { matchVenue } from "./match";

describe("VENUES catalog", () => {
  it("has at least 9 real venues plus zone-level entries", () => {
    expect(VENUES.length).toBeGreaterThanOrEqual(11);
  });

  it("has unique ids and names", () => {
    const ids = VENUES.map((venue) => venue.id);
    const names = VENUES.map((venue) => venue.name);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
  });

  it("every photoId exists in the photo registry", () => {
    for (const venue of VENUES) {
      expect(() => getPhoto(venue.photoId)).not.toThrow();
    }
  });

  it("every venue's zone is one of ZONES", () => {
    for (const venue of VENUES) {
      expect(ZONES).toContain(venue.zone);
    }
  });

  it("every PRD zone is represented by at least one venue", () => {
    for (const zone of ZONES) {
      expect(venuesByZone(zone).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("every venue has 3 features and a non-empty subtitle/capacity", () => {
    for (const venue of VENUES) {
      expect(venue.features).toHaveLength(3);
      expect(venue.subtitle.length).toBeGreaterThan(0);
      expect(venue.capacity).toBeGreaterThan(0);
    }
  });
});

describe("getVenue / venuesByZone", () => {
  it("resolves a known venue by id", () => {
    expect(getVenue("casona-cinco-patios")?.name).toBe("Casona de los Cinco Patios");
  });

  it("returns undefined for an unknown id", () => {
    expect(getVenue("not-a-venue")).toBeUndefined();
  });

  it("filters venues by zone", () => {
    const venues = venuesByZone("Ezequiel Montes");
    expect(venues.length).toBeGreaterThanOrEqual(1);
    for (const venue of venues) {
      expect(venue.zone).toBe("Ezequiel Montes");
    }
  });
});

describe("quiz venue hints resolve to real catalog venues", () => {
  it("every quiz option's venueHint matches a catalog venue", () => {
    for (const step of QUIZ_STEPS) {
      for (const option of step.options) {
        const match = matchVenue(option.venueHint);
        expect(match, `${step.id}/${option.id} venueHint "${option.venueHint}"`).toBeDefined();
      }
    }
  });
});

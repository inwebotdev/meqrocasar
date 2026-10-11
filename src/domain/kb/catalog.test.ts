import { describe, expect, it } from "vitest";

import { loadKb } from "./load";
import { buildCatalogVenues, buildCatalogZones } from "./catalog";

describe("buildCatalogVenues", () => {
  it("projects every KB venue, including a real display zone label and priceCategory", () => {
    const kb = loadKb();
    const venues = buildCatalogVenues(kb);

    expect(venues).toHaveLength(kb.venues.length);
    for (const venue of venues) {
      expect(venue.zone.length).toBeGreaterThan(0);
      expect(["Medio", "Medio-Alto", "Exclusivo"]).toContain(venue.priceCategory);
      expect(venue.features).toHaveLength(3);
    }
  });

  it("resolves a real photoUrl for every venue (places, url or registry)", () => {
    const venues = buildCatalogVenues(loadKb());
    for (const venue of venues) {
      expect(venue.photoUrl, `venue ${venue.id} has no resolved photoUrl`).toBeDefined();
    }
  });

  it("orders curated venues before places-sourced ones", () => {
    const venues = buildCatalogVenues(loadKb());
    const firstPlacesIndex = venues.findIndex((venue) => !venue.curated);
    if (firstPlacesIndex === -1) return; // every venue is curated — nothing to assert

    expect(venues.slice(0, firstPlacesIndex).every((venue) => venue.curated)).toBe(true);
    expect(venues.slice(firstPlacesIndex).every((venue) => !venue.curated)).toBe(true);
  });

  it("orders venues within the same group by rating, descending", () => {
    const venues = buildCatalogVenues(loadKb());
    const curated = venues.filter((venue) => venue.curated);
    const ratings = curated.map((venue) => venue.rating ?? 0);
    const sorted = [...ratings].sort((a, b) => b - a);
    expect(ratings).toEqual(sorted);
  });
});

describe("buildCatalogZones", () => {
  it("returns all 10 taxonomy zones with non-empty display labels", () => {
    const zones = buildCatalogZones(loadKb());

    expect(zones).toHaveLength(10);
    for (const zone of zones) {
      expect(zone.label.length).toBeGreaterThan(0);
    }
  });

  it("includes Bernal with its real es-MX label", () => {
    const zones = buildCatalogZones(loadKb());
    expect(zones.find((zone) => zone.id === "bernal")?.label).toBe("Bernal");
  });
});

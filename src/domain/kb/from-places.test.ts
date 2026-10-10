import { describe, expect, it } from "vitest";

import type { Place } from "@/domain/places";

import {
  kbVenueFromPlace,
  mergeSnapshotIntoKb,
  zoneForPlace,
  type PlacesSnapshot,
} from "./from-places";
import { loadKb } from "./load";
import type { KbZone } from "./types";

const { zones, venues: seedVenues } = loadKb();

function zone(id: string): KbZone {
  const found = zones.find((z) => z.id === id);
  if (!found) throw new Error(`Unknown zone fixture: ${id}`);
  return found;
}

function winery(overrides: Partial<Place> = {}): Place {
  return {
    id: "places/winery-1",
    displayName: { text: "Viñedo de Prueba" },
    types: ["winery", "point_of_interest"],
    primaryType: "winery",
    location: { latitude: 20.6964, longitude: -99.8982 }, // ezequiel_montes centre
    rating: 4.7,
    userRatingCount: 512,
    formattedAddress: "Carretera a Bernal km 3, Ezequiel Montes, Qro.",
    websiteUri: "https://example.com/vinedo",
    googleMapsUri: "https://maps.google.com/?cid=42",
    priceLevel: "PRICE_LEVEL_MODERATE",
    editorialSummary: { text: "Un viñedo histórico con vista a la Peña de Bernal." },
    photos: [
      {
        name: "places/winery-1/photos/p1",
        authorAttributions: [{ displayName: "Jane Doe" }],
      },
      { name: "places/winery-1/photos/p2" },
    ],
    ...overrides,
  };
}

describe("kbVenueFromPlace", () => {
  it("maps a winery place into a places-sourced venue with heuristic facets", () => {
    const ezequielMontes = zone("ezequiel_montes");
    const venue = kbVenueFromPlace(winery(), "ezequiel_montes", ezequielMontes);

    expect(venue.id).toBe("v_placeswinery1");
    expect(venue.name).toBe("Viñedo de Prueba");
    expect(venue.zone).toBe("ezequiel_montes");
    expect(venue.source).toBe("places");
    expect(venue.placeId).toBe("places/winery-1");
    expect(venue.confidence).toBe(0.4);
    expect(venue.capacityEstimate).toBe(150);
    expect(venue.capacityApprox).toBe(true);
    expect(venue.whyWeddings).toBe("");
    expect(venue.oneLiner).toBe("Un viñedo histórico con vista a la Peña de Bernal.");
    expect(venue.rating).toBe(4.7);
    expect(venue.userRatingCount).toBe(512);
    expect(venue.websiteUri).toBe("https://example.com/vinedo");
    expect(venue.googleMapsUri).toBe("https://maps.google.com/?cid=42");

    expect(venue.facets.styles).toEqual(["rustic_vineyard"]);
    expect(venue.facets.settings).toEqual(["day_vineyard"]);
    expect(venue.facets.experiences).toEqual(["wine_tasting"]);
    expect(venue.facets.budget).toBe("medio_alto");

    expect(venue.highlights).toHaveLength(3);
    expect(venue.photos).toHaveLength(2);
    expect(venue.photos[0]).toEqual({
      kind: "places",
      ref: "places/winery-1/photos/p1",
      attribution: "Jane Doe",
    });
  });

  it("truncates a long one-liner to 120 characters", () => {
    const longText = "x".repeat(200);
    const venue = kbVenueFromPlace(
      winery({ editorialSummary: { text: longText } }),
      "ezequiel_montes",
      zone("ezequiel_montes"),
    );

    expect(venue.oneLiner.length).toBeLessThanOrEqual(120);
    expect(venue.oneLiner.endsWith("…")).toBe(true);
  });

  it("falls back to the zone's own facets for a place with no distinctive type", () => {
    const generic = winery({ types: ["restaurant"], primaryType: "restaurant" });
    const bernal = zone("bernal");
    const venue = kbVenueFromPlace(generic, "bernal", bernal);

    expect(venue.facets.styles).toEqual(bernal.facets.styles.slice(0, 1));
    expect(venue.facets.settings).toEqual(bernal.facets.settings.slice(0, 1));
    expect(venue.facets.experiences).toEqual([]);
  });
});

describe("zoneForPlace", () => {
  it("picks the zone whose centre is nearest, when within radius * 1.5", () => {
    const bernal = zone("bernal");
    const place = winery({
      location: { latitude: bernal.center.lat, longitude: bernal.center.lng },
    });
    expect(zoneForPlace(place, zones)).toBe("bernal");
  });

  it("falls back to the overall closest zone when outside every radius", () => {
    // Far out in the Gulf of Mexico: outside every zone's radius*1.5, but
    // still closest to whichever zone centre is geographically nearest.
    const place = winery({ location: { latitude: 19.0, longitude: -96.0 } });
    const result = zoneForPlace(place, zones);
    expect(zones.map((z) => z.id)).toContain(result);
  });

  it("falls back to the first zone when the place has no location", () => {
    const place = winery({ location: undefined });
    expect(zoneForPlace(place, zones)).toBe(zones[0]!.id);
  });
});

describe("mergeSnapshotIntoKb", () => {
  it("enriches a seed venue matched by name, keeping the seed's own copy", () => {
    const seed = seedVenues.find((v) => v.name === "Viñedos La Redonda");
    if (!seed) throw new Error("Expected seed venue 'Viñedos La Redonda' to exist.");

    const matchingPlace = winery({
      id: "places/la-redonda",
      displayName: { text: seed.name },
      rating: 4.6,
      userRatingCount: 3100,
    });

    const snapshot: PlacesSnapshot = {
      fetchedAt: "2026-01-01T00:00:00.000Z",
      queries: 1,
      places: [matchingPlace],
    };
    const merged = mergeSnapshotIntoKb(seedVenues, snapshot, zones);

    expect(merged).toHaveLength(seedVenues.length);

    const enriched = merged.find((v) => v.id === seed.id);
    expect(enriched).toBeDefined();
    expect(enriched?.name).toBe(seed.name);
    expect(enriched?.source).toBe("curated");
    expect(enriched?.confidence).toBe(1);
    expect(enriched?.facets).toEqual(seed.facets);
    expect(enriched?.placeId).toBe("places/la-redonda");
    expect(enriched?.rating).toBe(4.6);
    expect(enriched?.userRatingCount).toBe(3100);
    expect(enriched?.photos.length).toBeGreaterThan(seed.photos.length);
  });

  it("appends an unmatched place as a new, low-confidence venue", () => {
    const newPlace = winery({
      id: "places/brand-new",
      displayName: { text: "Hacienda Nunca Vista" },
    });
    const snapshot: PlacesSnapshot = {
      fetchedAt: "2026-01-01T00:00:00.000Z",
      queries: 1,
      places: [newPlace],
    };

    const merged = mergeSnapshotIntoKb(seedVenues, snapshot, zones);

    expect(merged).toHaveLength(seedVenues.length + 1);
    const added = merged.find((v) => v.placeId === "places/brand-new");
    expect(added).toBeDefined();
    expect(added?.source).toBe("places");
    expect(added?.confidence).toBe(0.4);
    expect(added?.zone).toBe("ezequiel_montes");
  });

  it("leaves unmatched seeds untouched", () => {
    const snapshot: PlacesSnapshot = {
      fetchedAt: "2026-01-01T00:00:00.000Z",
      queries: 0,
      places: [],
    };
    const merged = mergeSnapshotIntoKb(seedVenues, snapshot, zones);
    expect(merged).toEqual(seedVenues);
  });
});

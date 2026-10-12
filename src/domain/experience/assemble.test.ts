import { describe, expect, it } from "vitest";

import type { Facets } from "@/domain/kb/taxonomy";
import type { Kb, KbVenue } from "@/domain/kb/types";

import { assembleVenuesFromKb } from "./assemble";

function makeVenue(overrides: Partial<KbVenue> & { id: string }): KbVenue {
  return {
    name: "Venue",
    aliases: [],
    zone: "ezequiel_montes",
    municipality: "Ezequiel Montes",
    capacityEstimate: 200,
    capacityApprox: true,
    oneLiner: "Un viñedo con vista al atardecer.",
    whyWeddings: "Su terraza entre vides es ideal para una ceremonia íntima.",
    highlights: ["Viñedo", "Cava", "Terraza"],
    facets: {
      styles: ["rustic_vineyard"],
      settings: ["day_vineyard"],
      scale: ["medium"],
      experiences: ["wine_tasting"],
      budget: "medio_alto",
    },
    photos: [],
    source: "curated",
    confidence: 1,
    ...overrides,
  };
}

const PLACES_PHOTO_VENUE = makeVenue({
  id: "v_vinedos-la-redonda",
  name: "Viñedos La Redonda",
  rating: 4.6,
  userRatingCount: 3100,
  address: "Carretera Ezequiel Montes, Qro.",
  websiteUri: "https://example.com/la-redonda",
  googleMapsUri: "https://maps.google.com/?cid=42",
  photos: [{ kind: "places", ref: "places/abc/photos/p1", attribution: "Fotógrafo X" }],
});

const REGISTRY_PHOTO_VENUE = makeVenue({
  id: "v_hacienda-lagunillas",
  name: "Hacienda Lagunillas",
  zone: "huimilpan",
  photos: [{ kind: "registry", ref: "patio-cantera-rosa", attribution: "Annie Wood" }],
});

const NO_RECOMMENDATION_VENUE = makeVenue({
  id: "v_casona-cinco-patios",
  name: "Casona de los Cinco Patios",
  zone: "centro_historico",
  facets: {
    styles: ["colonial"],
    settings: ["night_casona"],
    scale: ["grand"],
    experiences: [],
    budget: "exclusivo",
  },
});

function makeKb(venues: KbVenue[]): Kb {
  return { zones: [], experiences: [], venues };
}

const facets: Facets = { style: "rustic_vineyard", setting: "day_vineyard" };

describe("assembleVenuesFromKb", () => {
  it("maps a recommended id to a full ExperienceVenue with real Places data, as principal", () => {
    const kb = makeKb([PLACES_PHOTO_VENUE, REGISTRY_PHOTO_VENUE, NO_RECOMMENDATION_VENUE]);

    const venues = assembleVenuesFromKb(
      [{ venueId: "v_vinedos-la-redonda", reason: "Conecta con el viñedo rústico elegido." }],
      facets,
      kb,
      { isUsable: () => true },
    );

    expect(venues[0]?.id).toBe("v_vinedos-la-redonda");
    expect(venues[0]?.role).toBe("principal");
    expect(venues[0]?.reason).toBe("Conecta con el viñedo rústico elegido.");
    expect(venues[0]?.rating).toBe(4.6);
    expect(venues[0]?.userRatingCount).toBe(3100);
    expect(venues[0]?.address).toBe("Carretera Ezequiel Montes, Qro.");
    expect(venues[0]?.websiteUri).toBe("https://example.com/la-redonda");
    expect(venues[0]?.googleMapsUri).toBe("https://maps.google.com/?cid=42");
    expect(venues[0]?.photoUrl).toBe("/api/places/photo?name=places%2Fabc%2Fphotos%2Fp1&w=800");
    expect(venues[0]?.photoAttribution).toBe("Fotógrafo X");
  });

  it("resolves a registry photo to its real URL when the venue has no Places photo", () => {
    const kb = makeKb([PLACES_PHOTO_VENUE, REGISTRY_PHOTO_VENUE]);

    const venues = assembleVenuesFromKb(
      [{ venueId: "v_hacienda-lagunillas", reason: "x".repeat(25) }],
      facets,
      kb,
    );

    expect(venues[0]?.photoUrl).toContain("images.unsplash.com");
    expect(venues[0]?.photoAttribution).toBe("Annie Wood");
  });

  it("fills to 2 venues with searchVenues when the model recommends only 1", () => {
    const kb = makeKb([PLACES_PHOTO_VENUE, REGISTRY_PHOTO_VENUE, NO_RECOMMENDATION_VENUE]);

    const venues = assembleVenuesFromKb(
      [{ venueId: "v_vinedos-la-redonda", reason: "x".repeat(25) }],
      facets,
      kb,
    );

    expect(venues).toHaveLength(2);
    expect(venues[1]?.role).toBe("destacada");
    expect(venues[1]?.id).not.toBe(venues[0]?.id);
  });

  it("drops unknown venue ids and still fills to 2", () => {
    const kb = makeKb([PLACES_PHOTO_VENUE, REGISTRY_PHOTO_VENUE]);

    const venues = assembleVenuesFromKb(
      [{ venueId: "v_does-not-exist", reason: "x".repeat(25) }],
      facets,
      kb,
    );

    expect(venues.every((venue) => venue.id !== "v_does-not-exist")).toBe(true);
    expect(venues).toHaveLength(2);
  });

  it("dedupes a repeated recommended id", () => {
    const kb = makeKb([PLACES_PHOTO_VENUE, REGISTRY_PHOTO_VENUE]);

    const venues = assembleVenuesFromKb(
      [
        { venueId: "v_vinedos-la-redonda", reason: "x".repeat(25) },
        { venueId: "v_vinedos-la-redonda", reason: "y".repeat(25) },
      ],
      facets,
      kb,
    );

    const ids = venues.map((venue) => venue.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("never returns more than 3 venues", () => {
    const kb = makeKb([PLACES_PHOTO_VENUE, REGISTRY_PHOTO_VENUE, NO_RECOMMENDATION_VENUE]);

    const venues = assembleVenuesFromKb(
      [
        { venueId: "v_vinedos-la-redonda", reason: "x".repeat(25) },
        { venueId: "v_hacienda-lagunillas", reason: "y".repeat(25) },
        { venueId: "v_casona-cinco-patios", reason: "z".repeat(25) },
      ],
      facets,
      kb,
    );

    expect(venues.length).toBeLessThanOrEqual(3);
  });

  it("uses whyWeddings as the reason for a fill-in venue the model never recommended", () => {
    const kb = makeKb([PLACES_PHOTO_VENUE, REGISTRY_PHOTO_VENUE]);

    const venues = assembleVenuesFromKb(
      [{ venueId: "v_vinedos-la-redonda", reason: "x".repeat(25) }],
      facets,
      kb,
    );

    expect(venues[1]?.reason).toBe(REGISTRY_PHOTO_VENUE.whyWeddings);
  });

  it("defaults to no Places photo (isUsable defaults false with no API key in this test env)", () => {
    const kb = makeKb([PLACES_PHOTO_VENUE, REGISTRY_PHOTO_VENUE, NO_RECOMMENDATION_VENUE]);

    const venues = assembleVenuesFromKb(
      [{ venueId: "v_vinedos-la-redonda", reason: "x".repeat(25) }],
      facets,
      kb,
    );

    expect(venues[0]?.photoUrl).toBeUndefined();
  });

  it("skips a Places photo and falls through to the venue's registry/url photo when isUsable is false", () => {
    const venueWithBothKinds = makeVenue({
      id: "v_has-both",
      photos: [
        { kind: "places", ref: "places/abc/photos/p1", attribution: "Fotógrafo X" },
        { kind: "registry", ref: "patio-cantera-rosa", attribution: "Annie Wood" },
      ],
    });
    const kb = makeKb([venueWithBothKinds]);

    const venues = assembleVenuesFromKb(
      [{ venueId: "v_has-both", reason: "x".repeat(25) }],
      facets,
      kb,
      {
        isUsable: () => false,
      },
    );

    expect(venues[0]?.photoUrl).toContain("images.unsplash.com");
    expect(venues[0]?.photoAttribution).toBe("Annie Wood");
  });

  it("leaves photoUrl undefined when isUsable is false and the venue has only a Places photo", () => {
    const kb = makeKb([PLACES_PHOTO_VENUE]);

    const venues = assembleVenuesFromKb(
      [{ venueId: "v_vinedos-la-redonda", reason: "x".repeat(25) }],
      facets,
      kb,
      { isUsable: () => false },
    );

    expect(venues[0]?.photoUrl).toBeUndefined();
  });

  it("uses the Places photo when isUsable is true", () => {
    const kb = makeKb([PLACES_PHOTO_VENUE]);

    const venues = assembleVenuesFromKb(
      [{ venueId: "v_vinedos-la-redonda", reason: "x".repeat(25) }],
      facets,
      kb,
      { isUsable: () => true },
    );

    expect(venues[0]?.photoUrl).toBe("/api/places/photo?name=places%2Fabc%2Fphotos%2Fp1&w=800");
  });
});

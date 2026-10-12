import { describe, expect, it } from "vitest";

import type { KbVenue } from "@/domain/kb/types";

import { fallbackPhotoForVenue } from "./fallback-photo";

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

describe("fallbackPhotoForVenue", () => {
  it("prefers the venue's own registry photo over a facets-based guess", () => {
    const venue = makeVenue({
      id: "v_both",
      photos: [
        { kind: "places", ref: "places/abc/photos/p1", attribution: "Fixture" },
        { kind: "registry", ref: "patio-cantera-rosa", attribution: "Annie Wood" },
      ],
    });

    const photo = fallbackPhotoForVenue(venue);

    expect(photo.url).toContain("images.unsplash.com");
    expect(photo.credit).toBe("Annie Wood");
    expect(photo.alt).toBe(venue.name);
  });

  it("falls back to the venue's url photo when there's no registry photo", () => {
    const venue = makeVenue({
      id: "v_url",
      photos: [{ kind: "url", ref: "https://example.com/photo.jpg", attribution: "External" }],
    });

    const photo = fallbackPhotoForVenue(venue);

    expect(photo.url).toBe("https://example.com/photo.jpg");
    expect(photo.credit).toBe("External");
  });

  it("falls back to a facets-matched registry photo when the venue has only a Places photo", () => {
    const venue = makeVenue({
      id: "v_places-only",
      photos: [{ kind: "places", ref: "places/abc/photos/p1", attribution: "Fixture" }],
      facets: {
        styles: ["rustic_vineyard"],
        settings: ["day_vineyard"],
        scale: ["medium"],
        experiences: ["wine_tasting"],
        budget: "medio_alto",
      },
    });

    const photo = fallbackPhotoForVenue(venue);

    expect(photo.url).toContain("images.unsplash.com");
    expect(photo.alt).toBe(venue.name);
  });

  it("always returns a photo, even for a venue with no photos and no matching facets", () => {
    const venue = makeVenue({
      id: "v_none",
      photos: [],
      facets: {
        styles: ["modern_elegant"],
        settings: ["rooftop_city"],
        scale: ["medium"],
        experiences: [],
        budget: "medio",
      },
    });

    const photo = fallbackPhotoForVenue(venue);

    expect(photo.url).toContain("images.unsplash.com");
  });
});

import { describe, expect, it } from "vitest";

import placesRawData from "../../../data/kb/places.raw.json";
import { loadKb } from "./load";
import { getZone } from "./search";

/**
 * Cross-cutting quality gates over the committed knowledge base
 * (`data/kb/*.json`), on top of what `KbVenueSchema` already enforces at
 * parse time: these catch content mistakes a valid-but-wrong venue could
 * still slip through with (a dangling photo ref, two venues that are
 * really the same place, a curated seed that lost its hand-written
 * copy), not just shape mistakes.
 */

function normalizeName(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

const placesPhotoNames = new Set(
  (placesRawData as { places: Array<{ photos?: Array<{ name: string }> }> }).places.flatMap(
    (place) => (place.photos ?? []).map((photo) => photo.name),
  ),
);

describe("knowledge-base quality gates", () => {
  it("gives every venue at least one style and one setting", () => {
    const { venues } = loadKb();
    for (const venue of venues) {
      expect(venue.facets.styles.length, `${venue.id} has no styles`).toBeGreaterThanOrEqual(1);
      expect(venue.facets.settings.length, `${venue.id} has no settings`).toBeGreaterThanOrEqual(1);
    }
  });

  it("keeps every oneLiner at or under 120 characters", () => {
    const { venues } = loadKb();
    for (const venue of venues) {
      expect(venue.oneLiner.length, `${venue.id} oneLiner too long`).toBeLessThanOrEqual(120);
    }
  });

  it("gives every venue exactly 3 highlights", () => {
    const { venues } = loadKb();
    for (const venue of venues) {
      expect(venue.highlights, `${venue.id} highlights`).toHaveLength(3);
    }
  });

  it("gives every venue a zone that actually exists in zones.json", () => {
    const { venues } = loadKb();
    for (const venue of venues) {
      expect(getZone(venue.zone), `${venue.id} has unknown zone ${venue.zone}`).toBeDefined();
    }
  });

  it("every places-sourced photo ref resolves to a real photo in places.raw.json", () => {
    const { venues } = loadKb();
    for (const venue of venues) {
      for (const photo of venue.photos) {
        if (photo.kind !== "places") continue;
        expect(
          placesPhotoNames.has(photo.ref),
          `${venue.id} photo ref ${photo.ref} not found in places.raw.json`,
        ).toBe(true);
      }
    }
  });

  it("has no duplicate venue names once normalised (accents/case/whitespace-insensitive)", () => {
    const { venues } = loadKb();
    const seen = new Map<string, string>();
    for (const venue of venues) {
      const key = normalizeName(venue.name);
      const existing = seen.get(key);
      expect(existing, `${venue.id} duplicates the name of ${existing}`).toBeUndefined();
      seen.set(key, venue.id);
    }
  });

  it("keeps every curated seed present with full confidence", () => {
    const { venues } = loadKb();
    const curated = venues.filter((venue) => venue.source === "curated");
    expect(curated.length).toBeGreaterThanOrEqual(12);
    for (const venue of curated) {
      expect(venue.confidence, `${venue.id} curated confidence`).toBe(1);
    }
  });
});

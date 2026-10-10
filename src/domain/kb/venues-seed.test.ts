import { describe, expect, it } from "vitest";
import { z } from "zod";

import venuesData from "../../../data/kb/venues.json";
import { KbVenueSchema } from "./types";

describe("venues.json (curated seeds, plus any merged Places snapshot)", () => {
  it("parses into at least the 12 curated venues", () => {
    const venues = z.array(KbVenueSchema).parse(venuesData);
    expect(venues.length).toBeGreaterThanOrEqual(12);
  });

  it("gives every venue a unique id prefixed with v_", () => {
    const venues = z.array(KbVenueSchema).parse(venuesData);
    const ids = venues.map((venue) => venue.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.startsWith("v_")).toBe(true);
  });

  it("marks every curated venue with full confidence, every places-sourced venue lower", () => {
    const venues = z.array(KbVenueSchema).parse(venuesData);
    const curated = venues.filter((venue) => venue.source === "curated");
    expect(curated.length).toBeGreaterThanOrEqual(12);

    for (const venue of venues) {
      expect(venue.capacityApprox).toBe(true);
      if (venue.source === "curated") {
        expect(venue.confidence).toBe(1);
      } else {
        expect(venue.confidence).toBeLessThan(1);
      }
    }
  });
});

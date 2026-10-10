import { describe, expect, it } from "vitest";
import { z } from "zod";

import venuesData from "../../../data/kb/venues.json";
import { KbVenueSchema } from "./types";

describe("venues.json (seed from the curated catalog)", () => {
  it("parses into the 12 curated venues", () => {
    const venues = z.array(KbVenueSchema).parse(venuesData);
    expect(venues).toHaveLength(12);
  });

  it("gives every venue a unique id prefixed with v_", () => {
    const venues = z.array(KbVenueSchema).parse(venuesData);
    const ids = venues.map((venue) => venue.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.startsWith("v_")).toBe(true);
  });

  it("marks every venue as curated with full confidence", () => {
    const venues = z.array(KbVenueSchema).parse(venuesData);
    for (const venue of venues) {
      expect(venue.source).toBe("curated");
      expect(venue.confidence).toBe(1);
      expect(venue.capacityApprox).toBe(true);
    }
  });
});

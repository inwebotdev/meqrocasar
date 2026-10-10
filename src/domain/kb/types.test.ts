import { describe, expect, it } from "vitest";
import { z } from "zod";

import experiencesData from "../../../data/kb/experiences.json";
import zonesData from "../../../data/kb/zones.json";
import { ZONE_VALUES } from "./taxonomy";
import { KbExperienceSchema, KbZoneSchema } from "./types";

describe("KbZoneSchema", () => {
  it("parses zones.json into the 10 taxonomy zones, in taxonomy order", () => {
    const zones = z.array(KbZoneSchema).parse(zonesData);
    expect(zones).toHaveLength(10);
    expect(zones.map((zone) => zone.id)).toEqual([...ZONE_VALUES]);
  });

  it("gives every zone a search centre and a radius within Google's 50km limit", () => {
    const zones = z.array(KbZoneSchema).parse(zonesData);
    for (const zone of zones) {
      expect(zone.center.lat).toBeGreaterThan(19);
      expect(zone.center.lat).toBeLessThan(22);
      expect(zone.center.lng).toBeGreaterThan(-101);
      expect(zone.center.lng).toBeLessThan(-99);
      expect(zone.radiusMeters).toBeGreaterThan(0);
      expect(zone.radiusMeters).toBeLessThanOrEqual(50000);
    }
  });
});

describe("KbExperienceSchema", () => {
  it("parses experiences.json into at least 18 curated experiences", () => {
    const experiences = z.array(KbExperienceSchema).parse(experiencesData);
    expect(experiences.length).toBeGreaterThanOrEqual(18);
  });

  it("gives every experience a unique id", () => {
    const experiences = z.array(KbExperienceSchema).parse(experiencesData);
    const ids = experiences.map((experience) => experience.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

import { z } from "zod";

import experiencesData from "../../../data/kb/experiences.json";
import venuesData from "../../../data/kb/venues.json";
import zonesData from "../../../data/kb/zones.json";
import { KbExperienceSchema, KbVenueSchema, KbZoneSchema, type Kb } from "./types";

/**
 * Loads and validates the curated knowledge base once, then memoises the
 * result. The three data files are static JSON imports (`resolveJsonModule`)
 * rather than `fs` reads, so this module works unchanged in route handlers,
 * React Server Components and Vitest.
 */

let cached: Kb | undefined;

export function loadKb(): Kb {
  if (!cached) {
    cached = {
      zones: z.array(KbZoneSchema).parse(zonesData),
      experiences: z.array(KbExperienceSchema).parse(experiencesData),
      venues: z.array(KbVenueSchema).parse(venuesData),
    };
  }

  return cached;
}

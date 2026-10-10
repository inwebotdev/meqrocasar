import { z } from "zod";

import {
  BudgetSchema,
  ExperienceSchema,
  SeasonSchema,
  SettingSchema,
  StyleSchema,
  ZoneSchema,
} from "./taxonomy";

/**
 * Zod schemas and inferred types for the three curated knowledge-base
 * entities (`data/kb/zones.json`, `data/kb/experiences.json`,
 * `data/kb/venues.json`). Pure TypeScript: no React, no Next.js.
 */

// --- zone ------------------------------------------------------------

export const ZoneFacetsSchema = z
  .object({
    styles: z.array(StyleSchema).min(1),
    settings: z.array(SettingSchema).min(1),
  })
  .strict();

/** A zone's search centre and the radius (meters, ≤50,000 per Google's limit) used as `locationBias` for Places Text Search. */
export const KbZoneGeoSchema = z.object({ lat: z.number(), lng: z.number() }).strict();

export const KbZoneSchema = z
  .object({
    id: ZoneSchema,
    name: z.string().min(1),
    tagline: z.string().min(1).max(80),
    description: z.string().min(1).max(400),
    landscapes: z.array(z.string().min(1)).min(3).max(5),
    travelMinutesFromCity: z.number().int().nonnegative(),
    center: KbZoneGeoSchema,
    radiusMeters: z.number().positive().max(50000),
    puebloMagico: z.boolean(),
    bestSeasons: z.array(SeasonSchema).min(1),
    weddingFormats: z.array(z.string().min(1)).min(2).max(4),
    facets: ZoneFacetsSchema,
    sources: z.array(z.string().url()).min(1),
  })
  .strict();

export type KbZone = z.infer<typeof KbZoneSchema>;

// --- experience ------------------------------------------------------------

export const ExperienceFacetsSchema = z
  .object({
    experiences: z.array(ExperienceSchema).min(1),
    styles: z.array(StyleSchema).optional(),
    settings: z.array(SettingSchema).optional(),
  })
  .strict();

export const KbExperienceSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    zoneIds: z.array(ZoneSchema).min(1),
    description: z.string().min(1).max(300),
    durationHours: z.number().positive(),
    priceTier: BudgetSchema,
    seasons: z.array(SeasonSchema).min(1),
    facets: ExperienceFacetsSchema,
    venueHints: z.array(z.string().min(1)),
    sources: z.array(z.string().url()).min(1),
  })
  .strict();

export type KbExperience = z.infer<typeof KbExperienceSchema>;

// --- venue ------------------------------------------------------------

export const KbVenueFacetsSchema = z
  .object({
    styles: z.array(StyleSchema).min(1),
    settings: z.array(SettingSchema).min(1),
    scale: z.array(z.enum(["intimate", "medium", "grand"])).min(1),
    experiences: z.array(ExperienceSchema),
    budget: BudgetSchema,
  })
  .strict();

export const KbPhotoSchema = z
  .object({
    kind: z.enum(["registry", "places", "url"]),
    ref: z.string().min(1),
    attribution: z.string().optional(),
  })
  .strict();

export type KbPhoto = z.infer<typeof KbPhotoSchema>;

export const KbVenueSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    aliases: z.array(z.string().min(1)),
    zone: ZoneSchema,
    municipality: z.string().min(1),
    address: z.string().optional(),
    location: z.object({ lat: z.number(), lng: z.number() }).strict().optional(),
    rating: z.number().min(0).max(5).optional(),
    userRatingCount: z.number().int().nonnegative().optional(),
    websiteUri: z.string().url().optional(),
    googleMapsUri: z.string().url().optional(),
    priceLevel: z.string().optional(),
    capacityEstimate: z.number().int().positive(),
    capacityApprox: z.literal(true),
    oneLiner: z.string().min(1).max(120),
    /** Empty for a places-sourced venue pending enrichment (`source: "places"`); always non-empty once curated/enriched. */
    whyWeddings: z.string().max(240),
    highlights: z.tuple([z.string().min(1), z.string().min(1), z.string().min(1)]),
    facets: KbVenueFacetsSchema,
    photos: z.array(KbPhotoSchema),
    source: z.enum(["curated", "places"]),
    placeId: z.string().optional(),
    /** `1` for hand-curated venues; a lower heuristic value (e.g. `0.4`) for venues mapped straight from a Places snapshot, pending enrichment. */
    confidence: z.number().min(0).max(1),
  })
  .strict();

export type KbVenue = z.infer<typeof KbVenueSchema>;

// --- kb ------------------------------------------------------------

export interface Kb {
  zones: KbZone[];
  experiences: KbExperience[];
  venues: KbVenue[];
}

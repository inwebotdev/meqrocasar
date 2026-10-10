import { z } from "zod";

/**
 * Zod schemas and types for the slice of the Google Places API (New) this
 * app uses: Text Search (`places:searchText`) and Photo media. Every
 * schema is `.loose()` (passthrough) on object fields we don't consume,
 * since Google's field mask already limits the payload and we never want
 * an unexpected extra field to fail validation.
 */

export const PlacesLatLngSchema = z
  .object({
    latitude: z.number(),
    longitude: z.number(),
  })
  .strict();

export type PlacesLatLng = z.infer<typeof PlacesLatLngSchema>;

export const PlacesLocalizedTextSchema = z
  .object({
    text: z.string(),
    languageCode: z.string().optional(),
  })
  .loose();

export const PlacesAuthorAttributionSchema = z
  .object({
    displayName: z.string().optional(),
    uri: z.string().optional(),
    photoUri: z.string().optional(),
  })
  .loose();

export const PlacesPhotoSchema = z
  .object({
    name: z.string().min(1),
    widthPx: z.number().int().positive().optional(),
    heightPx: z.number().int().positive().optional(),
    authorAttributions: z.array(PlacesAuthorAttributionSchema).optional(),
  })
  .loose();

export type PlacesPhoto = z.infer<typeof PlacesPhotoSchema>;

export const PlacesReviewSchema = z
  .object({
    rating: z.number().optional(),
    text: PlacesLocalizedTextSchema.optional(),
    relativePublishTimeDescription: z.string().optional(),
  })
  .loose();

export type PlacesReview = z.infer<typeof PlacesReviewSchema>;

/**
 * A single Place from `places:searchText`. Only `id` and `displayName`
 * are guaranteed; everything else Google may omit depending on the place.
 */
export const PlaceSchema = z
  .object({
    id: z.string().min(1),
    displayName: PlacesLocalizedTextSchema,
    formattedAddress: z.string().optional(),
    location: PlacesLatLngSchema.optional(),
    rating: z.number().optional(),
    userRatingCount: z.number().int().nonnegative().optional(),
    websiteUri: z.string().optional(),
    googleMapsUri: z.string().optional(),
    editorialSummary: PlacesLocalizedTextSchema.optional(),
    primaryType: z.string().optional(),
    types: z.array(z.string()).optional(),
    priceLevel: z.string().optional(),
    photos: z.array(PlacesPhotoSchema).optional(),
    reviews: z.array(PlacesReviewSchema).max(5).optional(),
  })
  .loose();

export type Place = z.infer<typeof PlaceSchema>;

export const SearchTextResponseSchema = z
  .object({
    places: z.array(PlaceSchema).optional(),
    nextPageToken: z.string().optional(),
  })
  .loose();

export type SearchTextResponse = z.infer<typeof SearchTextResponseSchema>;

export interface SearchTextLocationBias {
  circle: {
    center: { latitude: number; longitude: number };
    radius: number;
  };
}

export interface SearchTextRequest {
  textQuery: string;
  locationBias: SearchTextLocationBias;
  /** Defaults to `"es-MX"`. */
  languageCode?: string;
  /** Defaults to `"MX"`. */
  regionCode?: string;
  /** Defaults to `20`. */
  pageSize?: number;
  pageToken?: string;
}

export interface SearchTextResult {
  places: Place[];
  nextPageToken?: string;
}

/** Thrown for any non-2xx response from the Places API, or a timeout/network failure (`status: 0`). */
export class PlacesApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "PlacesApiError";
    this.status = status;
  }
}

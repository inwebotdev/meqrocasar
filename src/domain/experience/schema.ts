import { z } from "zod";

import { FacetsSchema } from "@/domain/kb/taxonomy";
import { PHOTO_ID_VALUES } from "@/domain/media/photos";
import { QuizAnswersSchema } from "@/domain/quiz/schema";
import { TranscriptSchema } from "@/domain/quiz/transcript";
import { VENUE_TAG_VALUES } from "@/domain/venues/types";

/**
 * Shape the primary model must return for the transcript-based final
 * generation (`buildExperienceMessages`): venues are referenced by their
 * knowledge-base id (`recommendedVenues[].venueId`) instead of a free-text
 * name/zone pair, and the response carries a short weekend-itinerary hint
 * grounded in the same knowledge base.
 */
export const LlmExperienceV2Schema = z.object({
  conceptTitle: z.string().min(4).max(80),
  colorPalette: z
    .array(
      z.object({
        hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
        name: z.string().min(2).max(30),
      }),
    )
    .length(4),
  narrative: z.string().min(120).max(1400),
  searchQueries: z.array(z.string().min(3).max(60)).length(3),
  recommendedVenues: z
    .array(
      z.object({
        venueId: z.string().min(1),
        reason: z.string().min(20).max(300),
      }),
    )
    .min(1)
    .max(3),
  reelTagline: z.string().min(4).max(60),
  itineraryHint: z.string().min(4).max(160),
});

export type LlmExperienceV2 = z.infer<typeof LlmExperienceV2Schema>;

/** JSON Schema for the OpenRouter `response_format` of the transcript-based final generation. */
export const LLM_EXPERIENCE_V2_JSON_SCHEMA = z.toJSONSchema(LlmExperienceV2Schema);

const PaletteColorSchema = z.object({
  hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  name: z.string().min(1),
});

const ExperienceVenueSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /**
   * An es-MX display label for the venue's zone. A plain string (not the
   * legacy `Zone` enum) because KB-sourced venues (`assembleVenuesFromKb`)
   * span the wider `kb/taxonomy` zone vocabulary, not just the 8 legacy
   * catalog zones.
   */
  zone: z.string().min(1),
  municipality: z.string().min(1),
  subtitle: z.string().min(1),
  capacity: z.number().positive(),
  capacityApprox: z.boolean(),
  features: z.tuple([z.string(), z.string(), z.string()]),
  priceCategory: z.enum(["Medio", "Medio-Alto", "Exclusivo"]),
  tags: z.array(z.enum(VENUE_TAG_VALUES)),
  /** Omitted for a KB-sourced venue: those render from `photoUrl` instead of the legacy photo registry. */
  photoId: z.enum(PHOTO_ID_VALUES).optional(),
  aliases: z.array(z.string()),
  website: z.string().optional(),
  reason: z.string().min(1),
  role: z.enum(["principal", "destacada"]),
  /** Google rating (0-5), when the venue has real Places data. */
  rating: z.number().min(0).max(5).optional(),
  userRatingCount: z.number().int().nonnegative().optional(),
  address: z.string().optional(),
  websiteUri: z.string().optional(),
  googleMapsUri: z.string().optional(),
  /** Proxied Places photo path, or a registry/Unsplash URL — see `assembleVenuesFromKb`. */
  photoUrl: z.string().optional(),
  photoAttribution: z.string().optional(),
  oneLiner: z.string().optional(),
  whyWeddings: z.string().optional(),
});

const ExperiencePhotoSchema = z.object({
  url: z.string().min(1),
  alt: z.string().min(1),
  credit: z.string().min(1),
});

/**
 * Mirrors `ExperienceResult` so the client can validate what it stored in
 * (and read back from) sessionStorage.
 */
export const ExperienceResultSchema = z.object({
  conceptTitle: z.string().min(1),
  palette: z.array(PaletteColorSchema).length(4),
  narrative: z.string().min(1),
  reelTagline: z.string().min(1),
  searchQueries: z.array(z.string().min(1)),
  venues: z.array(ExperienceVenueSchema),
  photos: z.array(ExperiencePhotoSchema).length(3),
  /** Omitted when the result was generated from a transcript rather than the legacy 4-answer shape. */
  answers: QuizAnswersSchema.optional(),
  /** Present when the result was generated from (or converted to) a transcript. */
  transcript: TranscriptSchema.optional(),
  /** The folded facets the transcript/answers resolved to. */
  facets: FacetsSchema.optional(),
  /** A short weekend-itinerary hint, e.g. "Viernes: ... · Sábado: ... · Domingo: ...". */
  itineraryHint: z.string().max(200).optional(),
  meta: z.object({
    model: z.string(),
    fallbackUsed: z.boolean(),
    durationMs: z.number(),
    generatedAt: z.string(),
    promptVersion: z.string().optional(),
    attempts: z
      .array(
        z.object({
          model: z.string(),
          outcome: z.enum([
            "ok",
            "http-error",
            "timeout",
            "network",
            "no-json",
            "invalid-json",
            "schema",
          ]),
          durationMs: z.number(),
        }),
      )
      .optional(),
    usage: z
      .object({
        promptTokens: z.number(),
        completionTokens: z.number(),
      })
      .optional(),
  }),
});

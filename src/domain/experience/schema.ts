import { z } from "zod";

import { QuizAnswersSchema } from "@/domain/quiz/schema";

/**
 * Shape the LLM (OpenRouter) must return. Passed to `response_format` via
 * `LLM_EXPERIENCE_JSON_SCHEMA` and used to validate the model's response
 * before it is processed into an `ExperienceResult`.
 */
export const LlmExperienceSchema = z.object({
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
        name: z.string().min(1),
        zone: z.string().min(1),
        reason: z.string().min(20).max(300),
      }),
    )
    .min(1)
    .max(3),
  reelTagline: z.string().min(4).max(60),
});

export type LlmExperience = z.infer<typeof LlmExperienceSchema>;

/** JSON Schema for the OpenRouter `response_format` (structured outputs). */
export const LLM_EXPERIENCE_JSON_SCHEMA = z.toJSONSchema(LlmExperienceSchema);

const PaletteColorSchema = z.object({
  hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  name: z.string().min(1),
});

const ExperienceVenueSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  zone: z.string().min(1),
  municipality: z.string().min(1),
  subtitle: z.string().min(1),
  capacity: z.number().positive(),
  capacityApprox: z.boolean(),
  features: z.tuple([z.string(), z.string(), z.string()]),
  priceCategory: z.enum(["Medio", "Medio-Alto", "Exclusivo"]),
  tags: z.array(z.string()),
  photoId: z.string().min(1),
  aliases: z.array(z.string()),
  website: z.string().optional(),
  reason: z.string().min(1),
  role: z.enum(["principal", "destacada"]),
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
  answers: QuizAnswersSchema,
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

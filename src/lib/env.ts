import "server-only";

import { z } from "zod";

const optionalSecret = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

/** A positive integer env var that falls back to `defaultValue` when absent or blank. */
function positiveIntWithDefault(defaultValue: number) {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.coerce.number().int().positive().default(defaultValue),
  );
}

const envSchema = z.object({
  OPENROUTER_API_KEY: optionalSecret,
  OPENROUTER_MODEL_PRIMARY: z.string().default("qwen/qwen-2.5-72b-instruct"),
  OPENROUTER_MODEL_FALLBACK: z.string().default("deepseek/deepseek-chat"),
  OPENROUTER_TIMEOUT_MS: positiveIntWithDefault(8000),
  /** The quiz engine's fast model for per-step generation (not the final generation's primary/fallback above). */
  OPENROUTER_MODEL_FAST: z.string().default("deepseek/deepseek-chat"),
  OPENROUTER_MODEL_FAST_FALLBACK: z.string().default("qwen/qwen-turbo"),
  QUIZ_MAX_STEPS: positiveIntWithDefault(7),
  QUIZ_STEP_TIMEOUT_MS: positiveIntWithDefault(6000),
  UNSPLASH_ACCESS_KEY: optionalSecret,
  GOOGLE_PLACES_API_KEY: optionalSecret,
  PLACES_PHOTO_CACHE_DIR: z.string().trim().min(1).default(".cache/places"),
  APP_URL: z.string().url().default("http://localhost:3000"),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(source);
}

let cachedEnv: Env | undefined;

export function getEnv(): Env {
  if (!cachedEnv) {
    cachedEnv = parseEnv();
  }

  return cachedEnv;
}

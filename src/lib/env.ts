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

/**
 * A boolean env var that falls back to `defaultValue` when absent or
 * blank. Deliberately not `z.coerce.boolean()`: that coerces via
 * `Boolean(value)`, so the string `"false"` (truthy, non-empty) would
 * coerce to `true` — exactly backwards for a flag like `QUIZ_PREFETCH=false`.
 */
function booleanWithDefault(defaultValue: boolean) {
  return z.preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim().toLowerCase();
    if (trimmed === "") return undefined;
    if (trimmed === "true" || trimmed === "1") return true;
    if (trimmed === "false" || trimmed === "0") return false;
    return value;
  }, z.boolean().default(defaultValue));
}

const envSchema = z.object({
  OPENROUTER_API_KEY: optionalSecret,
  /**
   * Final-generation (`POST /api/generate-experience`) primary/fallback
   * models. Defaults from `docs/ai-step-benchmark.md` (`kool run ai:bench`):
   * `qwen-2.5-72b-instruct` and `deepseek-chat` (the previous defaults here)
   * measured 0% and 22% schema-valid respectively against this app's real
   * OpenRouter traffic, with ~40s p50s — i.e. they time out far more often
   * than they succeed. `qwen3-30b-a3b` and `qwen-2.5-7b-instruct` were the
   * two reliable candidates in that same run, so they're the default pair
   * here too (same models as `OPENROUTER_MODEL_FAST`/`_FAST_FALLBACK`
   * below, just ordered primary-first since the final generation can
   * afford the slightly heavier model as its first attempt).
   */
  OPENROUTER_MODEL_PRIMARY: z.string().default("qwen/qwen3-30b-a3b"),
  OPENROUTER_MODEL_FALLBACK: z.string().default("qwen/qwen-2.5-7b-instruct"),
  OPENROUTER_TIMEOUT_MS: positiveIntWithDefault(8000),
  /**
   * The quiz engine's fast model for per-step generation (not the final
   * generation's primary/fallback above). Defaults from
   * `docs/ai-step-benchmark.md` (`kool run ai:bench`): `qwen-2.5-7b-instruct`
   * was 100% schema-valid-on-first-try and 100% Spanish-only on every
   * benchmark run, at the lowest cost of any working candidate.
   */
  OPENROUTER_MODEL_FAST: z.string().default("qwen/qwen-2.5-7b-instruct"),
  /**
   * `qwen3-30b-a3b` per the same benchmark — `deepseek-chat` (the previous
   * default here) measured only 22-33% schema-valid and ~40s p50 against
   * this layer's step schema, so it's no longer safe as the fallback.
   */
  OPENROUTER_MODEL_FAST_FALLBACK: z.string().default("qwen/qwen3-30b-a3b"),
  QUIZ_MAX_STEPS: positiveIntWithDefault(7),
  QUIZ_STEP_TIMEOUT_MS: positiveIntWithDefault(6000),
  /** Speculative prefetch of every visible option's next step (`POST /api/quiz/prefetch`); see `src/domain/quiz/prefetch.ts`. */
  QUIZ_PREFETCH: booleanWithDefault(true),
  /**
   * Per-option background budget for `POST /api/quiz/prefetch` (see
   * `src/domain/quiz/prefetch.ts`). The route itself never waits on this —
   * it schedules the warm-up calls and responds immediately with
   * `{ scheduled }` — so this only bounds how long a warm-up call is left
   * running before it's abandoned (the cache write it would have made is
   * simply skipped), not the HTTP response time.
   */
  QUIZ_PREFETCH_BUDGET_MS: positiveIntWithDefault(12000),
  /**
   * Optional OpenRouter provider routing order (comma-separated, e.g.
   * "Cerebras,Groq,SambaNova"), passed as `provider: { order, allow_fallbacks: true }`
   * on every `createStructuredClient` request. Empty/absent leaves provider
   * selection to OpenRouter's defaults. See `docs/ai-step-benchmark.md` for
   * the provider benchmark this was tuned against.
   */
  OPENROUTER_PROVIDER_ORDER: z
    .string()
    .trim()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(",")
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0)
        : undefined,
    ),
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

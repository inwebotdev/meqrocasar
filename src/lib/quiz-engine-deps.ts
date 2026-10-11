import "server-only";

import { createStructuredClient } from "@/domain/ai/structured";
import { createStaticImageProvider } from "@/domain/images/static-fallback";
import { createUnsplashImageProvider } from "@/domain/images/unsplash";
import { createQuizEngine, type QuizEngine, type QuizStepCache } from "@/domain/quiz/engine";
import { RAW_LLM_STEP_JSON_SCHEMA, RawGeneratedStepSchema } from "@/domain/quiz/generated-step";

import { getEnv } from "./env";

const APP_TITLE = "Querétaro Romance AI";
const QUIZ_STEP_TEMPERATURE = 0.8;
const QUIZ_STEP_MAX_TOKENS = 900;

/**
 * Module-level singleton: shared by every `createQuizEngine()` call for
 * the lifetime of the process (there's only ever one, via `cachedEngine`
 * below, but the cache lives here — not inside `engine.ts` — so the
 * speculative-prefetch route (`/api/quiz/prefetch`) and `/api/quiz/next`
 * are unambiguously warming/reading the exact same TTL LRU).
 */
const sharedStepCache: QuizStepCache = new Map();

function buildEngine(): QuizEngine {
  const env = getEnv();

  const llm = env.OPENROUTER_API_KEY
    ? createStructuredClient({
        config: {
          apiKey: env.OPENROUTER_API_KEY,
          primaryModel: env.OPENROUTER_MODEL_FAST,
          fallbackModel: env.OPENROUTER_MODEL_FAST_FALLBACK,
          timeoutMs: env.QUIZ_STEP_TIMEOUT_MS,
          appUrl: env.APP_URL,
          appTitle: APP_TITLE,
        },
        // The raw/lenient schema, not the tight `GeneratedStepSchema`:
        // `normaliseGeneratedStep` (called from `engine.ts`) is what
        // enforces the real maxima, word-boundary truncation and
        // language check — see `generated-step.ts`'s doc comment on
        // `RawGeneratedStepSchema` for why.
        schema: RawGeneratedStepSchema,
        jsonSchema: RAW_LLM_STEP_JSON_SCHEMA,
        name: "quiz_step",
        temperature: QUIZ_STEP_TEMPERATURE,
        maxTokens: QUIZ_STEP_MAX_TOKENS,
      })
    : undefined;

  const staticImages = createStaticImageProvider();
  const images = env.UNSPLASH_ACCESS_KEY
    ? createUnsplashImageProvider({ accessKey: env.UNSPLASH_ACCESS_KEY, fallback: staticImages })
    : staticImages;

  return createQuizEngine({ llm, images, maxSteps: env.QUIZ_MAX_STEPS, cache: sharedStepCache });
}

let cachedEngine: QuizEngine | undefined;

/**
 * The quiz engine used by `/api/quiz/next` and `/api/quiz/prefetch`, built
 * from `getEnv()` and memoised for the lifetime of the process.
 * `server-only` keeps this out of any client bundle.
 */
export function getQuizEngine(): QuizEngine {
  if (!cachedEngine) {
    cachedEngine = buildEngine();
  }

  return cachedEngine;
}

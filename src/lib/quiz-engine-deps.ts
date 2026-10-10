import "server-only";

import { createStructuredClient } from "@/domain/ai/structured";
import { createStaticImageProvider } from "@/domain/images/static-fallback";
import { createUnsplashImageProvider } from "@/domain/images/unsplash";
import { createQuizEngine, type QuizEngine } from "@/domain/quiz/engine";
import { GeneratedStepSchema, LLM_STEP_JSON_SCHEMA } from "@/domain/quiz/generated-step";

import { getEnv } from "./env";

const APP_TITLE = "Querétaro Romance AI";
const QUIZ_STEP_TEMPERATURE = 0.8;
const QUIZ_STEP_MAX_TOKENS = 900;

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
        schema: GeneratedStepSchema,
        jsonSchema: LLM_STEP_JSON_SCHEMA,
        name: "quiz_step",
        temperature: QUIZ_STEP_TEMPERATURE,
        maxTokens: QUIZ_STEP_MAX_TOKENS,
      })
    : undefined;

  const staticImages = createStaticImageProvider();
  const images = env.UNSPLASH_ACCESS_KEY
    ? createUnsplashImageProvider({ accessKey: env.UNSPLASH_ACCESS_KEY, fallback: staticImages })
    : staticImages;

  return createQuizEngine({ llm, images, maxSteps: env.QUIZ_MAX_STEPS });
}

let cachedEngine: QuizEngine | undefined;

/**
 * The quiz engine used by `/api/quiz/next`, built from `getEnv()` and
 * memoised for the lifetime of the process. `server-only` keeps this out
 * of any client bundle.
 */
export function getQuizEngine(): QuizEngine {
  if (!cachedEngine) {
    cachedEngine = buildEngine();
  }

  return cachedEngine;
}

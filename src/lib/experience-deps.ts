import "server-only";

import { createStructuredClient } from "@/domain/ai/structured";
import { createExperienceService, type ExperienceService } from "@/domain/experience/service";
import { LLM_EXPERIENCE_V2_JSON_SCHEMA, LlmExperienceV2Schema } from "@/domain/experience/schema";
import { createStaticImageProvider } from "@/domain/images/static-fallback";
import { createUnsplashImageProvider } from "@/domain/images/unsplash";

import { getEnv } from "./env";
import { getNarrationDeps } from "./narration-deps";

const APP_TITLE = "Querétaro Romance";
const EXPERIENCE_TEMPERATURE = 0.7;
const EXPERIENCE_MAX_TOKENS = 1500;

function buildService(): ExperienceService {
  const env = getEnv();

  const llm = env.OPENROUTER_API_KEY
    ? createStructuredClient({
        config: {
          apiKey: env.OPENROUTER_API_KEY,
          primaryModel: env.OPENROUTER_MODEL_PRIMARY,
          fallbackModel: env.OPENROUTER_MODEL_FALLBACK,
          timeoutMs: env.OPENROUTER_TIMEOUT_MS,
          appUrl: env.APP_URL,
          appTitle: APP_TITLE,
          providerOrder: env.OPENROUTER_PROVIDER_ORDER,
        },
        schema: LlmExperienceV2Schema,
        jsonSchema: LLM_EXPERIENCE_V2_JSON_SCHEMA as Record<string, unknown>,
        name: "wedding_experience",
        temperature: EXPERIENCE_TEMPERATURE,
        maxTokens: EXPERIENCE_MAX_TOKENS,
      })
    : undefined;

  const staticImages = createStaticImageProvider();
  const images = env.UNSPLASH_ACCESS_KEY
    ? createUnsplashImageProvider({ accessKey: env.UNSPLASH_ACCESS_KEY, fallback: staticImages })
    : staticImages;

  const narration = getNarrationDeps().service;

  return createExperienceService({ llm, images, narration });
}

let cachedService: ExperienceService | undefined;

/**
 * The experience service used by `/api/generate-experience`, built from
 * `getEnv()` and memoised for the lifetime of the process. `server-only`
 * keeps this out of any client bundle.
 */
export function getExperienceService(): ExperienceService {
  if (!cachedService) {
    cachedService = buildService();
  }

  return cachedService;
}

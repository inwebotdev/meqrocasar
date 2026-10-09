import "server-only";

import { createOpenRouterClient } from "@/domain/ai/openrouter";
import { createExperienceService, type ExperienceService } from "@/domain/experience/service";
import { createStaticImageProvider } from "@/domain/images/static-fallback";
import { createUnsplashImageProvider } from "@/domain/images/unsplash";

import { getEnv } from "./env";

const APP_TITLE = "Querétaro Romance AI";

function buildService(): ExperienceService {
  const env = getEnv();

  const llm = env.OPENROUTER_API_KEY
    ? createOpenRouterClient({
        apiKey: env.OPENROUTER_API_KEY,
        primaryModel: env.OPENROUTER_MODEL_PRIMARY,
        fallbackModel: env.OPENROUTER_MODEL_FALLBACK,
        timeoutMs: env.OPENROUTER_TIMEOUT_MS,
        appUrl: env.APP_URL,
        appTitle: APP_TITLE,
      })
    : undefined;

  const staticImages = createStaticImageProvider();
  const images = env.UNSPLASH_ACCESS_KEY
    ? createUnsplashImageProvider({ accessKey: env.UNSPLASH_ACCESS_KEY, fallback: staticImages })
    : staticImages;

  return createExperienceService({ llm, images });
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

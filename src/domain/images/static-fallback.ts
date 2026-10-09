import { photosForAnswers } from "@/domain/media/photos-for-answers";

import type { ImageProvider } from "./provider";

const PHOTO_COUNT = 3;

/**
 * Offline image provider: picks photos from the local registry using the
 * same answer→photo-tag logic as the local fallback experience
 * (`photosForAnswers`). Ignores `queries` entirely — no network calls,
 * ever. Used when no Unsplash key is configured, and as the fallback for
 * `createUnsplashImageProvider` when a query can't be resolved.
 */
export function createStaticImageProvider(): ImageProvider {
  return {
    async resolve(_queries, answers) {
      return photosForAnswers(answers, PHOTO_COUNT);
    },
  };
}

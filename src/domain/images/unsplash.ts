import { z } from "zod";

import type { ExperiencePhoto } from "@/domain/experience/types";
import type { Facets } from "@/domain/kb/taxonomy";
import type { QuizAnswers } from "@/domain/quiz/schema";

import type { ImageProvider } from "./provider";

export interface UnsplashImageProviderConfig {
  accessKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  fallback: ImageProvider;
}

const DEFAULT_TIMEOUT_MS = 4000;
const SEARCH_URL = "https://api.unsplash.com/search/photos";

const UnsplashPhotoSchema = z.object({
  urls: z.object({ regular: z.string().min(1) }),
  alt_description: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  user: z.object({ name: z.string().min(1) }),
});

const UnsplashSearchResponseSchema = z.object({
  results: z.array(UnsplashPhotoSchema),
});

async function fetchOne(
  query: string,
  accessKey: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<ExperiencePhoto | undefined> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `${SEARCH_URL}?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape&content_filter=high`;
    const response = await fetchImpl(url, {
      headers: {
        Authorization: `Client-ID ${accessKey}`,
        "Accept-Version": "v1",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return undefined;
    }

    const rawBody: unknown = await response.json();
    const parsed = UnsplashSearchResponseSchema.safeParse(rawBody);
    if (!parsed.success) {
      return undefined;
    }

    const first = parsed.data.results[0];
    if (!first) {
      return undefined;
    }

    return {
      url: first.urls.regular,
      alt: first.alt_description ?? first.description ?? query,
      credit: first.user.name,
    };
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Creates an image provider backed by the Unsplash Search Photos API: one
 * request per query, in parallel. Any failure for a given query (non-200,
 * timeout, network error, empty `results`, or an unexpected response
 * shape) falls back to `config.fallback` for that slot instead of failing
 * the whole call. The result is deduplicated by `url` (keeping the
 * original query order) while still always resolving exactly 3 photos.
 */
export function createUnsplashImageProvider(config: UnsplashImageProviderConfig): ImageProvider {
  const fetchImpl = config.fetchImpl ?? fetch;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    async resolve(queries: string[], answers: QuizAnswers): Promise<ExperiencePhoto[]> {
      const direct = await Promise.all(
        queries.map((query) => fetchOne(query, config.accessKey, fetchImpl, timeoutMs)),
      );

      const needsFallback = direct.some((photo) => photo === undefined);
      const fallbackPhotos = needsFallback ? await config.fallback.resolve(queries, answers) : [];
      let fallbackCursor = 0;

      const usedUrls = new Set<string>();

      function nextFallback(): ExperiencePhoto | undefined {
        while (fallbackCursor < fallbackPhotos.length) {
          const candidate = fallbackPhotos[fallbackCursor];
          fallbackCursor += 1;
          if (candidate && !usedUrls.has(candidate.url)) {
            return candidate;
          }
        }
        // Pool of unique fallback photos exhausted: reuse the last one
        // rather than fail the "always exactly 3 photos" contract.
        return fallbackPhotos.at(-1);
      }

      const resolved: ExperiencePhoto[] = [];

      for (const photo of direct) {
        const candidate = photo && !usedUrls.has(photo.url) ? photo : nextFallback();

        if (candidate) {
          usedUrls.add(candidate.url);
          resolved.push(candidate);
        }
      }

      return resolved;
    },

    async resolveOne(query: string, facets: Facets): Promise<ExperiencePhoto> {
      const direct = await fetchOne(query, config.accessKey, fetchImpl, timeoutMs);
      if (direct) {
        return direct;
      }

      return config.fallback.resolveOne(query, facets);
    },
  };
}

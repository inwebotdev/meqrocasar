import { delay, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import type { ExperiencePhoto } from "@/domain/experience/types";
import type { QuizAnswers } from "@/domain/quiz/schema";

import { mockUnsplashSearch } from "../../../test/msw/handlers";
import { server } from "../../../test/msw/server";
import type { ImageProvider } from "./provider";
import { createUnsplashImageProvider } from "./unsplash";

const answers: QuizAnswers = {
  style: "rustic_vineyard",
  setting: "day_vineyard",
  experience: "intimate_boutique",
  mustHave: "wine_tasting",
};

const QUERIES = [
  "vineyard sunset wedding mexico",
  "wine cellar candlelight wedding",
  "rustic vineyard wedding couple",
];

const FALLBACK_PHOTOS: ExperiencePhoto[] = [
  { url: "https://images.unsplash.com/fallback-1", alt: "fallback 1", credit: "Fallback Credit 1" },
  { url: "https://images.unsplash.com/fallback-2", alt: "fallback 2", credit: "Fallback Credit 2" },
  { url: "https://images.unsplash.com/fallback-3", alt: "fallback 3", credit: "Fallback Credit 3" },
];

function makeFallbackStub() {
  const calls: { queries: string[]; answers: QuizAnswers }[] = [];
  const provider: ImageProvider = {
    async resolve(queries, resolvedAnswers) {
      calls.push({ queries, answers: resolvedAnswers });
      return FALLBACK_PHOTOS;
    },
    async resolveOne() {
      return FALLBACK_PHOTOS[0] as ExperiencePhoto;
    },
  };
  return { provider, calls };
}

function okResult(query: string) {
  return HttpResponse.json({
    results: [
      {
        urls: { regular: `https://images.unsplash.com/ok-${encodeURIComponent(query)}` },
        alt_description: `photo for ${query}`,
        description: null,
        user: { name: "Real Photographer" },
      },
    ],
  });
}

describe("createUnsplashImageProvider", () => {
  it("resolves 3 OK results directly from Unsplash, without touching the fallback", async () => {
    server.use(
      mockUnsplashSearch(({ request, query }) => {
        expect(request.headers.get("Authorization")).toBe("Client-ID test-access-key");
        expect(request.headers.get("Accept-Version")).toBe("v1");
        return okResult(query ?? "");
      }),
    );

    const { provider: fallback, calls } = makeFallbackStub();
    const provider = createUnsplashImageProvider({ accessKey: "test-access-key", fallback });

    const photos = await provider.resolve(QUERIES, answers);

    expect(photos).toHaveLength(3);
    expect(photos.map((photo) => photo.url)).toEqual(
      QUERIES.map((query) => `https://images.unsplash.com/ok-${encodeURIComponent(query)}`),
    );
    expect(photos[0]).toEqual({
      url: `https://images.unsplash.com/ok-${encodeURIComponent(QUERIES[0] as string)}`,
      alt: `photo for ${QUERIES[0]}`,
      credit: "Real Photographer",
    });
    expect(calls).toHaveLength(0);
  });

  it("falls back for a query that returns a 403 (rate limit)", async () => {
    server.use(
      mockUnsplashSearch(({ query }) => {
        if (query === QUERIES[1]) {
          return HttpResponse.json({ errors: ["Rate Limit Exceeded"] }, { status: 403 });
        }
        return okResult(query ?? "");
      }),
    );

    const { provider: fallback, calls } = makeFallbackStub();
    const provider = createUnsplashImageProvider({ accessKey: "test-access-key", fallback });

    const photos = await provider.resolve(QUERIES, answers);

    expect(photos).toHaveLength(3);
    expect(photos[0]?.url).toBe(
      `https://images.unsplash.com/ok-${encodeURIComponent(QUERIES[0] as string)}`,
    );
    expect(photos[1]).toEqual(FALLBACK_PHOTOS[0]);
    expect(photos[2]?.url).toBe(
      `https://images.unsplash.com/ok-${encodeURIComponent(QUERIES[2] as string)}`,
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]?.queries).toEqual(QUERIES);
  });

  it("falls back for a query with empty results", async () => {
    server.use(
      mockUnsplashSearch(({ query }) => {
        if (query === QUERIES[0]) {
          return HttpResponse.json({ results: [] });
        }
        return okResult(query ?? "");
      }),
    );

    const { provider: fallback } = makeFallbackStub();
    const provider = createUnsplashImageProvider({ accessKey: "test-access-key", fallback });

    const photos = await provider.resolve(QUERIES, answers);

    expect(photos).toHaveLength(3);
    expect(photos[0]).toEqual(FALLBACK_PHOTOS[0]);
  });

  it("falls back for a query with an unexpected response shape", async () => {
    server.use(
      mockUnsplashSearch(({ query }) => {
        if (query === QUERIES[2]) {
          return HttpResponse.json({ unexpected: "shape" });
        }
        return okResult(query ?? "");
      }),
    );

    const { provider: fallback } = makeFallbackStub();
    const provider = createUnsplashImageProvider({ accessKey: "test-access-key", fallback });

    const photos = await provider.resolve(QUERIES, answers);

    expect(photos).toHaveLength(3);
    expect(photos[2]).toEqual(FALLBACK_PHOTOS[0]);
  });

  it("falls back for a query that times out", async () => {
    server.use(
      mockUnsplashSearch(async ({ query }) => {
        if (query === QUERIES[0]) {
          await delay(300);
          return okResult(query);
        }
        return okResult(query ?? "");
      }),
    );

    const { provider: fallback } = makeFallbackStub();
    const provider = createUnsplashImageProvider({
      accessKey: "test-access-key",
      fallback,
      timeoutMs: 50,
    });

    const photos = await provider.resolve(QUERIES, answers);

    expect(photos).toHaveLength(3);
    expect(photos[0]).toEqual(FALLBACK_PHOTOS[0]);
  });

  it("always resolves exactly 3 photos even when every query fails", async () => {
    server.use(mockUnsplashSearch(() => HttpResponse.json({ results: [] })));

    const { provider: fallback } = makeFallbackStub();
    const provider = createUnsplashImageProvider({ accessKey: "test-access-key", fallback });

    const photos = await provider.resolve(QUERIES, answers);

    expect(photos).toEqual(FALLBACK_PHOTOS);
  });

  it("resolveOne resolves directly from Unsplash when the query succeeds", async () => {
    server.use(mockUnsplashSearch(({ query }) => okResult(query ?? "")));

    const { provider: fallback, calls } = makeFallbackStub();
    const provider = createUnsplashImageProvider({ accessKey: "test-access-key", fallback });

    const photo = await provider.resolveOne(QUERIES[0] as string, { style: "rustic_vineyard" });

    expect(photo.url).toBe(
      `https://images.unsplash.com/ok-${encodeURIComponent(QUERIES[0] as string)}`,
    );
    expect(calls).toHaveLength(0);
  });

  it("resolveOne falls back when the query fails", async () => {
    server.use(mockUnsplashSearch(() => HttpResponse.json({ results: [] })));

    const { provider: fallback } = makeFallbackStub();
    const provider = createUnsplashImageProvider({ accessKey: "test-access-key", fallback });

    const photo = await provider.resolveOne("anything", { style: "rustic_vineyard" });

    expect(photo).toEqual(FALLBACK_PHOTOS[0]);
  });
});

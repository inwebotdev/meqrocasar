import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { server } from "../../../test/msw/server";
import { findPhotos, getPhoto, PHOTOS } from "./photos";

describe("PHOTOS registry", () => {
  it("has at least 16 photos", () => {
    expect(PHOTOS.length).toBeGreaterThanOrEqual(16);
  });

  it("has unique ids", () => {
    const ids = PHOTOS.map((photo) => photo.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every url points at images.unsplash.com", () => {
    for (const photo of PHOTOS) {
      const url = new URL(photo.url);
      expect(url.hostname).toBe("images.unsplash.com");
      expect(url.pathname.startsWith("/photo-")).toBe(true);
    }
  });

  it("every photo has at least one tag, a credit and alt text", () => {
    for (const photo of PHOTOS) {
      expect(photo.tags.length).toBeGreaterThanOrEqual(1);
      expect(photo.credit.length).toBeGreaterThan(0);
      expect(photo.alt.length).toBeGreaterThan(0);
    }
  });
});

describe("getPhoto", () => {
  it("returns the photo for a known id", () => {
    const photo = getPhoto("patio-cantera-rosa");
    expect(photo.id).toBe("patio-cantera-rosa");
  });
});

describe("findPhotos", () => {
  it("returns vineyard-tagged photos first, ranked and limited", () => {
    const result = findPhotos(["vineyard"], 3);
    expect(result).toHaveLength(3);
    for (const photo of result) {
      expect(photo.tags).toContain("vineyard");
    }
  });

  it("is deterministic across repeated calls", () => {
    const first = findPhotos(["colonial", "courtyard"], 4).map((photo) => photo.id);
    const second = findPhotos(["colonial", "courtyard"], 4).map((photo) => photo.id);
    expect(first).toEqual(second);
  });

  it("ranks photos matching more requested tags higher", () => {
    const [top] = findPhotos(["colonial", "courtyard", "bougainvillea"], 1);
    expect(top?.tags).toEqual(expect.arrayContaining(["colonial", "courtyard", "bougainvillea"]));
  });

  it("returns an empty array when no photo matches", () => {
    // @ts-expect-error intentionally invalid tag to assert graceful handling
    const result = findPhotos(["not-a-real-tag"], 3);
    expect(result).toEqual([]);
  });
});

describe("opt-in Unsplash URL check (PHOTO_URL_CHECK=1)", () => {
  const shouldRun = process.env.PHOTO_URL_CHECK === "1";

  // The shared MSW server errors on any unhandled request; this check must hit the real CDN.
  beforeAll(() => {
    if (shouldRun) server.close();
  });

  afterAll(() => {
    if (shouldRun) server.listen({ onUnhandledFrame: "error" });
  });

  it.runIf(shouldRun)(
    "every photo URL resolves with HTTP 200",
    async () => {
      for (const photo of PHOTOS) {
        const response = await fetch(photo.url, { method: "HEAD" });
        expect(response.status, `${photo.id} -> ${photo.url}`).toBe(200);
      }
    },
    30000,
  );

  it.skipIf(shouldRun)("skipped unless PHOTO_URL_CHECK=1", () => {
    expect(true).toBe(true);
  });
});

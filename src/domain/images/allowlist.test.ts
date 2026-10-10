import { describe, expect, it } from "vitest";

import { isAllowedImageUrl, isUnsplashUrl, UNSPLASH_HOSTNAME_ALLOWLIST } from "./allowlist";

describe("UNSPLASH_HOSTNAME_ALLOWLIST", () => {
  it("contains images.unsplash.com", () => {
    expect(UNSPLASH_HOSTNAME_ALLOWLIST).toEqual(["images.unsplash.com"]);
  });
});

describe("isUnsplashUrl", () => {
  it("is true for a well-formed images.unsplash.com URL", () => {
    expect(isUnsplashUrl("https://images.unsplash.com/photo-123?auto=format")).toBe(true);
  });

  it("is false for a different hostname", () => {
    expect(isUnsplashUrl("https://evil.example.com/images.unsplash.com")).toBe(false);
  });

  it("is false for a malformed URL, never throws", () => {
    expect(isUnsplashUrl("not a url")).toBe(false);
  });
});

describe("isAllowedImageUrl", () => {
  it("is true for a well-formed Unsplash URL", () => {
    expect(isAllowedImageUrl("https://images.unsplash.com/photo-123?auto=format")).toBe(true);
  });

  it("is true for a same-origin Places photo proxy path", () => {
    expect(isAllowedImageUrl("/api/places/photo?name=places/a1/photos/p1&w=800")).toBe(true);
    expect(isAllowedImageUrl("/api/places/photo")).toBe(true);
  });

  it("is false for a different hostname", () => {
    expect(isAllowedImageUrl("https://evil.example.com/images.unsplash.com")).toBe(false);
  });

  it("is false for a lookalike path that isn't exactly the proxy prefix", () => {
    expect(isAllowedImageUrl("/api/places/photography?name=x")).toBe(false);
    expect(isAllowedImageUrl("https://evil.example.com/api/places/photo?name=x")).toBe(false);
  });

  it("is false for a malformed URL, never throws", () => {
    expect(isAllowedImageUrl("not a url")).toBe(false);
  });
});

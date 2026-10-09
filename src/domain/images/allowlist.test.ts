import { describe, expect, it } from "vitest";

import { isUnsplashUrl, UNSPLASH_HOSTNAME_ALLOWLIST } from "./allowlist";

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

import { describe, expect, it } from "vitest";

import { parseEnv } from "./env";

describe("parseEnv", () => {
  it("applies defaults when optional variables are absent", () => {
    const env = parseEnv({ NODE_ENV: "test" });

    expect(env.OPENROUTER_MODEL_PRIMARY).toBe("qwen/qwen-2.5-72b-instruct");
    expect(env.OPENROUTER_MODEL_FALLBACK).toBe("deepseek/deepseek-chat");
    expect(env.OPENROUTER_TIMEOUT_MS).toBe(8000);
    expect(env.APP_URL).toBe("http://localhost:3000");
    expect(env.OPENROUTER_API_KEY).toBeUndefined();
    expect(env.UNSPLASH_ACCESS_KEY).toBeUndefined();
    expect(env.GOOGLE_PLACES_API_KEY).toBeUndefined();
    expect(env.PLACES_PHOTO_CACHE_DIR).toBe(".cache/places");
  });

  it("treats empty secret values from .env as absent", () => {
    const env = parseEnv({
      NODE_ENV: "test",
      OPENROUTER_API_KEY: "",
      UNSPLASH_ACCESS_KEY: "  ",
      GOOGLE_PLACES_API_KEY: "",
    });

    expect(env.OPENROUTER_API_KEY).toBeUndefined();
    expect(env.UNSPLASH_ACCESS_KEY).toBeUndefined();
    expect(env.GOOGLE_PLACES_API_KEY).toBeUndefined();
  });

  it("keeps a non-empty GOOGLE_PLACES_API_KEY and a custom PLACES_PHOTO_CACHE_DIR", () => {
    const env = parseEnv({
      NODE_ENV: "test",
      GOOGLE_PLACES_API_KEY: " places-key ",
      PLACES_PHOTO_CACHE_DIR: "/tmp/places-cache",
    });

    expect(env.GOOGLE_PLACES_API_KEY).toBe("places-key");
    expect(env.PLACES_PHOTO_CACHE_DIR).toBe("/tmp/places-cache");
  });

  it("keeps non-empty secret values", () => {
    const env = parseEnv({ NODE_ENV: "test", OPENROUTER_API_KEY: " sk-test " });

    expect(env.OPENROUTER_API_KEY).toBe("sk-test");
  });

  it("applies the timeout default when OPENROUTER_TIMEOUT_MS is empty", () => {
    expect(parseEnv({ NODE_ENV: "test", OPENROUTER_TIMEOUT_MS: "" }).OPENROUTER_TIMEOUT_MS).toBe(
      8000,
    );
    expect(parseEnv({ NODE_ENV: "test", OPENROUTER_TIMEOUT_MS: "  " }).OPENROUTER_TIMEOUT_MS).toBe(
      8000,
    );
  });

  it("rejects a non-positive timeout", () => {
    expect(() => parseEnv({ NODE_ENV: "test", OPENROUTER_TIMEOUT_MS: "0" })).toThrow();
  });

  it("rejects an invalid APP_URL", () => {
    expect(() => parseEnv({ NODE_ENV: "test", APP_URL: "not-a-url" })).toThrow();
  });

  it("coerces OPENROUTER_TIMEOUT_MS from a string", () => {
    const env = parseEnv({ NODE_ENV: "test", OPENROUTER_TIMEOUT_MS: "5000" });

    expect(env.OPENROUTER_TIMEOUT_MS).toBe(5000);
  });
});

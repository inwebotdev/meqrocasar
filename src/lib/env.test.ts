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
    expect(env.OPENROUTER_MODEL_FAST).toBe("qwen/qwen-2.5-7b-instruct");
    expect(env.OPENROUTER_MODEL_FAST_FALLBACK).toBe("qwen/qwen3-30b-a3b");
    expect(env.QUIZ_MAX_STEPS).toBe(7);
    expect(env.QUIZ_STEP_TIMEOUT_MS).toBe(6000);
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

  it("overrides the quiz engine's model/step env vars", () => {
    const env = parseEnv({
      NODE_ENV: "test",
      OPENROUTER_MODEL_FAST: "some/other-fast-model",
      OPENROUTER_MODEL_FAST_FALLBACK: "some/other-fallback",
      QUIZ_MAX_STEPS: "5",
      QUIZ_STEP_TIMEOUT_MS: "3000",
    });

    expect(env.OPENROUTER_MODEL_FAST).toBe("some/other-fast-model");
    expect(env.OPENROUTER_MODEL_FAST_FALLBACK).toBe("some/other-fallback");
    expect(env.QUIZ_MAX_STEPS).toBe(5);
    expect(env.QUIZ_STEP_TIMEOUT_MS).toBe(3000);
  });

  it("rejects a non-positive QUIZ_MAX_STEPS", () => {
    expect(() => parseEnv({ NODE_ENV: "test", QUIZ_MAX_STEPS: "0" })).toThrow();
  });

  it("applies the QUIZ_MAX_STEPS/QUIZ_STEP_TIMEOUT_MS defaults when blank", () => {
    const env = parseEnv({ NODE_ENV: "test", QUIZ_MAX_STEPS: "", QUIZ_STEP_TIMEOUT_MS: "  " });

    expect(env.QUIZ_MAX_STEPS).toBe(7);
    expect(env.QUIZ_STEP_TIMEOUT_MS).toBe(6000);
  });

  it("defaults QUIZ_PREFETCH to true when absent or blank", () => {
    expect(parseEnv({ NODE_ENV: "test" }).QUIZ_PREFETCH).toBe(true);
    expect(parseEnv({ NODE_ENV: "test", QUIZ_PREFETCH: "" }).QUIZ_PREFETCH).toBe(true);
  });

  it("parses QUIZ_PREFETCH=false as false, not as truthy-because-non-empty", () => {
    expect(parseEnv({ NODE_ENV: "test", QUIZ_PREFETCH: "false" }).QUIZ_PREFETCH).toBe(false);
    expect(parseEnv({ NODE_ENV: "test", QUIZ_PREFETCH: "0" }).QUIZ_PREFETCH).toBe(false);
  });

  it("parses QUIZ_PREFETCH=true/1 as true", () => {
    expect(parseEnv({ NODE_ENV: "test", QUIZ_PREFETCH: "true" }).QUIZ_PREFETCH).toBe(true);
    expect(parseEnv({ NODE_ENV: "test", QUIZ_PREFETCH: "1" }).QUIZ_PREFETCH).toBe(true);
  });
});

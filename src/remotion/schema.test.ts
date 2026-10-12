import { describe, expect, it } from "vitest";

import type { NarrationRef } from "@/domain/audio/service";
import { buildFallbackExperience } from "@/domain/experience/fallback";
import type { QuizAnswers } from "@/domain/quiz/schema";

import { reelPropsFromExperience, ReelPropsSchema } from "./schema";

const ANSWERS: QuizAnswers = {
  style: "colonial",
  setting: "night_casona",
  experience: "grand_traditional",
  mustHave: "fireworks",
};

const HASH = "a".repeat(64);

const READY_NARRATION: NarrationRef = {
  status: "ready",
  hash: HASH,
  src: `/api/narration/${HASH}`,
  durationSec: 9.5,
  sentences: [{ text: "Imaginen su boda.", startSec: 0, endSec: 2.5 }],
};

const PENDING_NARRATION: NarrationRef = {
  status: "pending",
  hash: HASH,
  src: `/api/narration/${HASH}`,
};

function validReelProps() {
  const fallback = buildFallbackExperience(ANSWERS);
  return reelPropsFromExperience({
    ...fallback,
    meta: {
      model: "fallback",
      fallbackUsed: true,
      durationMs: 0,
      generatedAt: new Date(0).toISOString(),
    },
  });
}

describe("ReelPropsSchema", () => {
  it("accepts props built from a fallback experience", () => {
    const props = validReelProps();
    const result = ReelPropsSchema.safeParse(props);

    expect(result.success, JSON.stringify(result.success ? null : result.error.issues)).toBe(true);
  });

  it("rejects a payload with only 2 photos", () => {
    const props = validReelProps();
    const invalid = { ...props, photos: props.photos.slice(0, 2) };

    expect(ReelPropsSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("reelPropsFromExperience", () => {
  it("cuts narrative lines at 90 chars with an ellipsis", () => {
    const fallback = buildFallbackExperience(ANSWERS);
    const longNarrative = `${"x".repeat(120)}. Segunda oracion corta. Tercera oracion corta.`;
    const result = {
      ...fallback,
      narrative: longNarrative,
      meta: {
        model: "fallback",
        fallbackUsed: true,
        durationMs: 0,
        generatedAt: new Date(0).toISOString(),
      },
    };

    const props = reelPropsFromExperience(result);

    expect(props.narrativeLines[0]?.length).toBeLessThanOrEqual(90);
    expect(props.narrativeLines[0]?.endsWith("…")).toBe(true);
  });

  it("yields between 2 and 4 narrative lines", () => {
    const fallback = buildFallbackExperience(ANSWERS);
    const result = {
      ...fallback,
      meta: {
        model: "fallback",
        fallbackUsed: true,
        durationMs: 0,
        generatedAt: new Date(0).toISOString(),
      },
    };

    const props = reelPropsFromExperience(result);

    expect(props.narrativeLines.length).toBeGreaterThanOrEqual(2);
    expect(props.narrativeLines.length).toBeLessThanOrEqual(4);
  });

  it("uses reelTagline as the tagline and defaults the track name", () => {
    const fallback = buildFallbackExperience(ANSWERS);
    const result = {
      ...fallback,
      meta: {
        model: "fallback",
        fallbackUsed: true,
        durationMs: 0,
        generatedAt: new Date(0).toISOString(),
      },
    };

    const props = reelPropsFromExperience(result);

    expect(props.tagline).toBe(fallback.reelTagline);
    expect(props.trackName).toBe("Vals Huapango Queretano");
  });

  it("maps a ready narration, resolving a relative src against the given origin", () => {
    const fallback = buildFallbackExperience(ANSWERS);
    const result = {
      ...fallback,
      narration: READY_NARRATION,
      meta: {
        model: "fallback",
        fallbackUsed: true,
        durationMs: 0,
        generatedAt: new Date(0).toISOString(),
      },
    };

    const props = reelPropsFromExperience(result, { origin: "https://example.com" });

    expect(props.narration).toEqual({
      src: `https://example.com${READY_NARRATION.src}`,
      durationSec: READY_NARRATION.durationSec,
      sentences: READY_NARRATION.sentences,
    });
  });

  it("leaves an already-absolute narration src untouched", () => {
    const fallback = buildFallbackExperience(ANSWERS);
    const absoluteNarration: NarrationRef = {
      ...READY_NARRATION,
      src: "https://cdn.example.com/narration.mp3",
    };
    const result = {
      ...fallback,
      narration: absoluteNarration,
      meta: {
        model: "fallback",
        fallbackUsed: true,
        durationMs: 0,
        generatedAt: new Date(0).toISOString(),
      },
    };

    const props = reelPropsFromExperience(result, { origin: "https://example.com" });

    expect(props.narration?.src).toBe("https://cdn.example.com/narration.mp3");
  });

  it("omits narration when it's 'pending'", () => {
    const fallback = buildFallbackExperience(ANSWERS);
    const result = {
      ...fallback,
      narration: PENDING_NARRATION,
      meta: {
        model: "fallback",
        fallbackUsed: true,
        durationMs: 0,
        generatedAt: new Date(0).toISOString(),
      },
    };

    const props = reelPropsFromExperience(result, { origin: "https://example.com" });

    expect(props.narration).toBeUndefined();
  });

  it("omits narration when the experience has none", () => {
    const fallback = buildFallbackExperience(ANSWERS);
    const result = {
      ...fallback,
      meta: {
        model: "fallback",
        fallbackUsed: true,
        durationMs: 0,
        generatedAt: new Date(0).toISOString(),
      },
    };

    const props = reelPropsFromExperience(result);

    expect(props.narration).toBeUndefined();
  });
});

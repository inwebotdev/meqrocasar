import { describe, expect, it } from "vitest";

import { buildFallbackExperience } from "@/domain/experience/fallback";
import type { ExperienceResult } from "@/domain/experience/types";

import {
  buildMoodboardPath,
  decodeMoodboardParams,
  encodeMoodboardParams,
  moodboardParamsFromExperience,
  MoodboardParamsSchema,
  slugify,
  type MoodboardParams,
} from "./params";

const VALID_PARAMS: MoodboardParams = {
  title: "Atardecer Virreinal entre Patios de Cantera",
  zone: "Ezequiel Montes · Querétaro",
  tagline: "Romance Virreinal con Cata de Vinos",
  palette: [
    { hex: "#68182E", name: "Vino Tinto" },
    { hex: "#D4AF37", name: "Oro Cantera" },
    { hex: "#F5EDE0", name: "Lino Crudo" },
    { hex: "#2F4839", name: "Verde Musgo" },
  ],
  photos: [
    "https://images.unsplash.com/photo-1",
    "https://images.unsplash.com/photo-2",
    "https://images.unsplash.com/photo-3",
  ],
};

function buildFixtureExperience(): ExperienceResult {
  const fallback = buildFallbackExperience({
    style: "colonial",
    setting: "night_casona",
    experience: "grand_traditional",
    mustHave: "callejoneada",
  });

  return {
    ...fallback,
    meta: {
      model: "fallback",
      fallbackUsed: true,
      durationMs: 0,
      generatedAt: new Date(0).toISOString(),
    },
  };
}

describe("encodeMoodboardParams / decodeMoodboardParams", () => {
  it("round-trips a valid params object", () => {
    const encoded = encodeMoodboardParams(VALID_PARAMS);
    const decoded = decodeMoodboardParams(encoded);

    expect(decoded).toEqual({ ok: true, value: VALID_PARAMS });
  });

  it("produces a URL-safe string (no +, /, or =)", () => {
    const encoded = encodeMoodboardParams(VALID_PARAMS);
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it("rejects garbage base64", () => {
    const decoded = decodeMoodboardParams("%%%not-base64%%%");
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) expect(decoded.reason).toBe("decode");
  });

  it("rejects base64 that decodes to non-JSON", () => {
    const encoded = encodeMoodboardParams as unknown as (p: unknown) => string;
    const notJson = btoa("not json at all").replaceAll("+", "-").replaceAll("/", "_");
    const decoded = decodeMoodboardParams(notJson);
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) expect(decoded.reason).toBe("decode");
    void encoded;
  });

  it("rejects a palette with 5 colors", () => {
    const invalid = {
      ...VALID_PARAMS,
      palette: [...VALID_PARAMS.palette, { hex: "#000000", name: "Negro" }],
    };
    const encoded = encodeMoodboardParams(invalid as MoodboardParams);
    const decoded = decodeMoodboardParams(encoded);
    expect(decoded).toEqual({ ok: false, reason: "schema", detail: expect.any(String) });
  });

  it("rejects a non-Unsplash photo host", () => {
    const invalid = {
      ...VALID_PARAMS,
      photos: ["https://evil.example.com/photo-1", VALID_PARAMS.photos[1], VALID_PARAMS.photos[2]],
    };
    const encoded = encodeMoodboardParams(invalid as MoodboardParams);
    const decoded = decodeMoodboardParams(encoded);
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) expect(decoded.reason).toBe("schema");
  });

  it("accepts a same-origin Places photo proxy path", () => {
    const withPlacesPhoto: MoodboardParams = {
      ...VALID_PARAMS,
      photos: [
        "/api/places/photo?name=places%2Fabc%2Fphotos%2Fp1&w=800",
        VALID_PARAMS.photos[1],
        VALID_PARAMS.photos[2],
      ],
    };
    const encoded = encodeMoodboardParams(withPlacesPhoto);
    const decoded = decodeMoodboardParams(encoded);
    expect(decoded).toEqual({ ok: true, value: withPlacesPhoto });
  });

  it("rejects a relative path that isn't the places photo proxy", () => {
    const invalid = {
      ...VALID_PARAMS,
      photos: ["/some/other/path", VALID_PARAMS.photos[1], VALID_PARAMS.photos[2]],
    };
    const encoded = encodeMoodboardParams(invalid as MoodboardParams);
    const decoded = decodeMoodboardParams(encoded);
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) expect(decoded.reason).toBe("schema");
  });

  it("rejects extra keys (strict schema)", () => {
    const invalid = { ...VALID_PARAMS, extra: "nope" };
    const encoded = encodeMoodboardParams(invalid as MoodboardParams);
    const decoded = decodeMoodboardParams(encoded);
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) expect(decoded.reason).toBe("schema");
  });
});

describe("buildMoodboardPath", () => {
  it("contains d= and no download flag by default", () => {
    const path = buildMoodboardPath(VALID_PARAMS);
    expect(path).toMatch(/^\/api\/og\/moodboard\?d=[^&]+$/);
    expect(path).not.toContain("download=1");
  });

  it("appends download=1 when asked", () => {
    const path = buildMoodboardPath(VALID_PARAMS, { download: true });
    expect(path).toContain("d=");
    expect(path).toContain("download=1");
  });
});

describe("moodboardParamsFromExperience", () => {
  it("validates against MoodboardParamsSchema for a fallback-built fixture", () => {
    const experience = buildFixtureExperience();
    const params = moodboardParamsFromExperience(experience);

    expect(params).toBeDefined();
    expect(MoodboardParamsSchema.safeParse(params).success).toBe(true);
    expect(params?.title).toBe(experience.conceptTitle);
    expect(params?.tagline).toBe(experience.reelTagline);
    expect(params?.palette).toEqual(experience.palette);
    expect(params?.photos).toEqual(experience.photos.slice(0, 3).map((photo) => photo.url));
    expect(params?.zone).toContain("Querétaro");
  });

  it("falls back to a bare 'Querétaro' zone when there is no principal venue", () => {
    const experience = { ...buildFixtureExperience(), venues: [] };
    const params = moodboardParamsFromExperience(experience);
    expect(params?.zone).toBe("Querétaro");
  });

  it("drops an invalid photo and backfills from the remaining valid ones", () => {
    const experience = buildFixtureExperience();
    const [first, second, third] = experience.photos;
    const withBadPhoto = {
      ...experience,
      photos: [{ ...first!, url: "https://evil.example.com/photo.jpg" }, second!, third!],
    };

    const params = moodboardParamsFromExperience(withBadPhoto);

    expect(params).toBeDefined();
    expect(params?.photos).toHaveLength(3);
    expect(params?.photos).toEqual([second!.url, third!.url, third!.url]);
  });

  it("returns undefined when every photo is invalid", () => {
    const experience = buildFixtureExperience();
    const withAllBadPhotos = {
      ...experience,
      photos: experience.photos.map((photo) => ({
        ...photo,
        url: "https://evil.example.com/photo.jpg",
      })),
    };

    const params = moodboardParamsFromExperience(withAllBadPhotos);
    expect(params).toBeUndefined();
  });
});

describe("slugify", () => {
  it("lowercases, strips accents, and hyphenates", () => {
    expect(slugify("Atardecer Virreinal entre Patios de Cantera")).toBe(
      "atardecer-virreinal-entre-patios-de-cantera",
    );
  });

  it("handles accented characters and punctuation", () => {
    expect(slugify("Noche Mística del Semidesierto Queretano!")).toBe(
      "noche-mistica-del-semidesierto-queretano",
    );
  });
});

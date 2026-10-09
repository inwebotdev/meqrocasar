import { describe, expect, it } from "vitest";

import type { QuizAnswers } from "@/domain/quiz/schema";

import { PHOTOS } from "./photos";
import { photosForAnswers } from "./photos-for-answers";

const answers: QuizAnswers = {
  style: "rustic_vineyard",
  setting: "day_vineyard",
  experience: "intimate_boutique",
  mustHave: "wine_tasting",
};

describe("photosForAnswers", () => {
  it("returns the requested number of ExperiencePhoto objects", () => {
    const photos = photosForAnswers(answers, 3);
    expect(photos).toHaveLength(3);
    for (const photo of photos) {
      expect(photo.url.length).toBeGreaterThan(0);
      expect(photo.alt.length).toBeGreaterThan(0);
      expect(photo.credit.length).toBeGreaterThan(0);
    }
  });

  it("is deterministic across repeated calls", () => {
    expect(photosForAnswers(answers, 3)).toEqual(photosForAnswers(answers, 3));
  });

  it("favors vineyard/wine-tagged photos for a vineyard-leaning answer set", () => {
    const photos = photosForAnswers(answers, 3);
    const vineyardOrWineUrls = new Set(
      PHOTOS.filter((photo) => photo.tags.includes("vineyard") || photo.tags.includes("wine")).map(
        (photo) => photo.url,
      ),
    );

    expect(photos.some((photo) => vineyardOrWineUrls.has(photo.url))).toBe(true);
  });
});

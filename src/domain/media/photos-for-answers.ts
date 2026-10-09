import type { ExperiencePhoto } from "@/domain/experience/types";
import type { QuizAnswers } from "@/domain/quiz/schema";

import { findPhotos, type Photo, type PhotoTag } from "./photos";

/**
 * Maps each quiz option id to the photo tags it should favor when picking
 * photos. Keys are the fixed option ids from `src/domain/quiz/questions.ts`
 * (every id across all four steps is globally unique).
 */
const ANSWER_PHOTO_TAGS: Record<string, readonly PhotoTag[]> = {
  colonial: ["colonial", "courtyard", "bougainvillea"],
  rustic_vineyard: ["vineyard", "wine"],
  boho_chic: ["boho", "desert", "bernal"],
  modern_elegant: ["modern"],
  sunset_garden: ["garden", "sunset"],
  night_casona: ["night", "courtyard"],
  day_vineyard: ["vineyard"],
  intimate_boutique: ["chapel", "courtyard"],
  grand_traditional: ["banquet", "hacienda"],
  weekend_getaway: ["street", "hacienda"],
  wine_tasting: ["wine", "vineyard"],
  fireworks: ["fireworks", "night"],
  gourmet_mexican_banquet: ["banquet"],
  callejoneada: ["street", "night"],
};

function photoTagsFor(answers: QuizAnswers): PhotoTag[] {
  return [answers.style, answers.setting, answers.experience, answers.mustHave].flatMap(
    (optionId) => ANSWER_PHOTO_TAGS[optionId] ?? [],
  );
}

function toExperiencePhoto(photo: Photo): ExperiencePhoto {
  return { url: photo.url, alt: photo.alt, credit: photo.credit };
}

/**
 * Picks `limit` photos from the local registry whose tags best match the
 * couple's quiz answers (see `findPhotos`), ranked and deterministic.
 * Shared by the local fallback experience (`buildFallbackExperience`) and
 * the static image provider, so both pick photos the same way.
 */
export function photosForAnswers(answers: QuizAnswers, limit: number): ExperiencePhoto[] {
  return findPhotos(photoTagsFor(answers), limit).map(toExperiencePhoto);
}

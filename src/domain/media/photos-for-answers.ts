import type { ExperiencePhoto } from "@/domain/experience/types";
import type { ExperienceValue, Facets, SettingValue, StyleValue } from "@/domain/kb/taxonomy";
import type { QuizAnswers } from "@/domain/quiz/schema";

import { findPhotos, getPhoto, type Photo, type PhotoId, type PhotoTag } from "./photos";

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

// --- facets (new taxonomy) → registry photo, for the quiz engine ---------

/**
 * Maps each `style` facet value to the photo tags it should favor. Mirrors
 * `ANSWER_PHOTO_TAGS` above, keyed by the new taxonomy instead of the
 * legacy quiz option ids.
 */
const STYLE_PHOTO_TAGS: Record<StyleValue, readonly PhotoTag[]> = {
  colonial: ["colonial", "courtyard", "bougainvillea"],
  rustic_vineyard: ["vineyard", "wine"],
  boho_desert: ["boho", "desert", "bernal"],
  modern_elegant: ["modern"],
  garden_romantic: ["garden", "sunset"],
  pueblo_magico: ["street", "bernal"],
};

const SETTING_PHOTO_TAGS: Record<SettingValue, readonly PhotoTag[]> = {
  sunset_garden: ["garden", "sunset"],
  night_casona: ["night", "courtyard"],
  day_vineyard: ["vineyard"],
  rooftop_city: ["modern", "night"],
  chapel_courtyard: ["chapel", "courtyard"],
};

const EXPERIENCE_PHOTO_TAGS: Record<ExperienceValue, readonly PhotoTag[]> = {
  wine_tasting: ["wine", "vineyard"],
  vendimia: ["vineyard"],
  callejoneada: ["street", "night"],
  hot_air_balloon: ["desert", "bernal"],
  temazcal: ["desert", "boho"],
  cheese_route: ["vineyard", "wine"],
  fireworks: ["fireworks", "night"],
  gourmet_banquet: ["banquet"],
  mariachi_huapango: ["street", "night"],
  sierra_gorda_escape: ["desert", "bernal"],
};

function photoTagsForFacets(facets: Facets): PhotoTag[] {
  return [
    ...(facets.style ? STYLE_PHOTO_TAGS[facets.style] : []),
    ...(facets.setting ? SETTING_PHOTO_TAGS[facets.setting] : []),
    ...(facets.experience ? EXPERIENCE_PHOTO_TAGS[facets.experience] : []),
  ];
}

/** Deterministic last resort when no known facet matches any registry tag. */
const DEFAULT_PHOTO_ID: PhotoId = "patio-cantera-rosa";

/**
 * Picks the single best-matching registry photo for the couple's known
 * facets (see `findPhotos`), falling back to a fixed default photo rather
 * than ever returning nothing. Used by the quiz engine's image provider
 * for a single option, where the legacy `QuizAnswers` aren't available.
 */
export function photoForFacets(facets: Facets): ExperiencePhoto {
  const [photo] = findPhotos(photoTagsForFacets(facets), 1);
  return toExperiencePhoto(photo ?? getPhoto(DEFAULT_PHOTO_ID));
}

/**
 * Picks the single best-matching registry photo for a KB venue's own
 * (multi-valued) facets, falling back to the same fixed default as
 * `photoForFacets`. Used to pick a fallback photo for a venue whose only
 * photo is a Places one that can't currently be served (see
 * `src/domain/places/fallback-photo.ts`).
 */
export function photoForVenueFacets(facets: {
  styles: readonly StyleValue[];
  settings: readonly SettingValue[];
  experiences: readonly ExperienceValue[];
}): ExperiencePhoto {
  const tags = [
    ...facets.styles.flatMap((style) => STYLE_PHOTO_TAGS[style] ?? []),
    ...facets.settings.flatMap((setting) => SETTING_PHOTO_TAGS[setting] ?? []),
    ...facets.experiences.flatMap((experience) => EXPERIENCE_PHOTO_TAGS[experience] ?? []),
  ];
  const [photo] = findPhotos(tags, 1);
  return toExperiencePhoto(photo ?? getPhoto(DEFAULT_PHOTO_ID));
}

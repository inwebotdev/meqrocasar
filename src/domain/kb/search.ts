import { loadKb } from "./load";
import type { Facets, ZoneValue } from "./taxonomy";
import type { KbExperience, KbVenue, KbZone } from "./types";

/**
 * Ranking and lookups over the curated knowledge base. Every ranking
 * function is deterministic: ties are always broken by name, so the same
 * facets always produce the same order.
 */

const VENUE_WEIGHTS = {
  style: 3,
  setting: 2,
  experience: 2,
  zone: 2,
  scale: 1,
  budget: 1,
} as const;

/**
 * Weighted facet overlap between a venue and the couple's known facets,
 * plus a small prior from Google rating/review count when the venue has
 * one (curated-only venues have neither, so they score purely on overlap).
 */
export function scoreVenue(venue: KbVenue, facets: Facets): number {
  let score = 0;

  if (facets.style && venue.facets.styles.includes(facets.style)) {
    score += VENUE_WEIGHTS.style;
  }
  if (facets.setting && venue.facets.settings.includes(facets.setting)) {
    score += VENUE_WEIGHTS.setting;
  }
  if (facets.experience && venue.facets.experiences.includes(facets.experience)) {
    score += VENUE_WEIGHTS.experience;
  }
  if (facets.zone && venue.zone === facets.zone) {
    score += VENUE_WEIGHTS.zone;
  }
  if (facets.scale && venue.facets.scale.includes(facets.scale)) {
    score += VENUE_WEIGHTS.scale;
  }
  if (facets.budget && venue.facets.budget === facets.budget) {
    score += VENUE_WEIGHTS.budget;
  }

  if (typeof venue.userRatingCount === "number") {
    score += Math.log10(venue.userRatingCount + 1) * 0.3;
  }
  if (typeof venue.rating === "number") {
    score += (venue.rating - 4) * 0.5;
  }

  return score;
}

export interface SearchVenuesOptions {
  facets: Facets;
  zone?: ZoneValue;
  limit?: number;
}

/**
 * Ranks venues by `scoreVenue`, highest first, ties broken by name
 * (es-MX collation) so the result is deterministic for a given input.
 */
export function searchVenues({ facets, zone, limit = 25 }: SearchVenuesOptions): KbVenue[] {
  const { venues } = loadKb();
  const candidates = zone ? venues.filter((venue) => venue.zone === zone) : venues;

  return candidates
    .map((venue) => ({ venue, score: scoreVenue(venue, facets) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.venue.name.localeCompare(b.venue.name, "es");
    })
    .slice(0, limit)
    .map((entry) => entry.venue);
}

const EXPERIENCE_WEIGHTS = {
  experience: 3,
  style: 2,
  setting: 2,
  zone: 1,
  season: 1,
  budget: 1,
} as const;

function scoreExperience(experience: KbExperience, facets: Facets): number {
  let score = 0;

  if (facets.experience && experience.facets.experiences.includes(facets.experience)) {
    score += EXPERIENCE_WEIGHTS.experience;
  }
  if (facets.style && experience.facets.styles?.includes(facets.style)) {
    score += EXPERIENCE_WEIGHTS.style;
  }
  if (facets.setting && experience.facets.settings?.includes(facets.setting)) {
    score += EXPERIENCE_WEIGHTS.setting;
  }
  if (facets.zone && experience.zoneIds.includes(facets.zone)) {
    score += EXPERIENCE_WEIGHTS.zone;
  }
  if (facets.season && experience.seasons.includes(facets.season)) {
    score += EXPERIENCE_WEIGHTS.season;
  }
  if (facets.budget && experience.priceTier === facets.budget) {
    score += EXPERIENCE_WEIGHTS.budget;
  }

  return score;
}

/**
 * Ranks curated experiences by overlap with the couple's known facets,
 * same determinism guarantees as `searchVenues`.
 */
export function experiencesFor(facets: Facets, limit = 12): KbExperience[] {
  const { experiences } = loadKb();

  return experiences
    .map((experience) => ({ experience, score: scoreExperience(experience, facets) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.experience.name.localeCompare(b.experience.name, "es");
    })
    .slice(0, limit)
    .map((entry) => entry.experience);
}

export function getVenue(id: string): KbVenue | undefined {
  return loadKb().venues.find((venue) => venue.id === id);
}

export function getExperience(id: string): KbExperience | undefined {
  return loadKb().experiences.find((experience) => experience.id === id);
}

export function getZone(id: ZoneValue): KbZone | undefined {
  return loadKb().zones.find((zone) => zone.id === id);
}

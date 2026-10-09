import type { QuizAnswers } from "@/domain/quiz/schema";

import { VENUES } from "./catalog";
import type { Venue, VenueTag } from "./types";

const STOP_WORDS = new Set([
  "hacienda",
  "haciendas",
  "vinedos",
  "vinedo",
  "finca",
  "hotel",
  "by",
  "de",
  "los",
  "la",
  "el",
  "las",
]);

/**
 * Lowercases, strips accents and punctuation, collapses whitespace and
 * drops common venue "noise" words so two spellings of the same venue name
 * normalize to the same string.
 */
export function normalizeName(input: string): string {
  const withoutAccents = input.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  const withoutPunctuation = withoutAccents.replace(/[^a-z0-9\s]/g, " ");

  const tokens = withoutPunctuation
    .split(/\s+/)
    .filter((token) => token.length > 0 && !STOP_WORDS.has(token));

  return tokens.join(" ");
}

interface VenueIndexEntry {
  venue: Venue;
  normalizedNames: string[];
}

function buildIndex(): VenueIndexEntry[] {
  return VENUES.map((venue) => ({
    venue,
    normalizedNames: [venue.name, ...venue.aliases].map(normalizeName),
  }));
}

function diceCoefficient(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) {
      intersection += 1;
    }
  }

  return (2 * intersection) / (a.size + b.size);
}

const TOKEN_OVERLAP_THRESHOLD = 0.5;

/**
 * Resolves a free-text venue name (as typed by a user or returned by the
 * LLM) to a catalog venue. Tries an exact match on the normalized name or
 * one of its aliases first, then falls back to the best Dice-coefficient
 * token overlap at or above 0.5. Ties are broken by catalog order.
 */
export function matchVenue(name: string): Venue | undefined {
  const normalizedQuery = normalizeName(name);

  if (normalizedQuery.length === 0) {
    return undefined;
  }

  const index = buildIndex();

  for (const entry of index) {
    if (entry.normalizedNames.includes(normalizedQuery)) {
      return entry.venue;
    }
  }

  const queryTokens = new Set(normalizedQuery.split(" ").filter(Boolean));
  let best: { venue: Venue; score: number } | undefined;

  for (const entry of index) {
    for (const normalizedName of entry.normalizedNames) {
      const nameTokens = new Set(normalizedName.split(" ").filter(Boolean));
      const score = diceCoefficient(queryTokens, nameTokens);

      if (score >= TOKEN_OVERLAP_THRESHOLD && (!best || score > best.score)) {
        best = { venue: entry.venue, score };
      }
    }
  }

  return best?.venue;
}

/**
 * Maps each quiz option id to the venue tags it should favor when ranking
 * venues. Keys are the fixed option ids from `src/domain/quiz/questions.ts`
 * (every id across all four steps is globally unique).
 */
export const ANSWER_VENUE_TAGS: Record<string, readonly VenueTag[]> = {
  colonial: ["colonial", "casona", "hacienda"],
  rustic_vineyard: ["vineyard", "wine_cellar"],
  boho_chic: ["boho", "desert", "pueblo_magico"],
  modern_elegant: ["modern"],
  sunset_garden: ["garden", "sunset"],
  night_casona: ["night", "casona"],
  day_vineyard: ["day", "vineyard"],
  intimate_boutique: ["intimate", "lodging"],
  grand_traditional: ["grand"],
  weekend_getaway: ["weekend", "lodging", "pueblo_magico"],
  wine_tasting: ["wine_tasting", "vineyard"],
  fireworks: ["fireworks", "grand"],
  gourmet_mexican_banquet: ["gourmet"],
  callejoneada: ["callejoneada", "pueblo_magico"],
};

function wantedTagsFor(answers: QuizAnswers): VenueTag[] {
  return [answers.style, answers.setting, answers.experience, answers.mustHave].flatMap(
    (optionId) => ANSWER_VENUE_TAGS[optionId] ?? [],
  );
}

/**
 * Ranks every catalog venue by how many of the answers' mapped tags it
 * carries (summed across all four answers, so a venue matching several
 * answers outranks one matching only one strongly). Ties are broken by
 * catalog order, so the result is stable for a given answer set.
 */
export function rankVenues(answers: QuizAnswers, limit = 2): Venue[] {
  const wantedTags = wantedTagsFor(answers);

  return VENUES.map((venue, index) => ({
    venue,
    index,
    score: wantedTags.reduce((count, tag) => (venue.tags.includes(tag) ? count + 1 : count), 0),
  }))
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.index - b.index))
    .slice(0, limit)
    .map((entry) => entry.venue);
}

import type { QuizAnswers } from "@/domain/quiz/schema";
import type { Venue, VenueTag } from "@/domain/venues/types";

import type { BudgetValue, Facets, StyleValue, ZoneValue } from "./taxonomy";

/**
 * Bridges the first stack's fixed 4-question quiz and venue catalog onto
 * the new facet taxonomy, so old data (the 12 curated venues, the step-1
 * decks) keeps working unchanged while every new module reasons purely in
 * terms of `Facets`.
 */

// --- quiz answers → facets ------------------------------------------------

type StyleId = QuizAnswers["style"];
type MustHaveId = QuizAnswers["mustHave"];
type ExperienceId = QuizAnswers["experience"];

const LEGACY_STYLE_TO_FACET: Record<StyleId, StyleValue> = {
  colonial: "colonial",
  rustic_vineyard: "rustic_vineyard",
  boho_chic: "boho_desert",
  modern_elegant: "modern_elegant",
};

const LEGACY_MUST_HAVE_TO_EXPERIENCE_FACET: Record<MustHaveId, Facets["experience"]> = {
  wine_tasting: "wine_tasting",
  fireworks: "fireworks",
  gourmet_mexican_banquet: "gourmet_banquet",
  callejoneada: "callejoneada",
};

/**
 * The old "experience" step (`intimate_boutique` | `grand_traditional` |
 * `weekend_getaway`) is really about party scale, with the weekend getaway
 * also implying the couple wants lodging for their guests.
 */
const LEGACY_EXPERIENCE_TO_FACETS: Record<ExperienceId, Facets> = {
  intimate_boutique: { scale: "intimate" },
  grand_traditional: { scale: "grand" },
  weekend_getaway: { scale: "medium", lodging: "needed" },
};

/**
 * Converts the old 4-answer quiz shape into `Facets`. The old `setting`
 * answer ids (`sunset_garden`, `night_casona`, `day_vineyard`) are already
 * a subset of the new `setting` taxonomy, so they carry over unchanged.
 */
export function facetsFromLegacyAnswers(answers: QuizAnswers): Facets {
  return {
    style: LEGACY_STYLE_TO_FACET[answers.style],
    setting: answers.setting,
    experience: LEGACY_MUST_HAVE_TO_EXPERIENCE_FACET[answers.mustHave],
    ...LEGACY_EXPERIENCE_TO_FACETS[answers.experience],
  };
}

// --- venue tags → facets ------------------------------------------------

/**
 * Maps each old `VenueTag` to the single facet it best represents. Applied
 * in tag order with later tags winning a given facet key (same precedence
 * rule as `foldFacets`), so a venue with both "hacienda" and "modern" tags
 * ends up with `style: "modern_elegant"`.
 */
const TAG_TO_FACETS: Record<VenueTag, Facets> = {
  colonial: { style: "colonial" },
  casona: { style: "colonial" },
  hacienda: { style: "colonial" },
  vineyard: { style: "rustic_vineyard" },
  wine_cellar: { experience: "wine_tasting" },
  garden: { style: "garden_romantic" },
  chapel: { setting: "chapel_courtyard" },
  lodging: { lodging: "needed" },
  modern: { style: "modern_elegant" },
  boho: { style: "boho_desert" },
  desert: { style: "boho_desert" },
  night: { setting: "night_casona" },
  sunset: { setting: "sunset_garden" },
  day: { setting: "day_vineyard" },
  intimate: { scale: "intimate" },
  grand: { scale: "grand" },
  weekend: { lodging: "needed" },
  wine_tasting: { experience: "wine_tasting" },
  fireworks: { experience: "fireworks" },
  gourmet: { experience: "gourmet_banquet" },
  callejoneada: { experience: "callejoneada" },
  pueblo_magico: { style: "pueblo_magico" },
};

/**
 * Folds a venue's old tags into `Facets`, one value per key, later tags
 * winning. Used to seed `data/kb/venues.json` from the 12 curated venues
 * (then hand-corrected where the automatic mapping is too coarse).
 */
export function facetsFromVenueTags(tags: readonly VenueTag[]): Facets {
  return tags.reduce<Facets>((facets, tag) => ({ ...facets, ...TAG_TO_FACETS[tag] }), {});
}

// --- misc legacy field mappings ------------------------------------------

const PRICE_CATEGORY_TO_BUDGET: Record<Venue["priceCategory"], BudgetValue> = {
  Medio: "medio",
  "Medio-Alto": "medio_alto",
  Exclusivo: "exclusivo",
};

/** Maps the old `Venue.priceCategory` field (not a tag) onto the new `budget` facet. */
export function budgetFromPriceCategory(priceCategory: Venue["priceCategory"]): BudgetValue {
  return PRICE_CATEGORY_TO_BUDGET[priceCategory];
}

const ZONE_DISPLAY_TO_VALUE: Record<Venue["zone"], ZoneValue> = {
  "Centro Histórico": "centro_historico",
  Huimilpan: "huimilpan",
  "Ezequiel Montes": "ezequiel_montes",
  Bernal: "bernal",
  Tequisquiapan: "tequisquiapan",
  "San Juan del Río": "san_juan_del_rio",
  Colón: "colon",
  "El Marqués": "el_marques",
};

/** Maps the old `Venue.zone` display string onto the new `zone` taxonomy id. */
export function zoneValueFromLegacyZone(zone: Venue["zone"]): ZoneValue {
  return ZONE_DISPLAY_TO_VALUE[zone];
}

import { z } from "zod";

/**
 * The closed facet vocabulary the quiz engine, the knowledge base and the
 * final generation all reason about. Every enum below is a single source
 * of truth: a runtime `as const` tuple that both the TypeScript union and
 * the Zod schema derive from, plus an es-MX display label for chips.
 *
 * This module is pure TypeScript: no React, no Next.js, no `server-only`.
 */

// --- style ------------------------------------------------------------

export const STYLE_VALUES = [
  "colonial",
  "rustic_vineyard",
  "boho_desert",
  "modern_elegant",
  "garden_romantic",
  "pueblo_magico",
] as const;

export type StyleValue = (typeof STYLE_VALUES)[number];

export const StyleSchema = z.enum(STYLE_VALUES);

// --- setting ------------------------------------------------------------

export const SETTING_VALUES = [
  "sunset_garden",
  "night_casona",
  "day_vineyard",
  "rooftop_city",
  "chapel_courtyard",
] as const;

export type SettingValue = (typeof SETTING_VALUES)[number];

export const SettingSchema = z.enum(SETTING_VALUES);

// --- scale ------------------------------------------------------------

/** `intimate` is ≤60 guests, `medium` is ≤150, `grand` is >150. */
export const SCALE_VALUES = ["intimate", "medium", "grand"] as const;

export type ScaleValue = (typeof SCALE_VALUES)[number];

export const ScaleSchema = z.enum(SCALE_VALUES);

/** Upper guest-count bound for each scale, `null` meaning "no upper bound". */
export const SCALE_MAX_GUESTS: Record<ScaleValue, number | null> = {
  intimate: 60,
  medium: 150,
  grand: null,
};

// --- zone ------------------------------------------------------------

export const ZONE_VALUES = [
  "centro_historico",
  "huimilpan",
  "ezequiel_montes",
  "bernal",
  "tequisquiapan",
  "san_juan_del_rio",
  "colon",
  "el_marques",
  "cadereyta",
  "sierra_gorda",
] as const;

export type ZoneValue = (typeof ZONE_VALUES)[number];

export const ZoneSchema = z.enum(ZONE_VALUES);

// --- experience ------------------------------------------------------------

export const EXPERIENCE_VALUES = [
  "wine_tasting",
  "vendimia",
  "callejoneada",
  "hot_air_balloon",
  "temazcal",
  "cheese_route",
  "fireworks",
  "gourmet_banquet",
  "mariachi_huapango",
  "sierra_gorda_escape",
] as const;

export type ExperienceValue = (typeof EXPERIENCE_VALUES)[number];

export const ExperienceSchema = z.enum(EXPERIENCE_VALUES);

// --- budget ------------------------------------------------------------

export const BUDGET_VALUES = ["medio", "medio_alto", "exclusivo"] as const;

export type BudgetValue = (typeof BUDGET_VALUES)[number];

export const BudgetSchema = z.enum(BUDGET_VALUES);

// --- lodging ------------------------------------------------------------

export const LODGING_VALUES = ["needed", "not_needed"] as const;

export type LodgingValue = (typeof LODGING_VALUES)[number];

export const LodgingSchema = z.enum(LODGING_VALUES);

// --- season ------------------------------------------------------------

export const SEASON_VALUES = ["primavera", "verano", "otono", "invierno"] as const;

export type SeasonValue = (typeof SEASON_VALUES)[number];

export const SeasonSchema = z.enum(SEASON_VALUES);

// --- facets ------------------------------------------------------------

/** Every facet key, in the order the taxonomy declares them. */
export const FACET_KEYS = [
  "style",
  "setting",
  "scale",
  "zone",
  "experience",
  "budget",
  "lodging",
  "season",
] as const;

export type FacetKey = (typeof FACET_KEYS)[number];

interface FacetValueMap {
  style: StyleValue;
  setting: SettingValue;
  scale: ScaleValue;
  zone: ZoneValue;
  experience: ExperienceValue;
  budget: BudgetValue;
  lodging: LodgingValue;
  season: SeasonValue;
}

export type FacetValue<K extends FacetKey> = FacetValueMap[K];

/** A couple's known answers so far: at most one value per facet key. */
export type Facets = Partial<FacetValueMap>;

export const FacetsSchema = z
  .object({
    style: StyleSchema.optional(),
    setting: SettingSchema.optional(),
    scale: ScaleSchema.optional(),
    zone: ZoneSchema.optional(),
    experience: ExperienceSchema.optional(),
    budget: BudgetSchema.optional(),
    lodging: LodgingSchema.optional(),
    season: SeasonSchema.optional(),
  })
  .strict();

/**
 * The order the quiz engine should prioritize filling unknown facets,
 * after `style` (always answered first, in step 1).
 */
export const FACET_PRIORITY = [
  "setting",
  "scale",
  "experience",
  "zone",
  "budget",
  "lodging",
  "season",
] as const satisfies readonly Exclude<FacetKey, "style">[];

export type FacetPriority = (typeof FACET_PRIORITY)[number];

// --- labels ------------------------------------------------------------

const STYLE_LABELS: Record<StyleValue, string> = {
  colonial: "Colonial",
  rustic_vineyard: "Rústico Viñedo",
  boho_desert: "Boho Semidesierto",
  modern_elegant: "Moderno Elegante",
  garden_romantic: "Jardín Romántico",
  pueblo_magico: "Pueblo Mágico",
};

const SETTING_LABELS: Record<SettingValue, string> = {
  sunset_garden: "Atardecer de Jardín",
  night_casona: "Noche de Casona",
  day_vineyard: "Día de Viñedo",
  rooftop_city: "Azotea Urbana",
  chapel_courtyard: "Patio de Capilla",
};

const SCALE_LABELS: Record<ScaleValue, string> = {
  intimate: "Íntima (hasta 60)",
  medium: "Mediana (hasta 150)",
  grand: "Grande (más de 150)",
};

const ZONE_LABELS: Record<ZoneValue, string> = {
  centro_historico: "Centro Histórico",
  huimilpan: "Huimilpan",
  ezequiel_montes: "Ezequiel Montes",
  bernal: "Bernal",
  tequisquiapan: "Tequisquiapan",
  san_juan_del_rio: "San Juan del Río",
  colon: "Colón",
  el_marques: "El Marqués",
  cadereyta: "Cadereyta",
  sierra_gorda: "Sierra Gorda",
};

const EXPERIENCE_LABELS: Record<ExperienceValue, string> = {
  wine_tasting: "Cata de Vinos",
  vendimia: "Vendimia",
  callejoneada: "Callejoneada",
  hot_air_balloon: "Globo Aerostático",
  temazcal: "Temazcal",
  cheese_route: "Ruta del Queso",
  fireworks: "Fuegos Artificiales",
  gourmet_banquet: "Banquete Gourmet",
  mariachi_huapango: "Mariachi y Huapango",
  sierra_gorda_escape: "Escapada Sierra Gorda",
};

const BUDGET_LABELS: Record<BudgetValue, string> = {
  medio: "Medio",
  medio_alto: "Medio-Alto",
  exclusivo: "Exclusivo",
};

const LODGING_LABELS: Record<LodgingValue, string> = {
  needed: "Con Hospedaje",
  not_needed: "Sin Hospedaje",
};

const SEASON_LABELS: Record<SeasonValue, string> = {
  primavera: "Primavera",
  verano: "Verano",
  otono: "Otoño",
  invierno: "Invierno",
};

interface FacetLabelMap {
  style: typeof STYLE_LABELS;
  setting: typeof SETTING_LABELS;
  scale: typeof SCALE_LABELS;
  zone: typeof ZONE_LABELS;
  experience: typeof EXPERIENCE_LABELS;
  budget: typeof BUDGET_LABELS;
  lodging: typeof LODGING_LABELS;
  season: typeof SEASON_LABELS;
}

const FACET_LABELS: FacetLabelMap = {
  style: STYLE_LABELS,
  setting: SETTING_LABELS,
  scale: SCALE_LABELS,
  zone: ZONE_LABELS,
  experience: EXPERIENCE_LABELS,
  budget: BUDGET_LABELS,
  lodging: LODGING_LABELS,
  season: SEASON_LABELS,
};

/** Returns the es-MX chip label for a facet value, e.g. `facetLabel("zone", "bernal")` → "Bernal". */
export function facetLabel<K extends FacetKey>(key: K, value: FacetValue<K>): string {
  const labels = FACET_LABELS[key] as Record<string, string>;
  return labels[value as string];
}

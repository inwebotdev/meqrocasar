import type { Facets } from "@/domain/kb/taxonomy";
import { photosForAnswers } from "@/domain/media/photos-for-answers";
import { getOption } from "@/domain/quiz/questions";
import type { QuizAnswers } from "@/domain/quiz/schema";
import { legacyAnswersFromFacets, type Transcript } from "@/domain/quiz/transcript";
import { matchVenue, rankVenues } from "@/domain/venues/match";
import type { Venue } from "@/domain/venues/types";

import type { LlmExperience } from "./schema";
import type { ExperienceResult, ExperienceVenue, PaletteColor } from "./types";

type StyleId = QuizAnswers["style"];
type SettingId = QuizAnswers["setting"];
type ExperienceId = QuizAnswers["experience"];
type MustHaveId = QuizAnswers["mustHave"];

// --- Concept titles, keyed by style x setting -----------------------------

const CONCEPT_TITLES: Record<StyleId, Record<SettingId, string>> = {
  colonial: {
    sunset_garden: "Atardecer Virreinal entre Patios de Cantera",
    night_casona: "Noche Virreinal en Casona de Cantera",
    day_vineyard: "Mañana Colonial entre Viñedos y Cantera",
  },
  rustic_vineyard: {
    sunset_garden: "Atardecer Rústico entre Viñedos Centenarios",
    night_casona: "Noche de Vendimia bajo las Estrellas",
    day_vineyard: "Día de Vendimia en los Viñedos de Ezequiel Montes",
  },
  boho_chic: {
    sunset_garden: "Atardecer Boho a los Pies de la Peña de Bernal",
    night_casona: "Noche Mística del Semidesierto Queretano",
    day_vineyard: "Día Boho entre Viñedos y Horizonte Semidesértico",
  },
  modern_elegant: {
    sunset_garden: "Atardecer Contemporáneo de Luz y Jardín",
    night_casona: "Noche de Diseño Sensorial en Cava Virreinal",
    day_vineyard: "Día Elegante entre Arquitectura y Viñedo",
  },
};

// --- Color palettes, keyed by style ---------------------------------------

const PALETTES: Record<StyleId, readonly [PaletteColor, PaletteColor, PaletteColor, PaletteColor]> =
  {
    colonial: [
      { hex: "#68182E", name: "Vino Tinto" },
      { hex: "#D4AF37", name: "Oro Cantera" },
      { hex: "#F5EDE0", name: "Lino Crudo" },
      { hex: "#2F4839", name: "Verde Musgo" },
    ],
    rustic_vineyard: [
      { hex: "#5B1A2B", name: "Vino de Barrica" },
      { hex: "#4B5E3A", name: "Verde Viñedo" },
      { hex: "#C9A227", name: "Oro Vendimia" },
      { hex: "#D9C7A3", name: "Beige Barrica" },
    ],
    boho_chic: [
      { hex: "#B5651D", name: "Terracota Bernal" },
      { hex: "#D2A679", name: "Ocre Semidesierto" },
      { hex: "#EFE1C6", name: "Beige Otomí" },
      { hex: "#8A9A5B", name: "Verde Pampa" },
    ],
    modern_elegant: [
      { hex: "#5E1026", name: "Borgoña Moderno" },
      { hex: "#C9A66B", name: "Dorado Satinado" },
      { hex: "#F4F1EC", name: "Blanco Hueso" },
      { hex: "#1F3D2B", name: "Verde Botella" },
    ],
  };

// --- Search query terms, keyed by style / setting --------------------------

const STYLE_SEARCH_TERMS: Record<StyleId, readonly [string, string]> = {
  colonial: ["colonial hacienda courtyard mexico", "cantera stone arches wedding"],
  rustic_vineyard: ["vineyard wedding mexico", "wine barrel cellar wedding"],
  boho_chic: ["boho desert wedding mexico", "pampas grass bohemian wedding"],
  modern_elegant: ["modern minimalist wedding", "elegant concrete wedding decor"],
};

const SETTING_SEARCH_TERM: Record<SettingId, string> = {
  sunset_garden: "garden wedding sunset",
  night_casona: "candlelit night wedding",
  day_vineyard: "daytime vineyard wedding",
};

function buildSearchQueries(answers: QuizAnswers): [string, string, string] {
  const [first, second] = STYLE_SEARCH_TERMS[answers.style];
  return [first, second, SETTING_SEARCH_TERM[answers.setting]];
}

// --- Narrative sentences, keyed by each answer ------------------------------

const STYLE_NARRATIVE: Record<StyleId, string> = {
  colonial:
    "Imaginan su boda entre patios de cantera rosa y casonas virreinales, con candiles de cristal y fuentes coloniales que evocan el Centro Histórico de Querétaro",
  rustic_vineyard:
    "Sueñan con una celebración rústica entre parras centenarias y barricas de roble, con maridajes de quesos artesanales bajo el cielo de Ezequiel Montes",
  boho_chic:
    "Visualizan una boda boho chic con la silueta de la Peña de Bernal como testigo, entre pampas, cactus monumentales y texturas artesanales otomíes",
  modern_elegant:
    "Prefieren una puesta en escena elegante y contemporánea, con arquitectura vanguardista, espejos de agua y diseño lumínico de autor",
};

const SETTING_NARRATIVE: Record<SettingId, string> = {
  sunset_garden:
    "El momento elegido es el atardecer, cuando la luz dorada se filtra entre los jardines y todo se tiñe de calidez",
  night_casona:
    "Eligieron la noche, cuando los candiles y la cantera iluminada envuelven cada rincón de misterio y romance",
  day_vineyard:
    "Prefieren la claridad del día, con el aroma a uva recién cortada flotando entre las hileras de vides",
};

const EXPERIENCE_NARRATIVE: Record<ExperienceId, string> = {
  intimate_boutique:
    "Para ellos, lo íntimo es protagonista: una celebración boutique para los invitados más cercanos",
  grand_traditional:
    "Imaginan una gran fiesta tradicional, con mariachi, banquete abundante e invitados celebrando hasta el amanecer",
  weekend_getaway:
    "Piensan en una escapada de fin de semana completa, para que sus invitados vivan Querétaro con calma",
};

const MUST_HAVE_NARRATIVE: Record<MustHaveId, string> = {
  wine_tasting: "Una cata de vinos queretanos es el detalle que no puede faltar",
  fireworks: "Un castillo de fuegos artificiales cerrará la noche con un último destello de magia",
  gourmet_mexican_banquet:
    "Un banquete gourmet mexicano, con mixiotes y moles de la región, será el centro de la mesa",
  callejoneada: "Una callejoneada nocturna con estudiantina pondrá el broche festivo a la velada",
};

function buildNarrative(answers: QuizAnswers, rankedVenues: readonly { name: string }[]): string {
  const [primaryVenue, secondaryVenue] = rankedVenues;

  const paragraph1 = [
    `${STYLE_NARRATIVE[answers.style]}.`,
    `${SETTING_NARRATIVE[answers.setting]}.`,
    primaryVenue
      ? `En este boceto, ${primaryVenue.name} aparece como el escenario perfecto para dar vida a esa visión.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const paragraph2 = [
    `${EXPERIENCE_NARRATIVE[answers.experience]}.`,
    `${MUST_HAVE_NARRATIVE[answers.mustHave]}.`,
    secondaryVenue
      ? `Muy cerca, ${secondaryVenue.name} ofrece un complemento ideal para completar la experiencia.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `${paragraph1}\n\n${paragraph2}`;
}

// --- Reel tagline, keyed by style / mustHave --------------------------------

const STYLE_TAGLINE: Record<StyleId, string> = {
  colonial: "Romance Virreinal",
  rustic_vineyard: "Romance entre Viñedos",
  boho_chic: "Romance Boho en el Semidesierto",
  modern_elegant: "Romance Contemporáneo",
};

const MUST_HAVE_TAGLINE: Record<MustHaveId, string> = {
  wine_tasting: "con Cata de Vinos",
  fireworks: "con Fuegos Artificiales",
  gourmet_mexican_banquet: "con Banquete Gourmet",
  callejoneada: "con Callejoneada",
};

function buildReelTagline(answers: QuizAnswers): string {
  return `${STYLE_TAGLINE[answers.style]} ${MUST_HAVE_TAGLINE[answers.mustHave]}`;
}

function reasonFor(answers: QuizAnswers, venueTags: readonly string[]): string {
  const overlap = venueTags.slice(0, 2).join(" y ");
  const styleTitle = getOption("style", answers.style).title;
  return `Resuena con el estilo ${styleTitle} que eligieron, por su conexión con ${overlap}.`;
}

const VENUES_FALLBACK_POOL = 12;

/**
 * Maps LLM-recommended venues to real catalog venues via `matchVenue`,
 * drops anything unmatched, dedupes, and fills up to 2 entries with
 * `rankVenues` when fewer than 2 were matched. The first entry is always
 * `principal`, the rest `destacada`.
 */
export function assembleVenues(
  llmVenues: readonly LlmExperience["recommendedVenues"][number][],
  answers: QuizAnswers,
): ExperienceVenue[] {
  const result: ExperienceVenue[] = [];
  const seenIds = new Set<string>();

  for (const candidate of llmVenues) {
    if (result.length >= 2) break;

    const venue = matchVenue(candidate.name);
    if (!venue || seenIds.has(venue.id)) continue;

    seenIds.add(venue.id);
    result.push({
      ...venue,
      reason: candidate.reason,
      role: result.length === 0 ? "principal" : "destacada",
    });
  }

  if (result.length < 2) {
    const fallbackRanked = rankVenues(answers, VENUES_FALLBACK_POOL);

    for (const venue of fallbackRanked) {
      if (result.length >= 2) break;
      if (seenIds.has(venue.id)) continue;

      seenIds.add(venue.id);
      result.push({
        ...venue,
        reason: reasonFor(answers, venue.tags),
        role: result.length === 0 ? "principal" : "destacada",
      });
    }
  }

  return result;
}

function toExperienceVenue(
  venue: Venue,
  answers: QuizAnswers,
  role: ExperienceVenue["role"],
): ExperienceVenue {
  return {
    ...venue,
    reason: reasonFor(answers, venue.tags),
    role,
  };
}

/**
 * Deterministic, offline experience built entirely from local tables and
 * the venue/photo catalogs. No randomness, no network calls: the same
 * answers always produce the same result. Used when the LLM call fails,
 * times out, or is skipped.
 */
export function buildFallbackExperience(answers: QuizAnswers): Omit<ExperienceResult, "meta"> {
  const rankedVenues = rankVenues(answers, 2);
  const venues = rankedVenues.map((venue, index) =>
    toExperienceVenue(venue, answers, index === 0 ? "principal" : "destacada"),
  );

  return {
    conceptTitle: CONCEPT_TITLES[answers.style][answers.setting],
    palette: [...PALETTES[answers.style]],
    narrative: buildNarrative(answers, rankedVenues),
    reelTagline: buildReelTagline(answers),
    searchQueries: buildSearchQueries(answers),
    venues,
    photos: photosForAnswers(answers, 3),
    answers,
  };
}

/**
 * Deterministic, offline experience built from the couple's folded
 * `Facets` instead of the legacy 4-answer shape: maps the facets onto
 * their closest legacy answer ids (`legacyAnswersFromFacets`) and reuses
 * the exact same deterministic tables as `buildFallbackExperience`
 * (keyed by legacy style × setting), so a transcript that never reaches
 * the LLM still gets a sensible, fully offline result. `transcript` and
 * `facets` are attached to the result (and `answers` omitted) so the UI
 * and `MetaFooter` can tell this came from the adaptive engine.
 */
export function buildFallbackExperienceFromFacets(
  facets: Facets,
  transcript?: Transcript,
): Omit<ExperienceResult, "meta"> {
  const legacyAnswers = legacyAnswersFromFacets(facets);
  const base = buildFallbackExperience(legacyAnswers);

  return {
    ...base,
    answers: undefined,
    transcript,
    facets,
  };
}

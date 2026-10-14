import {
  BUDGET_VALUES,
  LODGING_VALUES,
  SEASON_VALUES,
  facetLabel,
  type BudgetValue,
  type Facets,
  type LodgingValue,
  type SeasonValue,
  type ZoneValue,
} from "@/domain/kb/taxonomy";
import type { Kb, KbVenue } from "@/domain/kb/types";
import { photoForFacets } from "@/domain/media/photos-for-answers";

import type { GeneratedRefs, ResolvedOption, ResolvedStep } from "./generated-step";

/**
 * Deterministic, offline "steps" for the three facets the LLM never needs
 * to be asked about: `budget`, `lodging` and `season` have a small, fixed
 * vocabulary with no real coherence risk (unlike `setting`/`scale`/
 * `experience`, which benefit from the model grounding options in real
 * KB venues/experiences) and no curated deck of their own — so rather
 * than burning an LLM call (or falling back to a curated step that has
 * nothing to say about them, see `engine.ts`), the engine asks these
 * three with a fixed, hand-written question whose option copy mentions
 * the couple's already-chosen venue or zone by name when known.
 *
 * Pure TypeScript: no React, no Next.js, no `server-only`.
 */

export type TemplateFacet = "budget" | "lodging" | "season";

export interface TemplateStepInput {
  known: Facets;
  /** The venue the couple already chose, when one was ever cited in a refs.venueIds — resolved by the caller (engine.ts). */
  chosenVenue?: KbVenue;
  kb: Kb;
}

const SELECT_LABEL = "Elegir esta opción";
const NO_REFS: GeneratedRefs = { venueIds: [], experienceIds: [] };

/** The venue or zone display name to weave into option copy, when either is known. A chosen venue always wins over a merely-known zone. */
function placeName(input: TemplateStepInput): string | undefined {
  if (input.chosenVenue) {
    return input.chosenVenue.name;
  }
  if (input.known.zone) {
    const zone = input.kb.zones.find((candidate) => candidate.id === input.known.zone);
    return zone?.name ?? facetLabel("zone", input.known.zone);
  }
  return undefined;
}

interface OptionCopy<V extends string> {
  id: string;
  title: string;
  badge: string;
  matchLabel: string;
  hashtags: [string, string, string];
  /** `place` is the couple's chosen venue/zone name, when known. */
  describe: (place: string | undefined) => string;
  value: V;
}

function buildOption<V extends string>(
  copy: OptionCopy<V>,
  targetFacet: TemplateFacet,
  place: string | undefined,
  knownForPhoto: Facets,
): ResolvedOption {
  const facets: Facets = { ...knownForPhoto, [targetFacet]: copy.value };

  return {
    id: copy.id,
    title: copy.title,
    description: copy.describe(place),
    hashtags: copy.hashtags,
    facets,
    refs: NO_REFS,
    photoQuery: `${copy.title} wedding Queretaro`.slice(0, 60),
    badge: copy.badge,
    matchLabel: copy.matchLabel,
    photo: photoForFacets(facets),
  };
}

function buildStep(
  id: string,
  topic: string,
  question: string,
  helper: string,
  options: readonly ResolvedOption[],
): Omit<ResolvedStep, "index"> {
  return {
    id,
    topic,
    question,
    helper,
    selectLabel: SELECT_LABEL,
    done: false,
    options: [...options],
    source: "static",
  };
}

// --- budget ---------------------------------------------------------------

const BUDGET_COPY: Record<BudgetValue, OptionCopy<BudgetValue>> = {
  medio: {
    id: "presupuesto-medio",
    title: "Presupuesto Medio",
    badge: "Presupuesto",
    matchLabel: "95% AFINIDAD",
    hashtags: ["#PresupuestoMedio", "#BodaQueretana", "#CadaDetalleCuenta"],
    value: "medio",
    describe: (place) =>
      place
        ? `En ${place}, una celebración de presupuesto medio cuida cada detalle esencial sin excederse.`
        : "Una celebración de presupuesto medio cuida cada detalle esencial sin excederse.",
  },
  medio_alto: {
    id: "presupuesto-medio-alto",
    title: "Presupuesto Medio-Alto",
    badge: "Presupuesto",
    matchLabel: "90% AFINIDAD",
    hashtags: ["#PresupuestoAlto", "#BodaDeAutor", "#DetallesDeNivel"],
    value: "medio_alto",
    describe: (place) =>
      place
        ? `En ${place}, un presupuesto medio-alto suma banquete, decoración y fotografía de nivel.`
        : "Un presupuesto medio-alto suma banquete, decoración y fotografía de nivel.",
  },
  exclusivo: {
    id: "presupuesto-exclusivo",
    title: "Presupuesto Exclusivo",
    badge: "Presupuesto",
    matchLabel: "87% AFINIDAD",
    hashtags: ["#BodaExclusiva", "#ServicioIntegral", "#DetallesDeAutor"],
    value: "exclusivo",
    describe: (place) =>
      place
        ? `En ${place}, un presupuesto exclusivo abre paso a un servicio integral y detalles de autor.`
        : "Un presupuesto exclusivo abre paso a un servicio integral y detalles de autor.",
  },
};

function budgetStep(input: TemplateStepInput): Omit<ResolvedStep, "index"> {
  const place = placeName(input);
  const options = BUDGET_VALUES.map((value) =>
    buildOption(BUDGET_COPY[value], "budget", place, input.known),
  );

  return buildStep(
    "presupuesto-boda",
    "Presupuesto",
    "¿Qué presupuesto imaginan para su boda?",
    "Elijan el rango que mejor se ajuste a la celebración que tienen en mente.",
    options,
  );
}

// --- lodging ----------------------------------------------------------------

const LODGING_COPY: Record<LodgingValue, OptionCopy<LodgingValue>> = {
  needed: {
    id: "hospedaje-necesario",
    title: "Con Hospedaje",
    badge: "Hospedaje",
    matchLabel: "93% AFINIDAD",
    hashtags: ["#ConHospedaje", "#FinDeSemana", "#InvitadosComodos"],
    value: "needed",
    describe: (place) =>
      place
        ? `Sus invitados se hospedan cerca de ${place}, para disfrutar la celebración sin prisas.`
        : "Sus invitados se hospedan cerca del lugar elegido, para disfrutar la celebración sin prisas.",
  },
  not_needed: {
    id: "hospedaje-no-necesario",
    title: "Sin Hospedaje",
    badge: "Hospedaje",
    matchLabel: "88% AFINIDAD",
    hashtags: ["#SinHospedaje", "#MismoDia", "#CelebracionLocal"],
    value: "not_needed",
    describe: (place) =>
      place
        ? `Sus invitados regresan a casa el mismo día, sin necesidad de hospedarse cerca de ${place}.`
        : "Sus invitados regresan a casa el mismo día, sin necesidad de hospedarse cerca del lugar elegido.",
  },
};

function lodgingStep(input: TemplateStepInput): Omit<ResolvedStep, "index"> {
  const place = placeName(input);
  const options = LODGING_VALUES.map((value) =>
    buildOption(LODGING_COPY[value], "lodging", place, input.known),
  );

  return buildStep(
    "hospedaje-invitados",
    "Hospedaje",
    "¿Sus invitados necesitarán hospedaje cercano?",
    "Piensen en cuántos invitados vienen de fuera de Querétaro.",
    options,
  );
}

// --- season -----------------------------------------------------------------

/**
 * A real KB experience's name available in `season`, preferring one in the
 * known `zone` (falls through to any zone when none matches there — a
 * zone/season pairing with zero curated experiences is rare but possible).
 * `undefined` only if `season` has no matching experience at all.
 */
function seasonalExperienceName(
  season: SeasonValue,
  zone: ZoneValue | undefined,
  kb: Kb,
): string | undefined {
  const inSeason = kb.experiences.filter((experience) => experience.seasons.includes(season));
  const inZone = zone
    ? inSeason.find((experience) => experience.zoneIds.includes(zone))
    : undefined;
  return (inZone ?? inSeason[0])?.name;
}

const SEASON_COPY: Record<
  SeasonValue,
  {
    id: string;
    title: string;
    hashtags: [string, string, string];
    matchLabel: string;
    describe: (place: string | undefined, experienceName: string | undefined) => string;
  }
> = {
  primavera: {
    id: "temporada-primavera",
    title: "Primavera",
    hashtags: ["#PrimaveraQueretana", "#FloresYColor", "#BodaDePrimavera"],
    matchLabel: "96% AFINIDAD",
    describe: (place, experienceName) =>
      `${place ?? "Querétaro"} florece en primavera${experienceName ? `; ${experienceName} es un plan ideal para esos días` : ", con jardines y clima templado"}.`,
  },
  verano: {
    id: "temporada-verano",
    title: "Verano",
    hashtags: ["#VeranoQueretano", "#TardesLargas", "#BodaDeVerano"],
    matchLabel: "92% AFINIDAD",
    describe: (place, experienceName) =>
      `${place ?? "Querétaro"} regala tardes largas de verano${experienceName ? `, con ${experienceName} entre los planes favoritos` : ""}.`,
  },
  otono: {
    id: "temporada-otono",
    title: "Otoño",
    hashtags: ["#OtonoQueretano", "#VendimiaYColor", "#BodaDeOtono"],
    matchLabel: "89% AFINIDAD",
    describe: (place, experienceName) =>
      `${place ?? "Querétaro"} se viste de otoño${experienceName ? `, cuando ${experienceName} está en su mejor momento` : ""}.`,
  },
  invierno: {
    id: "temporada-invierno",
    title: "Invierno",
    hashtags: ["#InviernoQueretano", "#LucesYFuego", "#BodaDeInvierno"],
    matchLabel: "85% AFINIDAD",
    describe: (place, experienceName) =>
      `${place ?? "Querétaro"} se abriga en invierno${experienceName ? `, con ${experienceName} como broche festivo` : ", con noches frescas y mucha luz cálida"}.`,
  },
};

function seasonStep(input: TemplateStepInput): Omit<ResolvedStep, "index"> {
  const place = placeName(input);
  const zone = input.known.zone;

  const options = SEASON_VALUES.map((value) => {
    const copy = SEASON_COPY[value];
    const experienceName = seasonalExperienceName(value, zone, input.kb);
    const zoneData = zone ? input.kb.zones.find((candidate) => candidate.id === zone) : undefined;
    const badge = zoneData?.bestSeasons.includes(value) ? "Temporada ideal" : "Temporada";

    return buildOption(
      {
        id: copy.id,
        title: copy.title,
        badge,
        matchLabel: copy.matchLabel,
        hashtags: copy.hashtags,
        value,
        describe: () => copy.describe(place, experienceName),
      },
      "season",
      place,
      input.known,
    );
  });

  return buildStep(
    "temporada-boda",
    "Temporada",
    "¿Cuál es su temporada favorita para celebrar?",
    "Cada temporada en Querétaro tiene su propio carácter — elijan la que más resuene con ustedes.",
    options,
  );
}

/**
 * Builds the deterministic template step for `targetFacet` (`budget`,
 * `lodging` or `season`) — see the module doc comment for why these three
 * facets skip the LLM entirely. The caller (`engine.ts`) fills in `index`.
 */
export function templateStepFor(
  targetFacet: TemplateFacet,
  input: TemplateStepInput,
): Omit<ResolvedStep, "index"> {
  switch (targetFacet) {
    case "budget":
      return budgetStep(input);
    case "lodging":
      return lodgingStep(input);
    case "season":
      return seasonStep(input);
  }
}

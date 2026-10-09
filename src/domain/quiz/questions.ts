import type { QuizOption, QuizStep, QuizStepId } from "./types";

/**
 * Fixed per-step option ids. These are the API contract: the quiz result
 * payload, the Zod schema and the venue/photo tag maps are all derived from
 * these tuples so the literal ids only ever appear once.
 */
export const STYLE_IDS = ["colonial", "rustic_vineyard", "boho_chic", "modern_elegant"] as const;
export type StyleId = (typeof STYLE_IDS)[number];

export const SETTING_IDS = ["sunset_garden", "night_casona", "day_vineyard"] as const;
export type SettingId = (typeof SETTING_IDS)[number];

export const EXPERIENCE_IDS = [
  "intimate_boutique",
  "grand_traditional",
  "weekend_getaway",
] as const;
export type ExperienceId = (typeof EXPERIENCE_IDS)[number];

export const MUST_HAVE_IDS = [
  "wine_tasting",
  "fireworks",
  "gourmet_mexican_banquet",
  "callejoneada",
] as const;
export type MustHaveId = (typeof MUST_HAVE_IDS)[number];

const styleOptions: readonly QuizOption<StyleId>[] = [
  {
    id: "colonial",
    label: "Colonial",
    icon: "account_balance",
    title: "Colonial Imperial & Casonas",
    description:
      "Patios claustrales de cantera virreinal rosa, fuentes coloniales, candiles de cristal y callejones de leyenda en el Centro Histórico.",
    photoId: "patio-cantera-rosa",
    venueHint: "Casona de los 5 Patios",
    matchLabel: "99% AFINIDAD",
    badge: "Top Match SECTUR",
    hashtags: ["#CanteraRosa", "#SigloXVIII", "#PatrimonioUNESCO"],
    promptHint:
      "La pareja sueña con una boda colonial en patios de cantera rosa y casonas virreinales del Centro Histórico de Querétaro.",
  },
  {
    id: "rustic_vineyard",
    label: "Viñedos",
    icon: "wine_bar",
    title: "Rústico Viñedo & Enológico",
    description:
      "Atardeceres entre parras centenarias, barricas de roble americano, maridajes de quesos artesanales y brindis bajo las estrellas.",
    photoId: "entrada-vinedo-barril",
    venueHint: "Viñedos La Redonda",
    matchLabel: "94% AFINIDAD",
    badge: "Ruta del Vino",
    hashtags: ["#RutaQuesoYVino", "#CavaSubterranea", "#ValleDeColon"],
    promptHint:
      "La pareja imagina una boda rústica entre viñedos, barricas de roble y maridajes al atardecer en Ezequiel Montes.",
  },
  {
    id: "boho_chic",
    label: "Semidesierto",
    icon: "nature_people",
    title: "Boho Chic Semidesierto",
    description:
      "Ceremonias con la mística Peña de Bernal de fondo, follajes de pampa, cactus monumentales y calidez artesanal otomí.",
    photoId: "formacion-rocosa-luz-dorada",
    venueHint: "Bodegas De Cote",
    matchLabel: "91% AFINIDAD",
    badge: "Pueblo Mágico",
    hashtags: ["#PenaDeBernal", "#PuebloMagico", "#SunsetOcre"],
    promptHint:
      "La pareja busca una boda boho chic con la Peña de Bernal de fondo, textiles otomíes y un pueblo mágico semidesértico.",
  },
  {
    id: "modern_elegant",
    label: "Moderno",
    icon: "diamond",
    title: "Elegante Contemporáneo",
    description:
      "Arquitectura vanguardista integrada con naturaleza, espejos de agua, diseño lumínico escenográfico y alta coctelería de autor.",
    photoId: "pareja-muro-concreto",
    venueHint: "Hacienda Viborillas",
    matchLabel: "88% AFINIDAD",
    badge: "Tendencia 2025",
    hashtags: ["#AltaGastronomia", "#DisenoSensorial", "#Exclusividad"],
    promptHint:
      "La pareja prefiere una boda elegante y contemporánea, con diseño sensorial, alta coctelería y arquitectura vanguardista.",
  },
];

const settingOptions: readonly QuizOption<SettingId>[] = [
  {
    id: "sunset_garden",
    label: "Atardecer",
    icon: "wb_twilight",
    title: "Atardecer de Jardín",
    description:
      "Ceremonias al aire libre en los jardines de Hacienda Lagunillas, con luz dorada filtrándose entre los árboles y velas que se encienden al caer el sol.",
    photoId: "jardin-atardecer-recien-casados",
    venueHint: "Hacienda Lagunillas",
    matchLabel: "93% AFINIDAD",
    badge: "Golden Hour SECTUR",
    hashtags: ["#AtardecerQueretano", "#JardinesLagunillas", "#LuzDorada"],
    promptHint: "Quieren una ceremonia de atardecer en jardines iluminados con luz dorada.",
  },
  {
    id: "night_casona",
    label: "Noche",
    icon: "nightlight",
    title: "Noche de Casona",
    description:
      "Candiles de cera y cantera iluminan los patios de la Casona de los Cinco Patios mientras la noche envuelve el Centro Histórico en misterio y romance.",
    photoId: "candelabro-sala-oscura",
    venueHint: "Casona de los Cinco Patios",
    matchLabel: "90% AFINIDAD",
    badge: "Noche Virreinal",
    hashtags: ["#NocheDeCasona", "#CandilesDeCantera", "#CentroHistorico"],
    promptHint: "Prefieren una recepción nocturna entre candiles y patios de cantera.",
  },
  {
    id: "day_vineyard",
    label: "Día Viñedo",
    icon: "wb_sunny",
    title: "Día de Viñedo",
    description:
      "Brindis matutinos entre las vides de Viñedos La Redonda, con la Peña de Bernal asomando en el horizonte y aroma a uva recién cortada.",
    photoId: "pareja-vinedo-abrazo",
    venueHint: "Viñedos La Redonda",
    matchLabel: "87% AFINIDAD",
    badge: "Vendimia SECTUR",
    hashtags: ["#DiaDeVinedo", "#VendimiaQueretana", "#PenaDeBernal"],
    promptHint: "Imaginan una celebración diurna entre las vides de un viñedo queretano.",
  },
];

const experienceOptions: readonly QuizOption<ExperienceId>[] = [
  {
    id: "intimate_boutique",
    label: "Íntima",
    icon: "favorite",
    title: "Íntima & Boutique",
    description:
      "Una celebración íntima en la cava privada de Bodegas De Cote, con menú de autor y máximo cuarenta invitados bajo luz de velas.",
    photoId: "candelabros-blancos-florales",
    venueHint: "Bodegas De Cote",
    matchLabel: "95% AFINIDAD",
    badge: "Boutique SECTUR",
    hashtags: ["#BodaIntima", "#CavaPrivada", "#MenuDeAutor"],
    promptHint: "Buscan una experiencia íntima y boutique para pocos invitados selectos.",
  },
  {
    id: "grand_traditional",
    label: "Gran Fiesta",
    icon: "celebration",
    title: "Gran Fiesta Tradicional",
    description:
      "Grandes fiestas tradicionales en los jardines y terrazas de Hacienda Galindo, con mariachi, banquete abundante e invitados celebrando hasta el amanecer.",
    photoId: "mesa-larga-velas-flores",
    venueHint: "Hacienda Galindo",
    matchLabel: "92% AFINIDAD",
    badge: "Gran Tradición",
    hashtags: ["#GranFiesta", "#HaciendaGalindo", "#MariachiYBanquete"],
    promptHint: "Desean una gran fiesta tradicional con cientos de invitados y mariachi.",
  },
  {
    id: "weekend_getaway",
    label: "Escapada",
    icon: "luggage",
    title: "Escapada de Fin de Semana",
    description:
      "Una escapada de fin de semana por las calles empedradas de Tequisquiapan, hoteles boutique y cenas junto a la plaza del Pueblo Mágico.",
    photoId: "calle-empedrada-banderas",
    venueHint: "Tequisquiapan – Pueblo Mágico",
    matchLabel: "89% AFINIDAD",
    badge: "Pueblo Mágico",
    hashtags: ["#EscapadaDeBoda", "#Tequisquiapan", "#PuebloMagico"],
    promptHint: "Sueñan con una escapada de fin de semana para celebrar junto a sus invitados.",
  },
];

const mustHaveOptions: readonly QuizOption<MustHaveId>[] = [
  {
    id: "wine_tasting",
    label: "Cata Vinos",
    icon: "wine_bar",
    title: "Cata de Vinos",
    description:
      "Cata guiada en las cavas subterráneas de Finca Sala Vivé by Freixenet, entre burbujas de método tradicional y copas que brillan a la luz de las velas.",
    photoId: "cava-barricas-roble",
    venueHint: "Finca Sala Vivé by Freixenet",
    matchLabel: "97% AFINIDAD",
    badge: "Ruta del Vino",
    hashtags: ["#CataDeVinos", "#MetodoTradicional", "#CavaSubterranea"],
    promptHint: "No puede faltar una cata de vinos queretanos para sus invitados.",
  },
  {
    id: "fireworks",
    label: "Fuegos",
    icon: "local_fire_department",
    title: "Fuegos Artificiales",
    description:
      "Castillos de fuegos artificiales estallan sobre las terrazas de Hacienda Viborillas, iluminando la cava centenaria y el cielo de Colón en fiesta.",
    photoId: "fuegos-artificiales-multicolor",
    venueHint: "Hacienda Viborillas",
    matchLabel: "91% AFINIDAD",
    badge: "Cierre de Oro",
    hashtags: ["#FuegosArtificiales", "#NocheDeFiesta", "#HaciendaViborillas"],
    promptHint: "Quieren cerrar la noche con un castillo de fuegos artificiales.",
  },
  {
    id: "gourmet_mexican_banquet",
    label: "Banquete",
    icon: "restaurant",
    title: "Banquete Mexicano Gourmet",
    description:
      "Banquete gourmet mexicano en el restaurante Labrantío de Hacienda Lagunillas, con mixiotes, moles y vinos queretanos en cada tiempo.",
    photoId: "recepcion-nocturna-palmeras",
    venueHint: "Hacienda Lagunillas",
    matchLabel: "94% AFINIDAD",
    badge: "Alta Cocina SECTUR",
    hashtags: ["#BanqueteGourmet", "#CocinaMexicana", "#Labrantio"],
    promptHint: "Desean un banquete gourmet mexicano con sabores locales.",
  },
  {
    id: "callejoneada",
    label: "Callejoneada",
    icon: "music_note",
    title: "Callejoneada",
    description:
      "Callejoneada nocturna con estudiantina por los andadores de cantera del Centro Histórico, entre ponche, vino y faroles encendidos.",
    photoId: "callejon-balcon-amarillo",
    venueHint: "Centro Histórico de Querétaro – Callejoneada y Casonas",
    matchLabel: "86% AFINIDAD",
    badge: "Tradición Querétaro",
    hashtags: ["#Callejoneada", "#Estudiantina", "#CentroHistorico"],
    promptHint: "Sueñan con una callejoneada nocturna al estilo tradicional mexicano.",
  },
];

export const QUIZ_STEPS: readonly QuizStep[] = [
  {
    id: "style",
    order: 1,
    topic: "Estilo",
    question: "¿Qué vibra define su historia?",
    helper:
      "Desliza las postales o toca tu favorita para personalizar su boda soñada en Querétaro.",
    selectLabel: "Elegir este Estilo",
    options: styleOptions,
  },
  {
    id: "setting",
    order: 2,
    topic: "Horario y Entorno",
    question: "¿En qué momento del día cobra vida su celebración?",
    helper: "Elige la luz y el entorno que mejor acompañan la historia de su boda en Querétaro.",
    selectLabel: "Elegir este Entorno",
    options: settingOptions,
  },
  {
    id: "experience",
    order: 3,
    topic: "Experiencia",
    question: "¿Qué tipo de experiencia quieren vivir con sus invitados?",
    helper: "Define el tamaño y el ritmo de la celebración que imaginan junto a sus invitados.",
    selectLabel: "Elegir esta Experiencia",
    options: experienceOptions,
  },
  {
    id: "mustHave",
    order: 4,
    topic: "Elemento Infaltable",
    question: "¿Qué momento no puede faltar en su boda?",
    helper: "Elige el detalle que hará inolvidable su celebración en Querétaro.",
    selectLabel: "Elegir este Elemento",
    options: mustHaveOptions,
  },
];

export function getStep(id: QuizStepId): QuizStep {
  const step = QUIZ_STEPS.find((candidate) => candidate.id === id);

  if (!step) {
    throw new Error(`Unknown quiz step id: ${id}`);
  }

  return step;
}

export function getOption(stepId: QuizStepId, optionId: string): QuizOption {
  const step = getStep(stepId);
  const option = step.options.find((candidate) => candidate.id === optionId);

  if (!option) {
    throw new Error(`Unknown option "${optionId}" for step "${stepId}"`);
  }

  return option;
}

export function nextStep(id: QuizStepId): QuizStep | undefined {
  const step = getStep(id);
  return QUIZ_STEPS.find((candidate) => candidate.order === step.order + 1);
}

export function continueLabel(step: QuizStep): string {
  const upcoming = nextStep(step.id);

  if (!upcoming) {
    return "Crear mi experiencia";
  }

  return `Continuar al Paso ${upcoming.order}: ${upcoming.topic}`;
}

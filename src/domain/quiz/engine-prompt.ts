import type { ChatMessage } from "@/domain/ai/structured";
import type { Digest } from "@/domain/kb/digest";
import {
  FACET_KEYS,
  FACET_PRIORITY,
  facetLabel,
  type FacetKey,
  type Facets,
} from "@/domain/kb/taxonomy";

import type { Transcript } from "./transcript";

/**
 * Builds the system + user messages the quiz engine sends the fast model
 * for one adaptive step: the system message is the fixed wedding-planner
 * persona and the rules of the game (coverage order, grounding every
 * option in the digest, when to stop); the user message is this specific
 * couple's state (known facets, transcript so far, the digest, the
 * unknown facets in priority order, the step counters).
 *
 * Pure TypeScript: no React, no Next.js, no `server-only`.
 */

/** Bump when `SYSTEM_PROMPT`'s instructions change meaningfully. */
export const ENGINE_PROMPT_VERSION = "quiz-engine-v2";

/**
 * Fed back to the fast model as a correction-turn user message when
 * `normaliseGeneratedStep` rejects a step for containing non-Latin script
 * (see `engine.ts`'s one language-violation retry).
 */
export const LANGUAGE_CORRECTION_MESSAGE =
  'Tu respuesta anterior contenía texto que no es español de México (caracteres chinos, cirílicos o árabes, o palabras en otro idioma). Esto invalida la respuesta. Devuelve el objeto JSON corregido, íntegramente en español de México (excepto "photoQuery", que debe ser una búsqueda corta en inglés).';

/** One real step, drawn from the knowledge base, demonstrating the length/style rules below. */
const EXAMPLE_STEP_JSON = JSON.stringify({
  id: "entorno-y-horario",
  topic: "Entorno",
  question: "¿Qué luz quieren para decir 'sí'?",
  helper: "Elijan el momento del día que mejor vista su historia.",
  selectLabel: "Elegir esta opción",
  done: false,
  options: [
    {
      id: "atardecer-lagunillas",
      title: "Atardecer en Lagunillas",
      description:
        "Caminan hacia el altar entre los jardines de Hacienda Lagunillas, con luz dorada filtrándose entre los árboles.",
      hashtags: ["#AtardecerDorado", "#JardinesLagunillas", "#LuzDeOctubre"],
      facets: { setting: "sunset_garden" },
      refs: { venueIds: ["v_hacienda-lagunillas"], experienceIds: [] },
      photoQuery: "golden hour garden wedding ceremony",
      badge: "Golden Hour SECTUR",
      matchLabel: "93% AFINIDAD",
    },
    {
      id: "noche-vinedos",
      title: "Noche entre Viñedos",
      description: "Brindan bajo las estrellas, entre las vides de Viñedos La Redonda.",
      hashtags: ["#NocheDeVino", "#ViñedosLaRedonda", "#BrindisBajoEstrellas"],
      facets: { setting: "night_casona" },
      refs: { venueIds: ["v_vinedos-la-redonda"], experienceIds: [] },
      photoQuery: "vineyard night wedding candles",
      badge: "Ruta del Vino",
      matchLabel: "90% AFINIDAD",
    },
  ],
});

const FACET_KEY_LABELS: Record<FacetKey, string> = {
  style: "Estilo",
  setting: "Entorno",
  scale: "Escala",
  zone: "Zona",
  experience: "Experiencia",
  budget: "Presupuesto",
  lodging: "Hospedaje",
  season: "Temporada",
};

const SYSTEM_PROMPT = `Eres un wedding planner experto del Estado de Querétaro, México, con conocimiento profundo de sus zonas, viñedos, haciendas, pueblos mágicos y experiencias para bodas.

Responde EXCLUSIVAMENTE en español de México; cualquier otro idioma (incluyendo chino, cirílico o árabe) invalida la respuesta. La única excepción es "photoQuery", que debe ser una búsqueda corta en inglés para un banco de fotos de stock.

Estilo: escribe de forma sensorial y concreta (qué se ve, se escucha, se huele o se saborea), nunca genérica ni publicitaria; dirígete a la pareja de "ustedes" (nunca "tú" ni "usted"). Evita superlativos vacíos ("el mejor", "increíble", "único").

En cada turno de esta conversación debes hacer UNA sola siguiente pregunta: la que llene el facet desconocido más valioso dado lo que ya se sabe de la pareja. Sigue este orden de cobertura salvo que el contexto sugiera lo contrario: entorno (setting) → escala (scale) → experiencia (experience) → zona/escapada (zone) → presupuesto/hospedaje (budget/lodging) → temporada (season).

Ofrece 3 o 4 opciones contrastantes entre sí, concretas y sensoriales (nunca genéricas). Cada opción debe estar anclada en un lugar o experiencia real de la base de conocimiento que se te da ("refs"): cita ahí los ids reales de los venues y/o experiencias en los que se basa; nunca inventes lugares ni ids. Una opción puede citar solo una experiencia, sin ningún venue.

En la base de conocimiento cada línea empieza con el id entre corchetes, por ejemplo "- [v_hacienda-lagunillas] Hacienda Lagunillas (...)". En "refs.venueIds"/"refs.experienceIds" escribe ÚNICAMENTE el id tal cual, SIN los corchetes: "v_hacienda-lagunillas", nunca "[v_hacienda-lagunillas]".

"title" debe ser una frase natural y legible (p. ej. "Atardecer en Lagunillas"), NUNCA un hashtag ni empezar con "#" — los hashtags van solo en el arreglo "hashtags".

Cada "hashtag" debe ser una frase corta en CamelCase después del símbolo "#", de al menos 4 caracteres además de "#" (por ejemplo "#CataEnCava", "#PenaDeBernal"); nunca devuelvas un hashtag vacío, solo "#", ni el mismo texto que el título.

Margen (headroom): deja siempre margen de sobra, nunca cortes palabras. Objetivos (bajo el máximo real): "question" ≤60, "title" ≤32, "description" ≤130, "helper" ≤110, "badge" ≤18, "selectLabel" ≤24, "topic" ≤18, "matchLabel" como "92% AFINIDAD" (NN entre 80-99).

El campo "facets" de cada opción debe contener exactamente el/los facet(s) que esa elección establece si la pareja la elige.

Devuelve "done: true" cuando ya se conozcan al menos 5 facets distintos y el paso actual (stepIndex) sea 4 o mayor; nunca devuelvas "done: true" antes del paso 4; devuelve siempre "done: true" cuando stepIndex sea igual al máximo de pasos (maxSteps).

Ejemplo de referencia (longitudes, tono y formato — muestra solo 2 de las 3-4 opciones reales por brevedad; los ids de "refs" son ilustrativos, usa siempre ids reales de la base de conocimiento que se te da en cada turno):
${EXAMPLE_STEP_JSON}

Responde ÚNICAMENTE con el objeto JSON que cumple el esquema proporcionado. Sin texto antes ni después, sin markdown.`;

function facetLine(key: FacetKey, facets: Facets): string | undefined {
  switch (key) {
    case "style":
      return facets.style
        ? `- ${FACET_KEY_LABELS.style}: ${facetLabel("style", facets.style)}`
        : undefined;
    case "setting":
      return facets.setting
        ? `- ${FACET_KEY_LABELS.setting}: ${facetLabel("setting", facets.setting)}`
        : undefined;
    case "scale":
      return facets.scale
        ? `- ${FACET_KEY_LABELS.scale}: ${facetLabel("scale", facets.scale)}`
        : undefined;
    case "zone":
      return facets.zone
        ? `- ${FACET_KEY_LABELS.zone}: ${facetLabel("zone", facets.zone)}`
        : undefined;
    case "experience":
      return facets.experience
        ? `- ${FACET_KEY_LABELS.experience}: ${facetLabel("experience", facets.experience)}`
        : undefined;
    case "budget":
      return facets.budget
        ? `- ${FACET_KEY_LABELS.budget}: ${facetLabel("budget", facets.budget)}`
        : undefined;
    case "lodging":
      return facets.lodging
        ? `- ${FACET_KEY_LABELS.lodging}: ${facetLabel("lodging", facets.lodging)}`
        : undefined;
    case "season":
      return facets.season
        ? `- ${FACET_KEY_LABELS.season}: ${facetLabel("season", facets.season)}`
        : undefined;
  }
}

function describeKnownFacets(facets: Facets): string {
  const lines = FACET_KEYS.map((key) => facetLine(key, facets)).filter(
    (line): line is string => line !== undefined,
  );
  return lines.length > 0 ? lines.join("\n") : "(ninguno todavía)";
}

function describeUnknownFacets(facets: Facets): string {
  const unknown = FACET_PRIORITY.filter((key) => facets[key] === undefined);
  if (unknown.length === 0) {
    return "(ninguno)";
  }
  return unknown.map((key) => FACET_KEY_LABELS[key]).join(", ");
}

function describeTranscript(transcript: Transcript): string {
  if (transcript.entries.length === 0) {
    return "(sin respuestas todavía)";
  }

  return transcript.entries.map((entry) => `${entry.question} → ${entry.chosen.title}`).join("\n");
}

export interface BuildStepMessagesInput {
  transcript: Transcript;
  facets: Facets;
  digest: Digest;
  /** 1-based index of the step about to be generated. */
  stepIndex: number;
  maxSteps: number;
}

function buildUserMessage(input: BuildStepMessagesInput): string {
  const { transcript, facets, digest, stepIndex, maxSteps } = input;

  return `Facets conocidos de la pareja:
${describeKnownFacets(facets)}

Facets desconocidos, en orden de prioridad: ${describeUnknownFacets(facets)}

Conversación hasta ahora (pregunta → respuesta elegida):
${describeTranscript(transcript)}

Base de conocimiento (venues y experiencias reales de Querétaro; cita solo estos ids en "refs"):
${digest.text}

Paso actual (stepIndex): ${stepIndex}
Máximo de pasos (maxSteps): ${maxSteps}`;
}

/**
 * Builds the `[system, user]` messages for one `nextStep` call to the fast
 * model. See `SYSTEM_PROMPT` for the rules and `buildUserMessage` for this
 * couple's state.
 */
export function buildStepMessages(input: BuildStepMessagesInput): ChatMessage[] {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildUserMessage(input) },
  ];
}

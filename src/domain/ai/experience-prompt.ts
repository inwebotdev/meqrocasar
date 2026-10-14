import type { Digest } from "@/domain/kb/digest";
import { buildDigest } from "@/domain/kb/digest";
import { loadKb } from "@/domain/kb/load";
import { FACET_KEYS, facetLabel, type FacetKey, type Facets } from "@/domain/kb/taxonomy";
import type { Kb } from "@/domain/kb/types";
import {
  chosenRefs,
  foldFacets,
  transcriptFromLegacyAnswers,
  type Transcript,
} from "@/domain/quiz/transcript";
import type { QuizAnswers } from "@/domain/quiz/schema";

import type { ChatMessage } from "./structured";

/**
 * Builds the system + user messages sent to OpenRouter to generate the
 * final wedding experience from the couple's full adaptive-quiz
 * transcript and the knowledge-base digest for their known facets. This
 * replaces the old enum-only prompt (`./prompt.ts`, still kept for its
 * own tests) with one grounded in the real conversation and real venues.
 *
 * Pure TypeScript: no React, no Next.js, no `server-only`.
 */

/** Bump whenever `SYSTEM_PROMPT` changes in a way that could affect the shape or tone of the LLM's response. */
export const EXPERIENCE_PROMPT_VERSION = "experience-prompt-v1";

/** Sized so the final generation's prompt stays within the primary model's comfortable context budget. */
export const EXPERIENCE_DIGEST_OPTIONS = { maxVenues: 20, maxExperiences: 10, maxChars: 5000 };

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

/**
 * Renders the transcript as a dialogue: one "Pregunta → Eligieron: título
 * (resumen)" line per entry, in order.
 */
function describeTranscript(transcript: Transcript): string {
  if (transcript.entries.length === 0) {
    return "(sin respuestas todavía)";
  }

  return transcript.entries
    .map(
      (entry) => `${entry.question} → Eligieron: ${entry.chosen.title} (${entry.chosen.summary})`,
    )
    .join("\n");
}

const EXAMPLE_RESPONSE_JSON = JSON.stringify({
  conceptTitle: "Vendimia Dorada entre Viñedos de Ezequiel Montes",
  colorPalette: [
    { hex: "#5B1A2B", name: "Vino de Barrica" },
    { hex: "#C9A227", name: "Oro Vendimia" },
    { hex: "#D9C7A3", name: "Beige Barrica" },
    { hex: "#4B5E3A", name: "Verde Viñedo" },
  ],
  narrative:
    "Primer párrafo sensorial que retoma lo que la pareja eligió y nombra 1-2 recintos de forma orgánica dentro del relato.\n\nSegundo párrafo que cierra la historia, menciona otro recinto o experiencia y conecta con la escala y el presupuesto elegidos.",
  searchQueries: [
    "vineyard wedding golden hour",
    "wine cellar reception",
    "rustic garden ceremony",
  ],
  recommendedVenues: [
    {
      venueId: "v_vinedos-la-redonda",
      reason: "Por qué este recinto conecta con lo que eligieron.",
    },
  ],
  reelTagline: "Vendimia Dorada en Ezequiel Montes",
  itineraryHint:
    "Viernes: cata en La Redonda · Sábado: ceremonia en Lagunillas · Domingo: globo en Tequisquiapan",
  reelScript:
    "Imaginen su Vendimia Dorada entre las hileras de Viñedos La Redonda, con la Peña de Bernal asomando al fondo. Ahí, entre copas de vino y luz de atardecer, su historia cobra vida.",
});

const SYSTEM_PROMPT = `Eres un wedding planner experto del Estado de Querétaro, México, con conocimiento profundo de sus zonas, viñedos, haciendas, pueblos mágicos y experiencias para bodas.

Responde EXCLUSIVAMENTE en español de México; cualquier otro idioma (incluyendo chino, cirílico o árabe) invalida la respuesta. La única excepción es "searchQueries", que deben ser búsquedas cortas en inglés para un banco de fotos de stock.

Estilo: escribe de forma sensorial y concreta (qué se ve, se escucha, se huele o se saborea), nunca genérica ni publicitaria (nada de "reserva ahora", "el mejor lugar", precios ni llamados a la acción). Dirígete a la pareja de "ustedes" (nunca "tú" ni "usted").

Se te da la conversación completa del cuestionario adaptativo (pregunta → lo que eligieron), los facets que esa conversación reveló, y una base de conocimiento con los venues y experiencias reales de Querétaro más relevantes para esos facets. Usa la conversación y los facets para que el relato se sienta hecho a medida de esta pareja, no genérico.

Los "Facets conocidos de la pareja" son hechos fijos: nunca los contradigas. Cuando la pareja ya conoce una zona (ver el facet "Zona"), el concepto, "narrative", "itineraryHint" y "reelScript" deben permanecer dentro de esa zona — solo puedes mencionar un lugar de otra zona si el itinerario lo propone explícitamente como una escapada de un día ("day trip") y lo dices así con esas palabras.

Si se te da una lista de "Lugares que la pareja YA eligió durante el cuestionario", esos lugares son obligatorios: cada uno debe aparecer en "recommendedVenues", en ese mismo orden, antes de cualquier otro lugar que tú añadas (nunca inventes un motivo para omitirlos).

Devuelve ÚNICAMENTE un objeto JSON estricto, sin bloques de código markdown, sin comentarios y sin texto antes o después. El JSON debe tener EXACTAMENTE estas claves: "conceptTitle", "colorPalette" (4 colores), "narrative", "searchQueries" (3), "recommendedVenues" (1 a 3), "reelTagline", "itineraryHint", "reelScript".

- "conceptTitle": título poético corto para la boda (4-80 caracteres).
- "colorPalette": exactamente 4 objetos { "hex": "#RRGGBB", "name": "nombre corto en español" }.
- "narrative": EXACTAMENTE 2 párrafos separados por una línea en blanco, orgánicos y sensoriales, que retomen lo que la pareja eligió y mencionen 2-3 recintos o experiencias por nombre de forma natural dentro del relato (no una lista).
- "searchQueries": exactamente 3 búsquedas cortas en inglés para fotos de stock.
- "recommendedVenues": de 1 a 3 objetos { "venueId": "...", "reason": "..." }. "venueId" debe ser EXACTAMENTE uno de los ids entre corchetes de la base de conocimiento (por ejemplo, si la línea dice "- [v_vinedos-la-redonda] ...", usa "v_vinedos-la-redonda", sin corchetes); nunca inventes ids. "reason" (20-300 caracteres) explica por qué ese recinto conecta con lo que la pareja eligió.
- "reelTagline": frase corta para un reel de video (máximo 60 caracteres).
- "itineraryHint": un posible itinerario de fin de semana en una sola línea (máximo 160 caracteres), con el formato "Viernes: ... · Sábado: ... · Domingo: ...", basado en los recintos/experiencias reales de la base de conocimiento.
- "reelScript": guion de narración en voz, de 2 a 3 oraciones (máximo 260 caracteres, nunca más de 320), para que una voz en off lo lea sobre el video del reel. Dirígete a la pareja de "ustedes", nombra el concepto de la boda y el recinto principal, con un tono cálido y concreto (no genérico ni publicitario). Nunca una lista ni viñetas: prosa corrida, lista para leerse en voz alta.

Margen (headroom): deja siempre margen de sobra respecto a los máximos anteriores (para "reelScript" apunta a 260 caracteres o menos) y nunca cortes palabras a la mitad.

Ejemplo de referencia (longitudes, tono y formato — el id de "recommendedVenues" es ilustrativo, usa siempre ids reales de la base de conocimiento que se te da en cada turno):
${EXAMPLE_RESPONSE_JSON}

Responde ÚNICAMENTE con el objeto JSON que cumple el esquema proporcionado. Sin texto antes ni después, sin markdown.`;

export interface BuildExperienceMessagesInput {
  transcript: Transcript;
  facets: Facets;
  digest: Digest;
  /** Defaults to `loadKb()` — only used to resolve the chosen venues' names for the prompt. */
  kb?: Kb;
}

/** Renders the venues the couple already chose during the quiz (from `chosenRefs`) as a "must appear first" list for the model. */
function describeChosenVenues(chosenVenueIds: readonly string[], kb: Kb): string {
  if (chosenVenueIds.length === 0) {
    return "(ninguno — recomienda los más relevantes de la base de conocimiento)";
  }

  const names = chosenVenueIds
    .map((id) => kb.venues.find((venue) => venue.id === id)?.name)
    .filter((name): name is string => name !== undefined);

  return names.length > 0 ? names.map((name) => `- ${name}`).join("\n") : "(ninguno)";
}

function buildUserMessage(input: BuildExperienceMessagesInput): string {
  const { transcript, facets, digest, kb = loadKb() } = input;
  const { venueIds: chosenVenueIds } = chosenRefs(transcript.entries);

  return `Facets conocidos de la pareja (hechos fijos, no los contradigas):
${describeKnownFacets(facets)}

Lugares que la pareja YA eligió durante el cuestionario (deben aparecer primero en "recommendedVenues", en este mismo orden):
${describeChosenVenues(chosenVenueIds, kb)}

Conversación completa del cuestionario (pregunta → lo que eligieron):
${describeTranscript(transcript)}

Base de conocimiento (venues y experiencias reales de Querétaro; cita solo estos ids en "recommendedVenues"):
${digest.text}

Devuelve únicamente el objeto JSON solicitado, sin texto adicional.`;
}

/**
 * Builds the `[system, user]` messages for the final-generation call to
 * the primary model, from the couple's full transcript, folded facets and
 * the knowledge-base digest for those facets.
 */
export function buildExperienceMessages(input: BuildExperienceMessagesInput): ChatMessage[] {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildUserMessage(input) },
  ];
}

/**
 * Legacy entry point: converts the old 4-answer quiz shape into a
 * transcript (`transcriptFromLegacyAnswers`), folds its facets, builds the
 * digest for those facets, and delegates to `buildExperienceMessages` — so
 * the old `{ style, setting, experience, mustHave }` body produces exactly
 * the same kind of prompt as a real adaptive transcript would.
 */
export function buildMessages(answers: QuizAnswers): ChatMessage[] {
  const transcript = transcriptFromLegacyAnswers(answers);
  const facets = foldFacets(transcript.entries);
  const { venueIds: chosenVenueIds } = chosenRefs(transcript.entries);
  const digest = buildDigest(facets, {
    ...EXPERIENCE_DIGEST_OPTIONS,
    zone: facets.zone,
    style: facets.style,
    chosenVenueIds,
  });

  return buildExperienceMessages({ transcript, facets, digest });
}

import type { Digest } from "@/domain/kb/digest";
import { buildDigest } from "@/domain/kb/digest";
import { FACET_KEYS, facetLabel, type FacetKey, type Facets } from "@/domain/kb/taxonomy";
import { foldFacets, transcriptFromLegacyAnswers, type Transcript } from "@/domain/quiz/transcript";
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
});

const SYSTEM_PROMPT = `Eres un wedding planner experto del Estado de Querétaro, México, con conocimiento profundo de sus zonas, viñedos, haciendas, pueblos mágicos y experiencias para bodas.

Responde EXCLUSIVAMENTE en español de México; cualquier otro idioma (incluyendo chino, cirílico o árabe) invalida la respuesta. La única excepción es "searchQueries", que deben ser búsquedas cortas en inglés para un banco de fotos de stock.

Estilo: escribe de forma sensorial y concreta (qué se ve, se escucha, se huele o se saborea), nunca genérica ni publicitaria (nada de "reserva ahora", "el mejor lugar", precios ni llamados a la acción). Dirígete a la pareja de "ustedes" (nunca "tú" ni "usted").

Se te da la conversación completa del cuestionario adaptativo (pregunta → lo que eligieron), los facets que esa conversación reveló, y una base de conocimiento con los venues y experiencias reales de Querétaro más relevantes para esos facets. Usa la conversación y los facets para que el relato se sienta hecho a medida de esta pareja, no genérico.

Devuelve ÚNICAMENTE un objeto JSON estricto, sin bloques de código markdown, sin comentarios y sin texto antes o después. El JSON debe tener EXACTAMENTE estas claves: "conceptTitle", "colorPalette" (4 colores), "narrative", "searchQueries" (3), "recommendedVenues" (1 a 3), "reelTagline", "itineraryHint".

- "conceptTitle": título poético corto para la boda (4-80 caracteres).
- "colorPalette": exactamente 4 objetos { "hex": "#RRGGBB", "name": "nombre corto en español" }.
- "narrative": EXACTAMENTE 2 párrafos separados por una línea en blanco, orgánicos y sensoriales, que retomen lo que la pareja eligió y mencionen 2-3 recintos o experiencias por nombre de forma natural dentro del relato (no una lista).
- "searchQueries": exactamente 3 búsquedas cortas en inglés para fotos de stock.
- "recommendedVenues": de 1 a 3 objetos { "venueId": "...", "reason": "..." }. "venueId" debe ser EXACTAMENTE uno de los ids entre corchetes de la base de conocimiento (por ejemplo, si la línea dice "- [v_vinedos-la-redonda] ...", usa "v_vinedos-la-redonda", sin corchetes); nunca inventes ids. "reason" (20-300 caracteres) explica por qué ese recinto conecta con lo que la pareja eligió.
- "reelTagline": frase corta para un reel de video (máximo 60 caracteres).
- "itineraryHint": un posible itinerario de fin de semana en una sola línea (máximo 160 caracteres), con el formato "Viernes: ... · Sábado: ... · Domingo: ...", basado en los recintos/experiencias reales de la base de conocimiento.

Margen (headroom): deja siempre margen de sobra respecto a los máximos anteriores y nunca cortes palabras a la mitad.

Ejemplo de referencia (longitudes, tono y formato — el id de "recommendedVenues" es ilustrativo, usa siempre ids reales de la base de conocimiento que se te da en cada turno):
${EXAMPLE_RESPONSE_JSON}

Responde ÚNICAMENTE con el objeto JSON que cumple el esquema proporcionado. Sin texto antes ni después, sin markdown.`;

export interface BuildExperienceMessagesInput {
  transcript: Transcript;
  facets: Facets;
  digest: Digest;
}

function buildUserMessage(input: BuildExperienceMessagesInput): string {
  const { transcript, facets, digest } = input;

  return `Facets conocidos de la pareja:
${describeKnownFacets(facets)}

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
  const digest = buildDigest(facets, EXPERIENCE_DIGEST_OPTIONS);

  return buildExperienceMessages({ transcript, facets, digest });
}

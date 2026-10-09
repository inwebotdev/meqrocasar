import { describeAnswers, type QuizAnswers } from "@/domain/quiz/schema";
import { VENUES } from "@/domain/venues/catalog";

/**
 * A single OpenRouter chat message. Mirrors the subset of the OpenRouter
 * chat-completions request shape this app needs.
 */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Bump this whenever `SYSTEM_PROMPT` changes in a way that could affect the
 * shape or tone of the LLM's response, so `meta.promptVersion` lets us tell
 * generated experiences apart across prompt revisions.
 */
export const SYSTEM_PROMPT_VERSION = "2026-10-09.1";

function formatCatalog(): string {
  return VENUES.map(
    (venue) => `- ${venue.name} (${venue.zone}) — tags: ${venue.tags.join(", ")}`,
  ).join("\n");
}

const SYSTEM_PROMPT = `Eres un experto en Turismo de Romance del Estado de Querétaro, México.

Analiza las preferencias de la pareja y devuelve ÚNICAMENTE un objeto JSON estricto, sin bloques de código markdown (sin \`\`\`), sin comentarios y sin texto antes o después. El JSON debe tener EXACTAMENTE estas claves:

{
  "conceptTitle": "Título poético corto para la boda (4-80 caracteres)",
  "colorPalette": [
    { "hex": "#HEX1", "name": "Nombre corto en español" },
    { "hex": "#HEX2", "name": "Nombre corto en español" },
    { "hex": "#HEX3", "name": "Nombre corto en español" },
    { "hex": "#HEX4", "name": "Nombre corto en español" }
  ],
  "narrative": "Descripción en español latinoamericano, en EXACTAMENTE 2 párrafos separados por una línea en blanco, de cómo sería su boda ideal en Querétaro. Debe ser orgánica y sensorial (luz, aromas, texturas, sonidos), mencionando los recintos recomendados de forma natural dentro del relato, SIN lenguaje publicitario (nada de 'reserva ahora', 'el mejor lugar', precios ni llamados a la acción).",
  "searchQueries": ["query corta en inglés 1", "query corta en inglés 2", "query corta en inglés 3"],
  "recommendedVenues": [
    {
      "name": "Nombre real de un recinto, EXACTAMENTE como aparece en el catálogo de abajo",
      "zone": "Zona del recinto (igual que en el catálogo)",
      "reason": "Por qué conecta con el estilo de la pareja (20-300 caracteres)"
    }
  ],
  "reelTagline": "Frase corta para un reel de video, máximo 60 caracteres"
}

Reglas estrictas:
- "colorPalette" debe tener exactamente 4 colores con código hexadecimal válido (#RRGGBB) y un nombre corto en español.
- "narrative" debe tener exactamente 2 párrafos en español latinoamericano, separados por una línea en blanco, con un tono orgánico y sensorial, nunca publicitario.
- "searchQueries" debe tener exactamente 3 queries cortas en inglés, pensadas para buscar fotos de stock (Unsplash).
- "recommendedVenues" debe tener entre 1 y 3 recintos, y cada "name" y "zone" DEBEN pertenecer EXACTAMENTE al catálogo de recintos verificados de Querétaro que se incluye abajo. No inventes recintos ni zonas fuera de este catálogo.
- "reelTagline" debe tener 60 caracteres o menos.

Catálogo de recintos verificados de Querétaro (elige únicamente de esta lista):
${formatCatalog()}

Las respuestas de la pareja se recibirán como un bloque de texto con sus respuestas del cuestionario.`;

/**
 * Builds the system + user chat messages sent to OpenRouter to generate a
 * wedding experience from the couple's quiz answers.
 */
export function buildMessages(answers: QuizAnswers): ChatMessage[] {
  const userMessage = [
    "Respuestas de la pareja:",
    describeAnswers(answers),
    "",
    "Devuelve únicamente el objeto JSON solicitado, sin texto adicional.",
  ].join("\n");

  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userMessage },
  ];
}

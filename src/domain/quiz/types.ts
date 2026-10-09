import type { PhotoId } from "@/domain/media/photos";

export type QuizStepId = "style" | "setting" | "experience" | "mustHave";

export interface QuizOption<Id extends string = string> {
  /** Fixed API contract id, e.g. "colonial". */
  id: Id;
  /** Quick-strip label, <= 12 chars. */
  label: string;
  /** Material Symbol ligature name. */
  icon: string;
  title: string;
  /** es-MX sensory copy, <= 160 chars. */
  description: string;
  photoId: PhotoId;
  /** Real catalog venue name or alias, no "Recomendado:" prefix. */
  venueHint: string;
  /** e.g. "99% AFINIDAD". */
  matchLabel: string;
  /** e.g. "Top Match SECTUR". */
  badge: string;
  hashtags: [string, string, string];
  /** One Spanish sentence describing this choice, for the LLM prompt. */
  promptHint: string;
}

export interface QuizStep {
  id: QuizStepId;
  order: 1 | 2 | 3 | 4;
  /** "Estilo", "Horario y Entorno", "Experiencia", "Elemento Infaltable". */
  topic: string;
  question: string;
  helper: string;
  /** e.g. "Elegir este Estilo". */
  selectLabel: string;
  options: readonly QuizOption[];
}

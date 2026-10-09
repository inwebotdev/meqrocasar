import type { QuizAnswers } from "@/domain/quiz/schema";
import type { Venue } from "@/domain/venues/types";

export interface PaletteColor {
  hex: string;
  name: string;
}

export interface ExperienceVenue extends Venue {
  reason: string;
  role: "principal" | "destacada";
}

export interface ExperiencePhoto {
  url: string;
  alt: string;
  credit: string;
}

/** One call to one LLM model while generating an experience (see `createOpenRouterClient`). */
export interface ExperienceAttempt {
  model: string;
  outcome: "ok" | "http-error" | "timeout" | "network" | "no-json" | "invalid-json" | "schema";
  durationMs: number;
}

export interface ExperienceUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface ExperienceMeta {
  model: string;
  fallbackUsed: boolean;
  durationMs: number;
  generatedAt: string;
  /** `SYSTEM_PROMPT_VERSION` at the time this experience was generated. */
  promptVersion?: string;
  /** Every LLM call attempted while generating this experience, in order. */
  attempts?: ExperienceAttempt[];
  usage?: ExperienceUsage;
}

/** What the API returns to the UI, ready to render and persist. */
export interface ExperienceResult {
  conceptTitle: string;
  /** Always exactly 4 colors. */
  palette: PaletteColor[];
  narrative: string;
  reelTagline: string;
  searchQueries: string[];
  venues: ExperienceVenue[];
  /** Always exactly 3 photos. */
  photos: ExperiencePhoto[];
  answers: QuizAnswers;
  meta: ExperienceMeta;
}

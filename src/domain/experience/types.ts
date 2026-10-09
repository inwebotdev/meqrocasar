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

export interface ExperienceMeta {
  model: string;
  fallbackUsed: boolean;
  durationMs: number;
  generatedAt: string;
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

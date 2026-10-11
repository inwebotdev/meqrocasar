import type { Facets } from "@/domain/kb/taxonomy";
import type { Transcript } from "@/domain/quiz/transcript";
import type { QuizAnswers } from "@/domain/quiz/schema";
import type { Venue } from "@/domain/venues/types";

export interface PaletteColor {
  hex: string;
  name: string;
}

/**
 * A venue recommended as part of a generated experience. Structurally
 * compatible with `Venue` (so the legacy fallback path's venues, which
 * are real catalog `Venue`s, satisfy this unchanged) but doesn't `extend`
 * it: `zone` widens to a plain es-MX display string and `tags`/`photoId`
 * become non-authoritative, because a KB-sourced venue
 * (`assembleVenuesFromKb`) spans the wider `kb/taxonomy` zone vocabulary
 * and has no legacy photo-registry id of its own.
 */
export interface ExperienceVenue extends Omit<Venue, "zone" | "photoId"> {
  zone: string;
  /** Omitted for a KB-sourced venue — those render from `photoUrl` instead. */
  photoId?: Venue["photoId"];
  reason: string;
  role: "principal" | "destacada";
  /** Google rating (0-5), when the venue has real Places data. */
  rating?: number;
  userRatingCount?: number;
  address?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  /** Proxied Places photo path, or a registry/Unsplash URL. */
  photoUrl?: string;
  photoAttribution?: string;
  oneLiner?: string;
  whyWeddings?: string;
}

export interface ExperiencePhoto {
  url: string;
  alt: string;
  credit: string;
}

/** One call to one LLM model while generating an experience (see `createStructuredClient`). */
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
  /** `EXPERIENCE_PROMPT_VERSION` at the time this experience was generated. */
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
  /** Omitted when generated from a transcript rather than the legacy 4-answer shape. */
  answers?: QuizAnswers;
  /** Present when generated from (or converted to) a transcript. */
  transcript?: Transcript;
  /** The folded facets the transcript/answers resolved to. */
  facets?: Facets;
  /** A short weekend-itinerary hint, e.g. "Viernes: ... · Sábado: ... · Domingo: ...". */
  itineraryHint?: string;
  meta: ExperienceMeta;
}

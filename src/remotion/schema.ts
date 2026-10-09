import { z } from "zod";

import type { ExperienceResult } from "@/domain/experience/types";

export const ReelPropsSchema = z.object({
  title: z.string().min(1).max(80),
  tagline: z.string().max(60),
  narrativeLines: z.array(z.string().min(1).max(90)).min(2).max(4),
  photos: z
    .array(
      z.object({
        url: z.string().url(),
        alt: z.string(),
      }),
    )
    .length(3),
  palette: z
    .array(
      z.object({
        hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
        name: z.string(),
      }),
    )
    .length(4),
  trackName: z.string().max(60),
  audioSrc: z.string().optional(),
});

export type ReelProps = z.infer<typeof ReelPropsSchema>;

const MAX_LINE_LENGTH = 90;
const MAX_NARRATIVE_LINES = 3;
const DEFAULT_TRACK_NAME = "Vals Huapango Queretano";

function cutAtLength(line: string, maxLength: number): string {
  const trimmed = line.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

/**
 * Splits a narrative into sentences, keeps the first `MAX_NARRATIVE_LINES`,
 * and cuts each one at `MAX_LINE_LENGTH` chars with an ellipsis.
 */
function narrativeToLines(narrative: string): string[] {
  const sentences = narrative
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  return sentences
    .slice(0, MAX_NARRATIVE_LINES)
    .map((sentence) => cutAtLength(sentence, MAX_LINE_LENGTH));
}

export interface ReelPropsFromExperienceOptions {
  audioSrc?: string;
  trackName?: string;
}

/** Builds the `ReelProps` for a wedding reel from a generated `ExperienceResult`. */
export function reelPropsFromExperience(
  result: ExperienceResult,
  options?: ReelPropsFromExperienceOptions,
): ReelProps {
  return {
    title: result.conceptTitle,
    tagline: result.reelTagline,
    narrativeLines: narrativeToLines(result.narrative),
    photos: result.photos.map((photo) => ({ url: photo.url, alt: photo.alt })),
    palette: result.palette,
    trackName: options?.trackName ?? DEFAULT_TRACK_NAME,
    audioSrc: options?.audioSrc,
  };
}

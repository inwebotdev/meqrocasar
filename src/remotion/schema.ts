import { z } from "zod";

import type { ExperienceResult } from "@/domain/experience/types";

const ReelNarrationSchema = z.object({
  /** Relative (`/api/narration/<hash>`) or absolute URL — Remotion's `<Audio>` needs an absolute one in the browser, see `resolveNarrationSrc` below. */
  src: z.string().min(1),
  durationSec: z.number().nonnegative(),
  sentences: z.array(
    z.object({
      text: z.string(),
      startSec: z.number(),
      endSec: z.number(),
    }),
  ),
});

export type ReelNarration = z.infer<typeof ReelNarrationSchema>;
export type ReelNarrationSentence = ReelNarration["sentences"][number];

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
  /** es-MX voice-over script for the narration track — wired into the composition in the next layer. */
  script: z.string().max(320),
  /** Present only when the experience's narration is `"ready"` — see `reelPropsFromExperience`. */
  narration: ReelNarrationSchema.optional(),
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
  /**
   * Origin (e.g. `window.location.origin`) used to turn a relative
   * `result.narration.src` (`/api/narration/<hash>`) into an absolute URL,
   * which Remotion's `<Audio>` requires. Omit server-side; on the client,
   * `reelPropsFromExperience` falls back to `window.location.origin`
   * itself when it's available, so passing it explicitly is only needed
   * when that global isn't (e.g. a Node test).
   */
  origin?: string;
}

/** Turns a relative narration `src` into an absolute URL; leaves an already-absolute one untouched. */
function resolveNarrationSrc(src: string, origin?: string): string {
  if (/^https?:\/\//i.test(src)) return src;

  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : undefined);
  if (!base) return src;

  return `${base.replace(/\/$/, "")}${src.startsWith("/") ? "" : "/"}${src}`;
}

/** Builds the `ReelProps` for a wedding reel from a generated `ExperienceResult`. */
export function reelPropsFromExperience(
  result: ExperienceResult,
  options?: ReelPropsFromExperienceOptions,
): ReelProps {
  const narration =
    result.narration?.status === "ready"
      ? {
          src: resolveNarrationSrc(result.narration.src, options?.origin),
          durationSec: result.narration.durationSec,
          sentences: result.narration.sentences,
        }
      : undefined;

  return {
    title: result.conceptTitle,
    tagline: result.reelTagline,
    narrativeLines: narrativeToLines(result.narrative),
    photos: result.photos.map((photo) => ({ url: photo.url, alt: photo.alt })),
    palette: result.palette,
    trackName: options?.trackName ?? DEFAULT_TRACK_NAME,
    audioSrc: options?.audioSrc,
    script: result.reelScript,
    narration,
  };
}

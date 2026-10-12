import { z } from "zod";

import type { ExperienceResult } from "@/domain/experience/types";
import { isAllowedImageUrl } from "@/domain/images/allowlist";

const PaletteColorSchema = z
  .object({
    hex: z
      .string()
      .trim()
      .regex(/^#[0-9A-Fa-f]{6}$/, "Expected a 6-digit hex color, e.g. #68182E."),
    name: z.string().trim().min(2).max(30),
  })
  .strict();

export const MoodboardParamsSchema = z
  .object({
    title: z.string().trim().min(4).max(80),
    /** e.g. "Ezequiel Montes · Querétaro". */
    zone: z.string().trim().min(2).max(60),
    tagline: z.string().trim().max(60).optional(),
    palette: z.array(PaletteColorSchema).length(4),
    /**
     * Each entry is either an absolute, allowlisted Unsplash URL or a
     * same-origin `/api/places/photo?...` path (not a valid `z.string().url()`
     * — it's relative), so this validates with `isAllowedImageUrl` directly
     * rather than `.url()` + a host refinement.
     */
    photos: z
      .array(z.string().trim().min(1).refine(isAllowedImageUrl, "Photo URL is not allowlisted."))
      .length(3),
  })
  .strict();

export type MoodboardParams = z.infer<typeof MoodboardParamsSchema>;

export type DecodeMoodboardParamsResult =
  { ok: true; value: MoodboardParams } | { ok: false; reason: "decode" | "schema"; detail: string };

const BASE64URL_PADDING = "=";

/** Browser/Node-portable base64url encoder (no `Buffer`). */
function toBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll(BASE64URL_PADDING, "");
}

/** Browser/Node-portable base64url decoder (no `Buffer`). Throws on malformed input. */
function fromBase64Url(encoded: string): string {
  const base64 = encoded.replaceAll("-", "+").replaceAll("_", "/");
  const padLength = (4 - (base64.length % 4)) % 4;
  const padded = base64 + BASE64URL_PADDING.repeat(padLength);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/** Encodes validated moodboard params as a URL-safe base64 string. */
export function encodeMoodboardParams(params: MoodboardParams): string {
  return toBase64Url(JSON.stringify(params));
}

/**
 * Decodes and validates a base64url-encoded moodboard params string. Never
 * throws: malformed base64/JSON yields `reason: "decode"`, and a
 * well-formed-but-invalid payload yields `reason: "schema"`.
 */
export function decodeMoodboardParams(encoded: string): DecodeMoodboardParamsResult {
  let json: string;
  try {
    json = fromBase64Url(encoded);
  } catch (error) {
    return {
      ok: false,
      reason: "decode",
      detail: error instanceof Error ? error.message : "Malformed base64.",
    };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(json);
  } catch (error) {
    return {
      ok: false,
      reason: "decode",
      detail: error instanceof Error ? error.message : "Malformed JSON.",
    };
  }

  const result = MoodboardParamsSchema.safeParse(parsedJson);
  if (!result.success) {
    return { ok: false, reason: "schema", detail: JSON.stringify(result.error.issues) };
  }

  return { ok: true, value: result.data };
}

/** Builds the `/api/og/moodboard` path for `params`. */
export function buildMoodboardPath(
  params: MoodboardParams,
  options?: { download?: boolean },
): string {
  const encoded = encodeMoodboardParams(params);
  const query = options?.download ? `d=${encoded}&download=1` : `d=${encoded}`;
  return `/api/og/moodboard?${query}`;
}

/**
 * Builds the 3-photo slot for the moodboard from `result.photos`: drops
 * any photo whose `url` isn't `isAllowedImageUrl` (a broken/unavailable
 * photo source must never crash the results page), then fills back up to
 * 3 by duplicating the last valid photo. `undefined` only when every
 * photo was invalid.
 */
function validatedPhotoUrls(result: ExperienceResult): string[] | undefined {
  const valid = result.photos.map((photo) => photo.url).filter(isAllowedImageUrl);
  if (valid.length === 0) return undefined;

  const photos = valid.slice(0, 3);
  while (photos.length < 3) {
    photos.push(photos[photos.length - 1] ?? valid[0]!);
  }

  return photos;
}

/**
 * Derives moodboard params from a generated `ExperienceResult`. Never
 * throws: validated with `safeParse`, and a photo from an unavailable
 * source (e.g. a stale Places proxy path) is dropped and backfilled
 * rather than failing the whole parse — see `validatedPhotoUrls`.
 * `undefined` when there's no valid photo to show at all, or the
 * resulting params otherwise fail schema validation.
 */
export function moodboardParamsFromExperience(
  result: ExperienceResult,
): MoodboardParams | undefined {
  const principalVenue =
    result.venues.find((venue) => venue.role === "principal") ?? result.venues[0];
  const zone = principalVenue ? `${principalVenue.zone} · Querétaro` : "Querétaro";

  const photos = validatedPhotoUrls(result);
  if (!photos) return undefined;

  const parsed = MoodboardParamsSchema.safeParse({
    title: result.conceptTitle,
    zone,
    tagline: result.reelTagline,
    palette: result.palette,
    photos,
  });

  return parsed.success ? parsed.data : undefined;
}

/** Slugifies `title` for use in a download filename. */
export function slugify(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

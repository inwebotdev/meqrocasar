import { z } from "zod";

import type { ExperienceResult } from "@/domain/experience/types";
import { isUnsplashUrl } from "@/domain/images/allowlist";

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
    photos: z
      .array(z.string().url().refine(isUnsplashUrl, "Photo host is not allowlisted."))
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

/** Derives moodboard params from a generated `ExperienceResult`. */
export function moodboardParamsFromExperience(result: ExperienceResult): MoodboardParams {
  const principalVenue =
    result.venues.find((venue) => venue.role === "principal") ?? result.venues[0];
  const zone = principalVenue ? `${principalVenue.zone} · Querétaro` : "Querétaro";

  return MoodboardParamsSchema.parse({
    title: result.conceptTitle,
    zone,
    tagline: result.reelTagline,
    palette: result.palette,
    photos: result.photos.slice(0, 3).map((photo) => photo.url),
  });
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

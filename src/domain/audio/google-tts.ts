import { z } from "zod";

import { NarrationApiError } from "./elevenlabs";
import type { NarrationAlignment, NarrationAudio, NarrationProvider } from "./narration";

/**
 * Google Cloud Text-to-Speech (`v1beta1/text:synthesize`) wrapped as a
 * `NarrationProvider`. Uses SSML marks between sentences and
 * `enableTimePointing` so the per-sentence timings feed the reel captions.
 * Free tier: 1M characters/month for Neural2 voices.
 */
export interface CreateGoogleTtsProviderOptions {
  apiKey: string;
  /** e.g. "es-MX-Neural2-A" (female, Mexican Spanish). */
  voiceName?: string;
  languageCode?: string;
  speakingRate?: number;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export const DEFAULT_GOOGLE_TTS_VOICE = "es-MX-Neural2-A";
export const GOOGLE_TTS_MODEL_ID = "google-tts-v1beta1";
const ENDPOINT = "https://texttospeech.googleapis.com/v1beta1/text:synthesize";

const ResponseSchema = z.object({
  audioContent: z.string().min(1),
  timepoints: z.array(z.object({ markName: z.string(), timeSeconds: z.number() })).optional(),
});

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** `<speak><mark name="m0"/>S1 <mark name="m1"/>S2 <mark name="m2"/></speak>` */
export function buildSsml(sentences: readonly string[]): string {
  const parts = sentences.map((s, i) => `<mark name="m${i}"/>${escapeXml(s)}`);
  return `<speak>${parts.join(" ")}<mark name="m${sentences.length}"/></speak>`;
}

/**
 * Builds a per-character alignment from sentence marks: every character of
 * sentence i is spoken between mark i and mark i+1 (good enough for the
 * sentence-level caption timings the reel needs).
 */
export function alignmentFromMarks(
  sentences: readonly string[],
  marks: ReadonlyMap<string, number>,
  estimatedTotalSec: number,
): NarrationAlignment {
  const chars: string[] = [];
  const startSec: number[] = [];
  const endSec: number[] = [];
  sentences.forEach((sentence, i) => {
    const start = marks.get(`m${i}`) ?? (i === 0 ? 0 : (endSec.at(-1) ?? 0));
    const end = marks.get(`m${i + 1}`) ?? estimatedTotalSec;
    const text = i < sentences.length - 1 ? `${sentence} ` : sentence;
    for (const ch of text) {
      chars.push(ch);
      startSec.push(start);
      endSec.push(end);
    }
  });
  return { chars, startSec, endSec };
}

export function createGoogleTtsProvider(
  options: CreateGoogleTtsProviderOptions,
): NarrationProvider {
  const {
    apiKey,
    voiceName = DEFAULT_GOOGLE_TTS_VOICE,
    languageCode = "es-MX",
    speakingRate = 0.95,
    fetchImpl = fetch,
    timeoutMs = 20000,
  } = options;

  return {
    async synthesize(text: string): Promise<NarrationAudio> {
      const sentences = splitSentences(text);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response: Response;
      try {
        response = await fetchImpl(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input: { ssml: buildSsml(sentences) },
            voice: { languageCode, name: voiceName },
            audioConfig: { audioEncoding: "MP3", speakingRate },
            enableTimePointing: ["SSML_MARK"],
          }),
          signal: controller.signal,
        });
      } catch (error) {
        throw new NarrationApiError(0, `Google TTS request failed: ${String(error)}`);
      } finally {
        clearTimeout(timer);
      }

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new NarrationApiError(
          response.status,
          `Google TTS ${response.status}: ${detail.slice(0, 400)}`,
        );
      }

      const parsed = ResponseSchema.safeParse(await response.json());
      if (!parsed.success) {
        throw new NarrationApiError(502, "Google TTS returned an unexpected response shape.");
      }

      const audio = Uint8Array.from(Buffer.from(parsed.data.audioContent, "base64"));
      const marks = new Map(parsed.data.timepoints?.map((t) => [t.markName, t.timeSeconds]) ?? []);
      // ~16 chars/sec at 0.95 rate as the last-resort estimate when the end mark is missing.
      const estimatedTotalSec = marks.get(`m${sentences.length}`) ?? text.length / 16;
      return {
        audio,
        contentType: "audio/mpeg",
        alignment: alignmentFromMarks(sentences, marks, estimatedTotalSec),
      };
    },
  };
}

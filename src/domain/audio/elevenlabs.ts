import { z } from "zod";

import type { NarrationAudio, NarrationProvider } from "./narration";

/**
 * ElevenLabs' `POST /v1/text-to-speech/{voiceId}/with-timestamps` call
 * (multilingual v2 model), wrapped as a `NarrationProvider`. Mocked in
 * tests via `mockElevenLabsTts` (`test/msw/handlers.ts`) — never called
 * against the real API in this layer (see `.env` notes in the README).
 */

export interface CreateElevenLabsProviderOptions {
  apiKey: string;
  voiceId: string;
  /** Defaults to `"eleven_multilingual_v2"`. */
  modelId?: string;
  fetchImpl?: typeof fetch;
  /** Defaults to 15000. */
  timeoutMs?: number;
}

/** Thrown by `synthesize` on any failure (HTTP error, timeout, network, or an unexpected response shape). */
export class NarrationApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "NarrationApiError";
    this.status = status;
  }
}

const DEFAULT_MODEL_ID = "eleven_multilingual_v2";
const DEFAULT_TIMEOUT_MS = 15000;
const BASE_URL = "https://api.elevenlabs.io/v1";

const AlignmentResponseSchema = z.object({
  characters: z.array(z.string()),
  character_start_times_seconds: z.array(z.number()),
  character_end_times_seconds: z.array(z.number()),
});

const TtsWithTimestampsResponseSchema = z.object({
  audio_base64: z.string().min(1),
  alignment: AlignmentResponseSchema.optional(),
});

/** Builds the ElevenLabs text-to-speech provider. No network call happens until `synthesize` is invoked. */
export function createElevenLabsProvider(
  options: CreateElevenLabsProviderOptions,
): NarrationProvider {
  const modelId = options.modelId ?? DEFAULT_MODEL_ID;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    async synthesize(text: string): Promise<NarrationAudio> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      let response: Response;
      try {
        response = await fetchImpl(
          `${BASE_URL}/text-to-speech/${encodeURIComponent(options.voiceId)}/with-timestamps`,
          {
            method: "POST",
            headers: {
              "xi-api-key": options.apiKey,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              text,
              model_id: modelId,
              output_format: "mp3_44100_128",
              voice_settings: {
                stability: 0.5,
                similarity_boost: 0.8,
                style: 0.2,
                use_speaker_boost: true,
              },
            }),
            signal: controller.signal,
          },
        );
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          throw new NarrationApiError(408, "ElevenLabs request timed out.");
        }
        const message =
          error instanceof Error ? error.message : "Network error calling ElevenLabs.";
        throw new NarrationApiError(0, message);
      } finally {
        clearTimeout(timer);
      }

      if (!response.ok) {
        const detail = await response.text().catch(() => response.statusText);
        throw new NarrationApiError(
          response.status,
          detail.length > 0 ? detail : `ElevenLabs responded with HTTP ${response.status}.`,
        );
      }

      let rawBody: unknown;
      try {
        rawBody = await response.json();
      } catch {
        throw new NarrationApiError(502, "ElevenLabs response wasn't valid JSON.");
      }

      const parsed = TtsWithTimestampsResponseSchema.safeParse(rawBody);
      if (!parsed.success) {
        throw new NarrationApiError(502, "Unexpected ElevenLabs response shape.");
      }

      const audio = Buffer.from(parsed.data.audio_base64, "base64");
      const alignment = parsed.data.alignment
        ? {
            chars: parsed.data.alignment.characters,
            startSec: parsed.data.alignment.character_start_times_seconds,
            endSec: parsed.data.alignment.character_end_times_seconds,
          }
        : undefined;

      return { audio: new Uint8Array(audio), contentType: "audio/mpeg", alignment };
    },
  };
}

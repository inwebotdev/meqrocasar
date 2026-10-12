import { HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { mockElevenLabsTts } from "../../../test/msw/handlers";
import { server } from "../../../test/msw/server";

import { createElevenLabsProvider, NarrationApiError } from "./elevenlabs";

const SAMPLE_AUDIO_BASE64 = Buffer.from([0xff, 0xfb, 0x90, 0x00]).toString("base64");

describe("createElevenLabsProvider", () => {
  it("POSTs the expected headers, body and voice id, and decodes the response", async () => {
    let seen: Parameters<Parameters<typeof mockElevenLabsTts>[0]>[0] | undefined;

    server.use(
      mockElevenLabsTts((info) => {
        seen = info;
        return HttpResponse.json({
          audio_base64: SAMPLE_AUDIO_BASE64,
          alignment: {
            characters: ["H", "o", "l", "a"],
            character_start_times_seconds: [0, 0.1, 0.2, 0.3],
            character_end_times_seconds: [0.1, 0.2, 0.3, 0.4],
          },
        });
      }),
    );

    const provider = createElevenLabsProvider({ apiKey: "sk-test", voiceId: "voice-1" });
    const result = await provider.synthesize("Hola");

    expect(seen?.voiceId).toBe("voice-1");
    expect(seen?.request.headers.get("xi-api-key")).toBe("sk-test");
    expect(seen?.request.headers.get("content-type")).toBe("application/json");
    expect(seen?.request.headers.get("accept")).toBe("application/json");
    expect(seen?.body).toEqual({
      text: "Hola",
      model_id: "eleven_multilingual_v2",
      output_format: "mp3_44100_128",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.8,
        style: 0.2,
        use_speaker_boost: true,
      },
    });

    expect(result.contentType).toBe("audio/mpeg");
    expect(Array.from(result.audio)).toEqual([0xff, 0xfb, 0x90, 0x00]);
    expect(result.alignment).toEqual({
      chars: ["H", "o", "l", "a"],
      startSec: [0, 0.1, 0.2, 0.3],
      endSec: [0.1, 0.2, 0.3, 0.4],
    });
  });

  it("sends a custom modelId when given", async () => {
    let modelId: unknown;

    server.use(
      mockElevenLabsTts((info) => {
        modelId = info.body.model_id;
        return HttpResponse.json({ audio_base64: SAMPLE_AUDIO_BASE64 });
      }),
    );

    const provider = createElevenLabsProvider({
      apiKey: "sk-test",
      voiceId: "voice-1",
      modelId: "eleven_turbo_v2_5",
    });
    await provider.synthesize("Hola");

    expect(modelId).toBe("eleven_turbo_v2_5");
  });

  it("resolves with no alignment when the response omits it", async () => {
    server.use(mockElevenLabsTts(() => HttpResponse.json({ audio_base64: SAMPLE_AUDIO_BASE64 })));

    const provider = createElevenLabsProvider({ apiKey: "sk-test", voiceId: "voice-1" });
    const result = await provider.synthesize("Hola");

    expect(result.alignment).toBeUndefined();
  });

  it("throws a NarrationApiError with the response status on an HTTP error", async () => {
    server.use(
      mockElevenLabsTts(() => HttpResponse.json({ detail: "bad voice id" }, { status: 422 })),
    );

    const provider = createElevenLabsProvider({ apiKey: "sk-test", voiceId: "voice-1" });

    await expect(provider.synthesize("Hola")).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(NarrationApiError);
      expect((error as NarrationApiError).status).toBe(422);
      return true;
    });
  });

  it("throws a NarrationApiError on an unexpected response shape", async () => {
    server.use(mockElevenLabsTts(() => HttpResponse.json({ oops: true })));

    const provider = createElevenLabsProvider({ apiKey: "sk-test", voiceId: "voice-1" });

    await expect(provider.synthesize("Hola")).rejects.toBeInstanceOf(NarrationApiError);
  });

  it("aborts and throws a NarrationApiError when the request exceeds timeoutMs", async () => {
    server.use(
      mockElevenLabsTts(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return HttpResponse.json({ audio_base64: SAMPLE_AUDIO_BASE64 });
      }),
    );

    const provider = createElevenLabsProvider({
      apiKey: "sk-test",
      voiceId: "voice-1",
      timeoutMs: 5,
    });

    await expect(provider.synthesize("Hola")).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(NarrationApiError);
      expect((error as NarrationApiError).status).toBe(408);
      return true;
    });
  });
});

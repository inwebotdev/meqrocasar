import "server-only";

import { createElevenLabsProvider } from "@/domain/audio/elevenlabs";
import { createGoogleTtsProvider, GOOGLE_TTS_MODEL_ID } from "@/domain/audio/google-tts";
import { createNarrationService, type NarrationService } from "@/domain/audio/service";
import { createNarrationStore, type NarrationStore } from "@/domain/audio/store";

import { getEnv } from "./env";

export interface NarrationDeps {
  store: NarrationStore;
  service: NarrationService;
}

/**
 * Builds the narration store (always, so the `/api/narration/*` routes
 * always have one) and service: the ElevenLabs provider is only built —
 * and `ensure` only ever resolves `"ready"`/`"pending"` — when both
 * `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` are configured; otherwise
 * the service always resolves `"disabled"` (see `createNarrationService`).
 */
function buildDeps(): NarrationDeps {
  const env = getEnv();
  const store = createNarrationStore(env.NARRATION_CACHE_DIR);

  const googleKey = env.GOOGLE_TTS_API_KEY ?? env.GOOGLE_PLACES_API_KEY;
  const wantsGoogle =
    env.NARRATION_PROVIDER === "google" ||
    (env.NARRATION_PROVIDER === "auto" && Boolean(googleKey));
  const wantsEleven =
    env.NARRATION_PROVIDER === "elevenlabs" || (env.NARRATION_PROVIDER === "auto" && !wantsGoogle);

  let provider;
  let voiceId = "";
  let modelId = "none";
  if (wantsGoogle && googleKey) {
    provider = createGoogleTtsProvider({ apiKey: googleKey, voiceName: env.GOOGLE_TTS_VOICE });
    voiceId = env.GOOGLE_TTS_VOICE;
    modelId = GOOGLE_TTS_MODEL_ID;
  } else if (wantsEleven && env.ELEVENLABS_API_KEY && env.ELEVENLABS_VOICE_ID) {
    provider = createElevenLabsProvider({
      apiKey: env.ELEVENLABS_API_KEY,
      voiceId: env.ELEVENLABS_VOICE_ID,
      modelId: env.ELEVENLABS_MODEL_ID,
    });
    voiceId = env.ELEVENLABS_VOICE_ID;
    modelId = env.ELEVENLABS_MODEL_ID;
  }

  const service = createNarrationService({ provider, store, voiceId, modelId });

  return { store, service };
}

let cachedDeps: NarrationDeps | undefined;

/**
 * The narration store/service used by `getExperienceService` and the
 * `/api/narration/*` routes, built from `getEnv()` and memoised for the
 * lifetime of the process.
 */
export function getNarrationDeps(): NarrationDeps {
  if (!cachedDeps) {
    cachedDeps = buildDeps();
  }

  return cachedDeps;
}

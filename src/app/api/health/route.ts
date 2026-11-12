import { getEnv } from "@/lib/env";
import { isVercel } from "@/lib/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Deployment diagnostics without secrets: which commit runs and which providers are configured. */
export async function GET(): Promise<Response> {
  const env = getEnv();
  const googleTtsKey = env.GOOGLE_TTS_API_KEY ?? env.GOOGLE_PLACES_API_KEY;
  const narrationMode = process.env.NARRATION_STORE ?? "auto";
  const blobConfigured = Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
  const store =
    narrationMode === "blob" || (narrationMode === "auto" && blobConfigured) ? "blob" : "disk";
  const wantsGoogle =
    env.NARRATION_PROVIDER === "google" ||
    (env.NARRATION_PROVIDER === "auto" && Boolean(googleTtsKey));
  const provider =
    wantsGoogle && googleTtsKey
      ? "google"
      : env.ELEVENLABS_API_KEY && env.ELEVENLABS_VOICE_ID
        ? "elevenlabs"
        : "none";

  return Response.json(
    {
      ok: true,
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      vercel: isVercel(),
      narration: {
        provider,
        store,
        voice: provider === "google" ? env.GOOGLE_TTS_VOICE : undefined,
        cacheDir: env.NARRATION_CACHE_DIR,
      },
      openRouter: {
        configured: Boolean(env.OPENROUTER_API_KEY),
        fast: env.OPENROUTER_MODEL_FAST,
        primary: env.OPENROUTER_MODEL_PRIMARY,
      },
      places: { configured: Boolean(env.GOOGLE_PLACES_API_KEY) },
      unsplash: { configured: Boolean(env.UNSPLASH_ACCESS_KEY) },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

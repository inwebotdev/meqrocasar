import type { ApiResponse } from "@/domain/api/envelope";
import type { NarrationMetaData } from "@/domain/audio/store";

/**
 * Client-side fetch for `GET /api/narration/[hash]/meta`, used by
 * `useNarration` to poll a pending narration until it's ready. Never
 * throws: a network error or a non-2xx/malformed envelope both resolve
 * `undefined` so the caller can just keep polling.
 */
export async function fetchNarrationMeta(hash: string): Promise<NarrationMetaData | undefined> {
  try {
    const response = await fetch(`/api/narration/${hash}/meta`, { cache: "no-store" });
    if (!response.ok) {
      return undefined;
    }

    const body = (await response.json()) as ApiResponse<NarrationMetaData>;
    return body.ok ? body.data : undefined;
  } catch {
    return undefined;
  }
}

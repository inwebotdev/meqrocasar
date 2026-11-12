import { del, head, put } from "@vercel/blob";

import type { NarrationMeta, NarrationStatus, NarrationStore, NarrationStoreEntry } from "./store";

function keys(hash: string) {
  return {
    mp3: `narration/${hash}.mp3`,
    json: `narration/${hash}.json`,
    pending: `narration/${hash}.pending`,
  };
}

async function headOrUndefined(pathname: string): Promise<{ url: string } | undefined> {
  try {
    return await head(pathname);
  } catch {
    return undefined;
  }
}

/** Vercel Blob-backed narration cache (public blobs, deterministic paths). Needs `BLOB_READ_WRITE_TOKEN`. */
export function createBlobNarrationStore(): NarrationStore {
  return {
    async get(hash): Promise<NarrationStoreEntry | undefined> {
      const { mp3, json } = keys(hash);
      const [audio, sidecar] = await Promise.all([headOrUndefined(mp3), headOrUndefined(json)]);
      if (!audio || !sidecar) {
        return undefined;
      }

      try {
        const response = await fetch(sidecar.url, { cache: "no-store" });
        if (!response.ok) {
          return undefined;
        }
        return { audioUrl: audio.url, meta: (await response.json()) as NarrationMeta };
      } catch {
        return undefined;
      }
    },

    async put(hash, audio, meta) {
      const { mp3, json } = keys(hash);
      const common = { access: "public", addRandomSuffix: false, allowOverwrite: true } as const;
      await put(mp3, Buffer.from(audio), { ...common, contentType: "audio/mpeg" });
      await put(json, JSON.stringify(meta), { ...common, contentType: "application/json" });
      await this.clearPending(hash);
    },

    async status(hash): Promise<NarrationStatus> {
      const { mp3, json, pending } = keys(hash);
      const [audio, sidecar] = await Promise.all([headOrUndefined(mp3), headOrUndefined(json)]);
      if (audio && sidecar) {
        return "ready";
      }
      return (await headOrUndefined(pending)) ? "pending" : "missing";
    },

    async markPending(hash) {
      // Vercel Blob rejects empty bodies, so the marker carries a timestamp.
      await put(keys(hash).pending, JSON.stringify({ startedAt: new Date().toISOString() }), {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "text/plain",
      });
    },

    async clearPending(hash) {
      try {
        await del(keys(hash).pending);
      } catch {
        // Already gone.
      }
    },
  };
}

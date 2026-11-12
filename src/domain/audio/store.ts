import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import type { NarrationSentence } from "./narration";

/** Sidecar JSON written next to `<hash>.mp3` — everything the meta route and the cache-hit path need, without re-reading the mp3. */
export interface NarrationMeta {
  script: string;
  voiceId: string;
  modelId: string;
  durationSec: number;
  sentences: NarrationSentence[];
  createdAt: string;
}

export interface NarrationStoreEntry {
  /** Absolute path to the cached `<hash>.mp3` (disk store only). */
  audioPath?: string;
  /** Public URL of the cached mp3 (blob store only); the route redirects to it. */
  audioUrl?: string;
  meta: NarrationMeta;
}

export type NarrationStatus = "ready" | "pending" | "missing";

/** What `GET /api/narration/[hash]/meta` returns as its `data` — shared between the route and `narration-client.ts`. */
export interface NarrationMetaData {
  status: NarrationStatus;
  durationSec?: number;
  sentences?: NarrationSentence[];
}

export interface NarrationStore {
  /** `undefined` when the mp3 or its sidecar JSON isn't on disk (or isn't valid JSON). */
  get(hash: string): Promise<NarrationStoreEntry | undefined>;
  /** Writes `<hash>.mp3` + `<hash>.json` and clears any `<hash>.pending` marker. */
  put(hash: string, audio: Uint8Array, meta: NarrationMeta): Promise<void>;
  /** `"ready"` when both cache files exist, else `"pending"` when the marker from `markPending` exists, else `"missing"`. */
  status(hash: string): Promise<NarrationStatus>;
  /** Marks a hash as being synthesized, so a concurrent request (or this same one, on retry) can report `"pending"` instead of `"missing"`. */
  markPending(hash: string): Promise<void>;
  clearPending(hash: string): Promise<void>;
}

interface StorePaths {
  mp3: string;
  json: string;
  pending: string;
}

function pathsFor(dir: string, hash: string): StorePaths {
  return {
    mp3: path.join(dir, `${hash}.mp3`),
    json: path.join(dir, `${hash}.json`),
    pending: path.join(dir, `${hash}.pending`),
  };
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Disk-backed narration cache rooted at `dir` (created lazily on first write) — mirrors the `/api/places/photo` disk-cache pattern. */
export function createNarrationStore(dir: string): NarrationStore {
  const root = path.resolve(dir);

  return {
    async get(hash) {
      const { mp3, json } = pathsFor(root, hash);

      try {
        await stat(mp3);
        const metaRaw = await readFile(json, "utf-8");
        return { audioPath: mp3, meta: JSON.parse(metaRaw) as NarrationMeta };
      } catch {
        return undefined;
      }
    },

    async put(hash, audio, meta) {
      const { mp3, json, pending } = pathsFor(root, hash);
      await mkdir(root, { recursive: true });
      await writeFile(mp3, audio);
      await writeFile(json, JSON.stringify(meta));
      await rm(pending, { force: true });
    },

    async status(hash) {
      const { mp3, json, pending } = pathsFor(root, hash);

      if ((await fileExists(mp3)) && (await fileExists(json))) {
        return "ready";
      }
      if (await fileExists(pending)) {
        return "pending";
      }
      return "missing";
    },

    async markPending(hash) {
      const { pending } = pathsFor(root, hash);
      await mkdir(root, { recursive: true });
      await writeFile(pending, "");
    },

    async clearPending(hash) {
      const { pending } = pathsFor(root, hash);
      await rm(pending, { force: true });
    },
  };
}

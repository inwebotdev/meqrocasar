import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createNarrationStore, type NarrationMeta } from "./store";

const HASH = "a".repeat(64);

function buildMeta(overrides: Partial<NarrationMeta> = {}): NarrationMeta {
  return {
    script: "Hola, mundo.",
    voiceId: "voice-1",
    modelId: "eleven_multilingual_v2",
    durationSec: 1.5,
    sentences: [{ text: "Hola, mundo.", startSec: 0, endSec: 1.5 }],
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "narration-store-test-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("createNarrationStore", () => {
  it("reports 'missing' for an unknown hash", async () => {
    const store = createNarrationStore(dir);
    expect(await store.status(HASH)).toBe("missing");
    expect(await store.get(HASH)).toBeUndefined();
  });

  it("put then get round-trips the audio bytes and meta", async () => {
    const store = createNarrationStore(dir);
    const audio = new Uint8Array([1, 2, 3, 4]);
    const meta = buildMeta();

    await store.put(HASH, audio, meta);
    const entry = await store.get(HASH);

    expect(entry).toBeDefined();
    expect(entry?.meta).toEqual(meta);
    const bytes = await readFile(entry!.audioPath);
    expect(Array.from(bytes)).toEqual([1, 2, 3, 4]);
  });

  it("reports 'ready' once put has written both files", async () => {
    const store = createNarrationStore(dir);
    await store.put(HASH, new Uint8Array([1]), buildMeta());
    expect(await store.status(HASH)).toBe("ready");
  });

  it("reports 'pending' after markPending, and 'missing' again after clearPending", async () => {
    const store = createNarrationStore(dir);

    await store.markPending(HASH);
    expect(await store.status(HASH)).toBe("pending");

    await store.clearPending(HASH);
    expect(await store.status(HASH)).toBe("missing");
  });

  it("put clears a pending marker for the same hash", async () => {
    const store = createNarrationStore(dir);

    await store.markPending(HASH);
    await store.put(HASH, new Uint8Array([1]), buildMeta());

    expect(await store.status(HASH)).toBe("ready");
  });

  it("clearPending on a hash with no marker is a no-op", async () => {
    const store = createNarrationStore(dir);
    await expect(store.clearPending(HASH)).resolves.toBeUndefined();
  });

  it("keeps separate hashes independent", async () => {
    const store = createNarrationStore(dir);
    const otherHash = "b".repeat(64);

    await store.put(HASH, new Uint8Array([1]), buildMeta());
    await store.markPending(otherHash);

    expect(await store.status(HASH)).toBe("ready");
    expect(await store.status(otherHash)).toBe("pending");
  });
});

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { NarrationAudio, NarrationProvider } from "./narration";
import { createNarrationService } from "./service";
import { createNarrationStore } from "./store";

const SCRIPT = "Uno. Dos. Tres.";

function audioResult(overrides: Partial<NarrationAudio> = {}): NarrationAudio {
  return {
    audio: new Uint8Array([1, 2, 3]),
    contentType: "audio/mpeg",
    alignment: {
      chars: SCRIPT.split(""),
      startSec: SCRIPT.split("").map((_, i) => i * 0.1),
      endSec: SCRIPT.split("").map((_, i) => (i + 1) * 0.1),
    },
    ...overrides,
  };
}

function delayedProvider(ms: number, result: NarrationAudio = audioResult()): NarrationProvider {
  return {
    synthesize: () => new Promise((resolve) => setTimeout(() => resolve(result), ms)),
  };
}

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "narration-service-test-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("createNarrationService", () => {
  it("resolves 'disabled' when no provider is configured, without touching the store", async () => {
    const store = createNarrationStore(dir);
    const service = createNarrationService({ store, voiceId: "v1", modelId: "m1" });

    const ref = await service.ensure(SCRIPT, { budgetMs: 1000 });

    expect(ref).toEqual({ status: "disabled" });
  });

  it("is a cache hit (no synthesize call) when the hash is already in the store", async () => {
    const store = createNarrationStore(dir);
    const synthesize = vi.fn(async () => audioResult());
    const service = createNarrationService({
      store,
      provider: { synthesize },
      voiceId: "v1",
      modelId: "m1",
    });

    const first = await service.ensure(SCRIPT, { budgetMs: 1000 });
    expect(first.status).toBe("ready");
    synthesize.mockClear();

    const second = await service.ensure(SCRIPT, { budgetMs: 1000 });
    expect(second).toEqual(first);
    expect(synthesize).not.toHaveBeenCalled();
  });

  it("resolves 'ready' with hash/src/durationSec/sentences when synthesis finishes within budget", async () => {
    const store = createNarrationStore(dir);
    const service = createNarrationService({
      store,
      provider: delayedProvider(5),
      voiceId: "v1",
      modelId: "m1",
    });

    const ref = await service.ensure(SCRIPT, { budgetMs: 200 });

    expect(ref.status).toBe("ready");
    if (ref.status !== "ready") return;
    expect(ref.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(ref.src).toBe(`/api/narration/${ref.hash}`);
    expect(ref.durationSec).toBeCloseTo(1.5, 5);
    expect(ref.sentences).toHaveLength(3);
  });

  it("resolves 'pending' when synthesis exceeds the budget, then becomes ready in the background", async () => {
    const store = createNarrationStore(dir);
    const service = createNarrationService({
      store,
      provider: delayedProvider(150),
      voiceId: "v1",
      modelId: "m1",
    });

    const pending = await service.ensure(SCRIPT, { budgetMs: 20 });
    expect(pending.status).toBe("pending");
    if (pending.status !== "pending") return;

    await vi.waitFor(async () => {
      expect(await store.status(pending.hash)).toBe("ready");
    });

    const ready = await service.ensure(SCRIPT, { budgetMs: 20 });
    expect(ready).toEqual({
      status: "ready",
      hash: pending.hash,
      src: pending.src,
      durationSec: 1.5,
      sentences: expect.any(Array),
    });
  });

  it("doesn't start a second synthesis for a hash already in flight (single-flight)", async () => {
    const store = createNarrationStore(dir);
    const synthesize = vi.fn(() => delayedProvider(50).synthesize(""));
    const service = createNarrationService({
      store,
      provider: { synthesize },
      voiceId: "v1",
      modelId: "m1",
    });

    const [a, b] = await Promise.all([
      service.ensure(SCRIPT, { budgetMs: 10 }),
      service.ensure(SCRIPT, { budgetMs: 10 }),
    ]);

    expect(a.status).toBe("pending");
    expect(b.status).toBe("pending");
    if (a.status !== "pending" || b.status !== "pending") return;
    expect(a.hash).toBe(b.hash);
    expect(synthesize).toHaveBeenCalledTimes(1);
  });

  it("clears the pending marker and leaves the narration missing when the provider rejects", async () => {
    const store = createNarrationStore(dir);
    const provider: NarrationProvider = {
      synthesize: () => Promise.reject(new Error("provider down")),
    };
    const service = createNarrationService({ store, provider, voiceId: "v1", modelId: "m1" });

    const ref = await service.ensure(SCRIPT, { budgetMs: 50 });
    expect(ref.status).toBe("pending");
    if (ref.status !== "pending") return;

    await vi.waitFor(async () => {
      expect(await store.status(ref.hash)).toBe("missing");
    });
  });

  it("estimates duration from text length when the provider returns no alignment", async () => {
    const store = createNarrationStore(dir);
    const provider: NarrationProvider = {
      synthesize: async () => audioResult({ alignment: undefined }),
    };
    const service = createNarrationService({ store, provider, voiceId: "v1", modelId: "m1" });

    const ref = await service.ensure(SCRIPT, { budgetMs: 200 });

    expect(ref.status).toBe("ready");
    if (ref.status !== "ready") return;
    expect(ref.durationSec).toBeGreaterThan(0);
    expect(ref.sentences.length).toBeGreaterThan(0);
  });
});

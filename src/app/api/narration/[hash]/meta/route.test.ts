import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getNarrationDepsMock } = vi.hoisted(() => ({ getNarrationDepsMock: vi.fn() }));

vi.mock("@/lib/narration-deps", () => ({
  getNarrationDeps: getNarrationDepsMock,
}));

const { createNarrationStore } = await import("@/domain/audio/store");
const { GET } = await import("./route");

const HASH = "d".repeat(64);

function makeParams(hash: string) {
  return { params: Promise.resolve({ hash }) };
}

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "narration-meta-route-test-"));
  getNarrationDepsMock.mockReset();
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("GET /api/narration/[hash]/meta", () => {
  it("400s on a malformed hash", async () => {
    const store = createNarrationStore(dir);
    getNarrationDepsMock.mockReturnValue({ store });

    const response = await GET(new Request("http://localhost"), makeParams("nope"));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("invalid_params");
  });

  it("reports 'missing' for an unknown hash", async () => {
    const store = createNarrationStore(dir);
    getNarrationDepsMock.mockReturnValue({ store });

    const response = await GET(new Request("http://localhost"), makeParams(HASH));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true, data: { status: "missing" } });
  });

  it("reports 'pending' once marked pending", async () => {
    const store = createNarrationStore(dir);
    await store.markPending(HASH);
    getNarrationDepsMock.mockReturnValue({ store });

    const response = await GET(new Request("http://localhost"), makeParams(HASH));
    const body = await response.json();
    expect(body).toEqual({ ok: true, data: { status: "pending" } });
  });

  it("reports 'ready' with durationSec/sentences once cached", async () => {
    const store = createNarrationStore(dir);
    const sentences = [{ text: "Hola.", startSec: 0, endSec: 1 }];
    await store.put(HASH, new Uint8Array([1, 2, 3]), {
      script: "Hola.",
      voiceId: "v1",
      modelId: "m1",
      durationSec: 1,
      sentences,
      createdAt: new Date(0).toISOString(),
    });
    getNarrationDepsMock.mockReturnValue({ store });

    const response = await GET(new Request("http://localhost"), makeParams(HASH));
    const body = await response.json();
    expect(body).toEqual({
      ok: true,
      data: { status: "ready", durationSec: 1, sentences },
    });
  });

  it("sets no-store cache headers", async () => {
    const store = createNarrationStore(dir);
    getNarrationDepsMock.mockReturnValue({ store });

    const response = await GET(new Request("http://localhost"), makeParams(HASH));
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});

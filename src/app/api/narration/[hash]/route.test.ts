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

const HASH = "c".repeat(64);
const AUDIO_BYTES = new Uint8Array(Array.from({ length: 10 }, (_, i) => i));

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request(`http://localhost/api/narration/${HASH}`, { headers });
}

function makeParams(hash: string) {
  return { params: Promise.resolve({ hash }) };
}

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "narration-route-test-"));
  getNarrationDepsMock.mockReset();
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("GET /api/narration/[hash]", () => {
  it("400s on a malformed hash", async () => {
    const store = createNarrationStore(dir);
    getNarrationDepsMock.mockReturnValue({ store });

    const response = await GET(makeRequest(), makeParams("not-a-hash"));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("invalid_params");
  });

  it("404s when the hash isn't cached", async () => {
    const store = createNarrationStore(dir);
    getNarrationDepsMock.mockReturnValue({ store });

    const response = await GET(makeRequest(), makeParams(HASH));
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("not_found");
  });

  it("200s with the full mp3 and the expected headers", async () => {
    const store = createNarrationStore(dir);
    await store.put(HASH, AUDIO_BYTES, {
      script: "Hola.",
      voiceId: "v1",
      modelId: "m1",
      durationSec: 1,
      sentences: [{ text: "Hola.", startSec: 0, endSec: 1 }],
      createdAt: new Date(0).toISOString(),
    });
    getNarrationDepsMock.mockReturnValue({ store });

    const response = await GET(makeRequest(), makeParams(HASH));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("audio/mpeg");
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(response.headers.get("content-length")).toBe(String(AUDIO_BYTES.length));

    const buffer = Buffer.from(await response.arrayBuffer());
    expect(Array.from(buffer)).toEqual(Array.from(AUDIO_BYTES));
  });

  it("206s and returns only the requested byte range", async () => {
    const store = createNarrationStore(dir);
    await store.put(HASH, AUDIO_BYTES, {
      script: "Hola.",
      voiceId: "v1",
      modelId: "m1",
      durationSec: 1,
      sentences: [],
      createdAt: new Date(0).toISOString(),
    });
    getNarrationDepsMock.mockReturnValue({ store });

    const response = await GET(makeRequest({ Range: "bytes=2-4" }), makeParams(HASH));

    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe(`bytes 2-4/${AUDIO_BYTES.length}`);
    expect(response.headers.get("content-length")).toBe("3");

    const buffer = Buffer.from(await response.arrayBuffer());
    expect(Array.from(buffer)).toEqual([2, 3, 4]);
  });

  it("falls back to a full 200 response for an out-of-range Range header", async () => {
    const store = createNarrationStore(dir);
    await store.put(HASH, AUDIO_BYTES, {
      script: "Hola.",
      voiceId: "v1",
      modelId: "m1",
      durationSec: 1,
      sentences: [],
      createdAt: new Date(0).toISOString(),
    });
    getNarrationDepsMock.mockReturnValue({ store });

    const response = await GET(makeRequest({ Range: "bytes=999-1000" }), makeParams(HASH));

    expect(response.status).toBe(200);
  });
});

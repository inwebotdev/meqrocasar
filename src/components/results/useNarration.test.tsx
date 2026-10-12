import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import type { ExperienceResult } from "@/domain/experience/types";

const { fetchNarrationMetaMock, saveResultMock } = vi.hoisted(() => ({
  fetchNarrationMetaMock: vi.fn(),
  saveResultMock: vi.fn(),
}));

vi.mock("@/lib/narration-client", () => ({ fetchNarrationMeta: fetchNarrationMetaMock }));
vi.mock("@/lib/results-store", () => ({ saveResult: saveResultMock }));

const { useNarration } = await import("./useNarration");

const HASH = "e".repeat(64);

function baseResult(overrides: Partial<ExperienceResult> = {}): ExperienceResult {
  return {
    conceptTitle: "Atardecer Dorado",
    palette: [
      { hex: "#4B001A", name: "Vino" },
      { hex: "#944933", name: "Terracota" },
      { hex: "#E9A844", name: "Ámbar" },
      { hex: "#FCF9F3", name: "Lino" },
    ],
    narrative: "Narrativa.",
    reelTagline: "Tagline",
    reelScript: "Guion.",
    searchQueries: ["query"],
    venues: [],
    photos: [
      { url: "https://images.unsplash.com/photo-1", alt: "a", credit: "c" },
      { url: "https://images.unsplash.com/photo-2", alt: "b", credit: "c" },
      { url: "https://images.unsplash.com/photo-3", alt: "c", credit: "c" },
    ],
    meta: {
      model: "test",
      fallbackUsed: false,
      durationMs: 1,
      generatedAt: "2026-01-01T00:00:00.000Z",
    },
    ...overrides,
  };
}

afterEach(() => {
  fetchNarrationMetaMock.mockReset();
  saveResultMock.mockReset();
});

describe("useNarration", () => {
  it("echoes the result back unchanged when there's no narration", () => {
    const result = baseResult();
    const { result: hook } = renderHook(() => useNarration(result, 10, 50));
    expect(hook.current).toEqual(result);
    expect(fetchNarrationMetaMock).not.toHaveBeenCalled();
  });

  it("echoes the result back unchanged when narration is already 'ready'", () => {
    const result = baseResult({
      narration: {
        status: "ready",
        hash: HASH,
        src: `/api/narration/${HASH}`,
        durationSec: 2,
        sentences: [],
      },
    });
    const { result: hook } = renderHook(() => useNarration(result, 10, 50));
    expect(hook.current).toEqual(result);
    expect(fetchNarrationMetaMock).not.toHaveBeenCalled();
  });

  it("polls meta while pending, then updates and persists the result once ready", async () => {
    fetchNarrationMetaMock.mockResolvedValueOnce({ status: "pending" }).mockResolvedValueOnce({
      status: "ready",
      durationSec: 3.5,
      sentences: [{ text: "Hola.", startSec: 0, endSec: 3.5 }],
    });

    const result = baseResult({
      narration: { status: "pending", hash: HASH, src: `/api/narration/${HASH}` },
    });

    const { result: hook } = renderHook(() => useNarration(result, 5, 500));

    await waitFor(() => {
      expect(hook.current?.narration?.status).toBe("ready");
    });

    expect(hook.current?.narration).toEqual({
      status: "ready",
      hash: HASH,
      src: `/api/narration/${HASH}`,
      durationSec: 3.5,
      sentences: [{ text: "Hola.", startSec: 0, endSec: 3.5 }],
    });
    expect(saveResultMock).toHaveBeenCalledWith(hook.current);
  });

  it("stops polling after pollTimeoutMs while still pending", async () => {
    fetchNarrationMetaMock.mockResolvedValue({ status: "pending" });

    const result = baseResult({
      narration: { status: "pending", hash: HASH, src: `/api/narration/${HASH}` },
    });

    renderHook(() => useNarration(result, 5, 20));

    await new Promise((resolve) => setTimeout(resolve, 60));
    const callsAtTimeout = fetchNarrationMetaMock.mock.calls.length;

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(fetchNarrationMetaMock.mock.calls.length).toBe(callsAtTimeout);
  });
});

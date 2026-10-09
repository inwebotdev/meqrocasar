import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import { useAudioAvailability } from "./useAudioAvailability";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("useAudioAvailability", () => {
  it('reports "available" when the HEAD request succeeds with an audio content type', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(null, { status: 200, headers: { "content-type": "audio/mpeg" } }),
      );

    const { result } = renderHook(() => useAudioAvailability("/audio/wedding-theme.mp3"));

    await waitFor(() =>
      expect(result.current).toEqual({ status: "available", src: "/audio/wedding-theme.mp3" }),
    );
  });

  it('reports "missing" when the response is not ok', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));

    const { result } = renderHook(() => useAudioAvailability("/audio/wedding-theme.mp3"));

    await waitFor(() => expect(result.current).toEqual({ status: "missing" }));
  });

  it('reports "missing" when the content type is not audio', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(null, { status: 200, headers: { "content-type": "text/html" } }),
      );

    const { result } = renderHook(() => useAudioAvailability("/audio/wedding-theme.mp3"));

    await waitFor(() => expect(result.current).toEqual({ status: "missing" }));
  });

  it('reports "missing" on a network error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useAudioAvailability("/audio/wedding-theme.mp3"));

    await waitFor(() => expect(result.current).toEqual({ status: "missing" }));
  });
});

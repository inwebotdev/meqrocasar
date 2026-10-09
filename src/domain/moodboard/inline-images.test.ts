import { describe, expect, it, vi } from "vitest";

import { inlineImages } from "./inline-images";

const UNSPLASH_URL = "https://images.unsplash.com/photo-123?ixid=abc123";
const TINY_PNG = new Uint8Array([1, 2, 3, 4]);

function okFetch(options?: { contentType?: string; contentLength?: string; body?: Uint8Array }) {
  const body = options?.body ?? TINY_PNG;
  const headers: Record<string, string> = {
    "content-type": options?.contentType ?? "image/png",
  };
  if (options?.contentLength !== undefined) headers["content-length"] = options.contentLength;

  return vi.fn(async () => {
    return new Response(Buffer.from(body), { status: 200, headers });
  }) as unknown as typeof fetch;
}

describe("inlineImages", () => {
  it("appends Unsplash sizing params while preserving existing ones", async () => {
    let capturedUrl = "";
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      capturedUrl = String(url);
      return new Response(Buffer.from(TINY_PNG), {
        status: 200,
        headers: { "content-type": "image/png" },
      });
    }) as unknown as typeof fetch;

    await inlineImages([UNSPLASH_URL], fetchImpl);

    expect(capturedUrl).toContain("w=900");
    expect(capturedUrl).toContain("q=70");
    expect(capturedUrl).toContain("fm=jpg");
    expect(capturedUrl).toContain("fit=crop");
    expect(capturedUrl).toContain("ixid=abc123");
  });

  it("returns a base64 data: URL on success", async () => {
    const fetchImpl = okFetch({ contentType: "image/jpeg" });
    const [result] = await inlineImages([UNSPLASH_URL], fetchImpl);

    expect(result).toBe(`data:image/jpeg;base64,${Buffer.from(TINY_PNG).toString("base64")}`);
  });

  it("returns '' and never calls fetch for a non-Unsplash host", async () => {
    const fetchImpl = okFetch();
    const [result] = await inlineImages(["https://evil.example.com/photo.jpg"], fetchImpl);

    expect(result).toBe("");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns '' when the response status isn't ok", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(Buffer.from(TINY_PNG), { status: 500 }),
    ) as unknown as typeof fetch;
    const [result] = await inlineImages([UNSPLASH_URL], fetchImpl);

    expect(result).toBe("");
  });

  it("returns '' for a disallowed content-type", async () => {
    const fetchImpl = okFetch({ contentType: "text/html" });
    const [result] = await inlineImages([UNSPLASH_URL], fetchImpl);

    expect(result).toBe("");
  });

  it("returns '' when content-length declares an oversized payload", async () => {
    const fetchImpl = okFetch({ contentLength: String(7 * 1024 * 1024) });
    const [result] = await inlineImages([UNSPLASH_URL], fetchImpl);

    expect(result).toBe("");
  });

  it("returns '' on timeout", async () => {
    const fetchImpl = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
    }) as unknown as typeof fetch;

    const [result] = await inlineImages([UNSPLASH_URL], fetchImpl, 10);

    expect(result).toBe("");
  });

  it("resolves all 3 slots in parallel, in order", async () => {
    const fetchImpl = okFetch();
    const results = await inlineImages(
      [UNSPLASH_URL, UNSPLASH_URL.replace("123", "456"), "https://evil.example.com/x.jpg"],
      fetchImpl,
    );

    expect(results).toHaveLength(3);
    expect(results[0]).toMatch(/^data:image\/png;base64,/);
    expect(results[1]).toMatch(/^data:image\/png;base64,/);
    expect(results[2]).toBe("");
  });
});

import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MoodboardParams } from "@/domain/moodboard/params";

import { server } from "../../../../../test/msw/server";

interface FakeImageResponseCall {
  element: { props: { params: unknown; images: unknown } };
  options: { width: number; height: number; fonts: unknown[]; headers?: Record<string, string> };
}

const { calls } = vi.hoisted(() => ({ calls: [] as FakeImageResponseCall[] }));

vi.mock("next/og", () => {
  class FakeImageResponse extends Response {
    constructor(element: unknown, options: Record<string, unknown>) {
      const headers = {
        ...((options.headers as Record<string, string>) ?? {}),
        "content-type": "image/png",
      };
      super(new Uint8Array([1, 2, 3]), { status: 200, headers });
      calls.push({ element, options } as unknown as FakeImageResponseCall);
    }
  }
  return { ImageResponse: FakeImageResponse };
});

const { encodeMoodboardParams } = await import("@/domain/moodboard/params");
const { GET } = await import("./route");

const VALID_PARAMS: MoodboardParams = {
  title: "Atardecer Virreinal entre Patios de Cantera",
  zone: "Ezequiel Montes · Querétaro",
  tagline: "Romance Virreinal con Cata de Vinos",
  palette: [
    { hex: "#68182E", name: "Vino Tinto" },
    { hex: "#D4AF37", name: "Oro Cantera" },
    { hex: "#F5EDE0", name: "Lino Crudo" },
    { hex: "#2F4839", name: "Verde Musgo" },
  ],
  photos: [
    "https://images.unsplash.com/photo-1",
    "https://images.unsplash.com/photo-2",
    "https://images.unsplash.com/photo-3",
  ],
};

const TINY_PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);

function makeRequest(query: string): Request {
  return new Request(`http://localhost/api/og/moodboard?${query}`);
}

function mockUnsplashPngs(): void {
  server.use(
    http.get("https://images.unsplash.com/*", () => {
      return HttpResponse.arrayBuffer(TINY_PNG.buffer as ArrayBuffer, {
        headers: { "content-type": "image/png" },
      });
    }),
  );
}

describe("GET /api/og/moodboard", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("200: returns image/png with the right headers, fonts, and inlined images", async () => {
    mockUnsplashPngs();
    const encoded = encodeMoodboardParams(VALID_PARAMS);

    const response = await GET(makeRequest(`d=${encoded}`));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("content-disposition")).toMatch(/^inline;/);

    const call = calls.at(-1);
    expect(call).toBeDefined();

    const fonts = call?.options.fonts as Array<{ name: string }>;
    expect(fonts).toHaveLength(4);
    expect(fonts.map((f) => f.name)).toEqual(
      expect.arrayContaining(["Playfair Display", "Plus Jakarta Sans"]),
    );

    const images = call?.element.props.images as string[];
    expect(images).toHaveLength(3);
    for (const image of images) {
      expect(image).toMatch(/^data:image\/png;base64,/);
    }

    expect(call?.element.props.params).toMatchObject({ title: VALID_PARAMS.title });
  });

  it("200: sets an attachment Content-Disposition with a slugified filename when download=1", async () => {
    mockUnsplashPngs();
    const encoded = encodeMoodboardParams(VALID_PARAMS);

    const response = await GET(makeRequest(`d=${encoded}&download=1`));

    expect(response.status).toBe(200);
    const disposition = response.headers.get("content-disposition") ?? "";
    expect(disposition).toMatch(/^attachment;/);
    expect(disposition).toContain("atardecer-virreinal-entre-patios-de-cantera");
  });

  it("400: missing 'd' query param", async () => {
    const response = await GET(makeRequest(""));
    expect(response.status).toBe(400);

    const body = (await response.json()) as { ok: false; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("invalid_params");
  });

  it("400: invalid 'd' query param", async () => {
    const response = await GET(makeRequest("d=%%%not-base64%%%"));
    expect(response.status).toBe(400);

    const body = (await response.json()) as { ok: false; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("invalid_params");
  });

  it("200: still renders when an image fetch fails, with '' in that slot", async () => {
    server.use(
      http.get("https://images.unsplash.com/*", () => new HttpResponse(null, { status: 500 })),
    );
    const encoded = encodeMoodboardParams(VALID_PARAMS);

    const response = await GET(makeRequest(`d=${encoded}`));

    expect(response.status).toBe(200);
    const call = calls.at(-1);
    const images = call?.element.props.images as string[];
    expect(images).toEqual(["", "", ""]);
  });

  it("200: resolves a same-origin Places photo proxy path against the request origin", async () => {
    mockUnsplashPngs();
    const TINY_JPEG = new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]);
    let capturedUrl = "";

    server.use(
      http.get("http://localhost/api/places/photo", ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.arrayBuffer(TINY_JPEG.buffer as ArrayBuffer, {
          headers: { "content-type": "image/jpeg" },
        });
      }),
    );

    const params: MoodboardParams = {
      ...VALID_PARAMS,
      photos: [
        "/api/places/photo?name=places%2Fabc%2Fphotos%2Fp1&w=800",
        VALID_PARAMS.photos[1]!,
        VALID_PARAMS.photos[2]!,
      ],
    };
    const encoded = encodeMoodboardParams(params);

    const response = await GET(makeRequest(`d=${encoded}`));

    expect(response.status).toBe(200);
    expect(capturedUrl).toBe(
      "http://localhost/api/places/photo?name=places%2Fabc%2Fphotos%2Fp1&w=800",
    );

    const call = calls.at(-1);
    const images = call?.element.props.images as string[];
    expect(images[0]).toMatch(/^data:image\/jpeg;base64,/);
  });
});

import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockPlacesPhotoMedia } from "../../../../../test/msw/handlers";
import { server } from "../../../../../test/msw/server";

const { getPlacesPhotoDepsMock, markPlacesFailureMock } = vi.hoisted(() => ({
  getPlacesPhotoDepsMock: vi.fn(),
  markPlacesFailureMock: vi.fn(),
}));

vi.mock("@/lib/places-photo-deps", () => ({
  getPlacesPhotoDeps: getPlacesPhotoDepsMock,
}));

// Mocked so these tests never touch the real process-wide singleton
// (which would otherwise accumulate failure state across tests in this
// file); its wiring is covered by `src/domain/places/availability.test.ts`.
vi.mock("@/domain/places/availability", () => ({
  markPlacesFailure: markPlacesFailureMock,
}));

const { GET } = await import("./route");

// A real "places" photo ref from the knowledge base (data/kb/venues.json's
// fixture snapshot), so the "known name" check passes without mocking loadKb.
const KNOWN_NAME = "places/fixture-resort-hacienda-bajio/photos/p1";
const KNOWN_ATTRIBUTION = "Fixture Photographer 1";

function makeRequest(query: string): Request {
  return new Request(`http://localhost/api/places/photo?${query}`);
}

let cacheDir: string;

beforeEach(async () => {
  cacheDir = await mkdtemp(path.join(tmpdir(), "places-photo-test-"));
  getPlacesPhotoDepsMock.mockReset();
  getPlacesPhotoDepsMock.mockReturnValue({ apiKey: "test-places-key", cacheDir });
  markPlacesFailureMock.mockReset();
});

afterEach(async () => {
  await rm(cacheDir, { recursive: true, force: true });
});

describe("GET /api/places/photo", () => {
  it("404s with places_disabled when no API key is configured", async () => {
    getPlacesPhotoDepsMock.mockReturnValue({ apiKey: undefined, cacheDir });

    const response = await GET(makeRequest(`name=${encodeURIComponent(KNOWN_NAME)}&w=800`));
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("places_disabled");
  });

  it("400s on an invalid w", async () => {
    const response = await GET(makeRequest(`name=${encodeURIComponent(KNOWN_NAME)}&w=999`));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("invalid_params");
  });

  it("404s on an unknown photo name", async () => {
    const response = await GET(
      makeRequest(`name=${encodeURIComponent(`places/${randomUUID()}/photos/p1`)}&w=800`),
    );
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("not_found");
  });

  it("fetches, caches, and serves the photo with attribution and cache headers", async () => {
    let calls = 0;
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xaa]);

    server.use(
      mockPlacesPhotoMedia(() => {
        calls += 1;
        return new HttpResponse(bytes, { status: 200, headers: { "content-type": "image/jpeg" } });
      }),
    );

    const first = await GET(makeRequest(`name=${encodeURIComponent(KNOWN_NAME)}&w=800`));
    expect(first.status).toBe(200);
    expect(first.headers.get("content-type")).toBe("image/jpeg");
    expect(first.headers.get("x-attribution")).toBe(KNOWN_ATTRIBUTION);
    expect(first.headers.get("cache-control")).toBe("public, max-age=86400, s-maxage=2592000");
    expect(new Uint8Array(await first.arrayBuffer())).toEqual(bytes);
    expect(calls).toBe(1);

    // Second call for the same name+w must be served from disk, no network.
    const second = await GET(makeRequest(`name=${encodeURIComponent(KNOWN_NAME)}&w=800`));
    expect(second.status).toBe(200);
    expect(new Uint8Array(await second.arrayBuffer())).toEqual(bytes);
    expect(calls).toBe(1);
  });

  it("fetches again for a different width (different cache key)", async () => {
    let calls = 0;

    server.use(
      mockPlacesPhotoMedia(() => {
        calls += 1;
        return new HttpResponse(new Uint8Array([1]), {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        });
      }),
    );

    await GET(makeRequest(`name=${encodeURIComponent(KNOWN_NAME)}&w=400`));
    await GET(makeRequest(`name=${encodeURIComponent(KNOWN_NAME)}&w=1200`));

    expect(calls).toBe(2);
  });

  it("redirects (302) to a fallback photo instead of 500ing when the upstream fetch fails", async () => {
    server.use(mockPlacesPhotoMedia(() => HttpResponse.text("nope", { status: 500 })));

    const response = await GET(makeRequest(`name=${encodeURIComponent(KNOWN_NAME)}&w=800`));
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("images.unsplash.com");
    expect(markPlacesFailureMock).toHaveBeenCalledWith({ httpStatus: 500, code: undefined });
  });

  it("redirects (302) and marks the failure with the parsed SERVICE_DISABLED code on a 403", async () => {
    server.use(
      mockPlacesPhotoMedia(() =>
        HttpResponse.json(
          {
            error: {
              code: 403,
              message: "Places API has not been used in project ... or it is disabled.",
              status: "SERVICE_DISABLED",
            },
          },
          { status: 403 },
        ),
      ),
    );

    const response = await GET(makeRequest(`name=${encodeURIComponent(KNOWN_NAME)}&w=800`));

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("images.unsplash.com");
    expect(markPlacesFailureMock).toHaveBeenCalledWith({
      httpStatus: 403,
      code: "SERVICE_DISABLED",
    });
  });
});

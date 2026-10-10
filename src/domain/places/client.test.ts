import { delay, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { mockPlacesPhotoMedia, mockPlacesSearchText } from "../../../test/msw/handlers";
import { server } from "../../../test/msw/server";
import { createPlacesClient } from "./client";
import { PlacesApiError } from "./types";

const API_KEY = "test-places-key";

function baseRequest() {
  return {
    textQuery: "hacienda para bodas",
    locationBias: {
      circle: { center: { latitude: 20.5888, longitude: -100.3899 }, radius: 25000 },
    },
  };
}

function placeFixture(id: string) {
  return {
    id,
    displayName: { text: `Hacienda ${id}`, languageCode: "es" },
    formattedAddress: "Carretera a Bernal km 3, Ezequiel Montes, Qro.",
    location: { latitude: 20.69, longitude: -99.9 },
    rating: 4.6,
    userRatingCount: 312,
    websiteUri: "https://example.com",
    googleMapsUri: "https://maps.google.com/?cid=1",
    editorialSummary: { text: "Un viñedo histórico." },
    primaryType: "wedding_venue",
    types: ["wedding_venue", "event_venue"],
    priceLevel: "PRICE_LEVEL_MODERATE",
    photos: [
      {
        name: `places/${id}/photos/p1`,
        widthPx: 4000,
        heightPx: 3000,
        authorAttributions: [{ displayName: "Jane Doe", uri: "https://example.com/jane" }],
      },
    ],
    reviews: [
      {
        rating: 5,
        text: { text: "Hermoso lugar para una boda." },
        relativePublishTimeDescription: "hace un mes",
      },
    ],
  };
}

describe("createPlacesClient.searchText", () => {
  it("sends the expected method, headers, body and field mask", async () => {
    server.use(
      mockPlacesSearchText(({ request, body }) => {
        expect(request.method).toBe("POST");
        expect(request.headers.get("content-type")).toBe("application/json");
        expect(request.headers.get("x-goog-api-key")).toBe(API_KEY);
        expect(request.headers.get("x-goog-fieldmask")).toBe(
          "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.websiteUri,places.googleMapsUri,places.editorialSummary,places.primaryType,places.types,places.priceLevel,places.photos,places.reviews,nextPageToken",
        );
        expect(body).toMatchObject({
          textQuery: "hacienda para bodas",
          languageCode: "es-MX",
          regionCode: "MX",
          pageSize: 20,
        });
        expect(body.pageToken).toBeUndefined();

        return HttpResponse.json({ places: [placeFixture("a1")] });
      }),
    );

    const client = createPlacesClient({ apiKey: API_KEY });
    const result = await client.searchText(baseRequest());

    expect(result.places).toHaveLength(1);
    expect(result.places[0]?.id).toBe("a1");
    expect(result.places[0]?.photos?.[0]?.name).toBe("places/a1/photos/p1");
    expect(result.nextPageToken).toBeUndefined();
  });

  it("pages through results using nextPageToken", async () => {
    server.use(
      mockPlacesSearchText(({ body, callIndex }) => {
        if (callIndex === 1) {
          expect(body.pageToken).toBeUndefined();
          return HttpResponse.json({
            places: [placeFixture("page1-a")],
            nextPageToken: "token-2",
          });
        }

        expect(callIndex).toBe(2);
        expect(body.pageToken).toBe("token-2");
        return HttpResponse.json({ places: [placeFixture("page2-a")] });
      }),
    );

    const client = createPlacesClient({ apiKey: API_KEY });
    const first = await client.searchText(baseRequest());
    expect(first.nextPageToken).toBe("token-2");

    const second = await client.searchText({ ...baseRequest(), pageToken: first.nextPageToken });
    expect(second.places.map((place) => place.id)).toEqual(["page2-a"]);
    expect(second.nextPageToken).toBeUndefined();
  });

  it("throws a typed PlacesApiError on a non-2xx response", async () => {
    server.use(
      mockPlacesSearchText(() =>
        HttpResponse.json(
          { error: { code: 403, message: "This API key is not authorized to use this service." } },
          { status: 403 },
        ),
      ),
    );

    const client = createPlacesClient({ apiKey: API_KEY });

    await expect(client.searchText(baseRequest())).rejects.toMatchObject({
      status: 403,
    });

    try {
      await client.searchText(baseRequest());
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(PlacesApiError);
    }
  });

  it("throws a PlacesApiError on timeout", async () => {
    server.use(
      mockPlacesSearchText(async () => {
        await delay(300);
        return HttpResponse.json({ places: [placeFixture("slow")] });
      }),
    );

    const client = createPlacesClient({ apiKey: API_KEY, timeoutMs: 20 });

    await expect(client.searchText(baseRequest())).rejects.toMatchObject({ status: 0 });
  });
});

describe("createPlacesClient.photoMediaUrl", () => {
  it("builds the media URL with the key and maxWidthPx", () => {
    const client = createPlacesClient({ apiKey: API_KEY });
    const url = client.photoMediaUrl("places/a1/photos/p1", { maxWidthPx: 1200 });

    expect(url).toBe(
      `https://places.googleapis.com/v1/places/a1/photos/p1/media?maxWidthPx=1200&key=${API_KEY}`,
    );
  });

  it("defaults maxWidthPx to 800", () => {
    const client = createPlacesClient({ apiKey: API_KEY });
    const url = client.photoMediaUrl("places/a1/photos/p1");

    expect(url).toContain("maxWidthPx=800");
  });
});

describe("createPlacesClient.fetchPhoto", () => {
  it("follows Google's redirect and returns bytes + content type", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);

    server.use(
      mockPlacesPhotoMedia(({ request }) => {
        expect(request.url).toContain("maxWidthPx=800");
        expect(request.url).toContain(`key=${API_KEY}`);
        return new HttpResponse(bytes, {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        });
      }),
    );

    const client = createPlacesClient({ apiKey: API_KEY });
    const photo = await client.fetchPhoto("places/a1/photos/p1");

    expect(photo.contentType).toBe("image/jpeg");
    expect(Array.from(photo.bytes)).toEqual([1, 2, 3, 4]);
  });

  it("throws a typed PlacesApiError on a non-2xx photo response", async () => {
    server.use(mockPlacesPhotoMedia(() => HttpResponse.text("not found", { status: 404 })));

    const client = createPlacesClient({ apiKey: API_KEY });

    await expect(client.fetchPhoto("places/a1/photos/missing")).rejects.toMatchObject({
      status: 404,
    });
  });
});

import { HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { createPlacesClient } from "../../src/domain/places";
import type { Place } from "../../src/domain/places";
import { mockPlacesSearchText } from "../../test/msw/handlers";
import { server } from "../../test/msw/server";
import {
  ALLOWED_PLACE_TYPES,
  buildQueryPlan,
  dedupePlaces,
  filterPlaces,
  formatSummaryTable,
  hasAllowedType,
  INGEST_CATEGORIES,
  isNoisyPlace,
  keepPlace,
  runIngest,
  sortPlacesByRatingCount,
  summarizeByZone,
} from "./ingest-lib";

function place(overrides: Partial<Place> & { id: string }): Place {
  return {
    displayName: { text: `Place ${overrides.id}` },
    userRatingCount: 50,
    types: ["wedding_venue"],
    ...overrides,
  };
}

describe("buildQueryPlan", () => {
  it("builds zones.length * categories.length queries", () => {
    const zones = [
      { id: "ezequiel_montes", center: { lat: 20.6964, lng: -99.8982 }, radiusMeters: 20000 },
      { id: "bernal", center: { lat: 20.75, lng: -99.9474 }, radiusMeters: 10000 },
    ];

    const plan = buildQueryPlan(zones);

    expect(plan).toHaveLength(zones.length * INGEST_CATEGORIES.length);
    expect(plan[0]?.locationBias.circle.radius).toBe(20000);
    expect(plan[0]?.locationBias.circle.center).toEqual({ latitude: 20.6964, longitude: -99.8982 });
  });

  it("respects a custom category list", () => {
    const zones = [{ id: "bernal", center: { lat: 20.75, lng: -99.9474 }, radiusMeters: 10000 }];
    const plan = buildQueryPlan(zones, ["hacienda para bodas"]);
    expect(plan).toHaveLength(1);
    expect(plan[0]?.category).toBe("hacienda para bodas");
  });
});

describe("hasAllowedType / isNoisyPlace / keepPlace", () => {
  it("accepts a venue with an allowed type", () => {
    expect(hasAllowedType(place({ id: "a", types: ["winery"] }))).toBe(true);
  });

  it("rejects a place with no allowed type", () => {
    expect(hasAllowedType(place({ id: "b", types: ["point_of_interest"] }))).toBe(false);
  });

  it("flags stores, schools and car businesses as noise", () => {
    expect(isNoisyPlace(place({ id: "c", types: ["store", "hotel"] }))).toBe(true);
    expect(isNoisyPlace(place({ id: "d", types: ["school"] }))).toBe(true);
    expect(isNoisyPlace(place({ id: "e", types: ["car_repair", "restaurant"] }))).toBe(true);
  });

  it("flags a church with no event-capable type as noise, but not one that also hosts events", () => {
    expect(isNoisyPlace(place({ id: "f", types: ["church", "historical_landmark"] }))).toBe(true);
    expect(isNoisyPlace(place({ id: "g", types: ["church", "wedding_venue"] }))).toBe(false);
  });

  it("keepPlace requires the rating threshold, an allowed type and no noise", () => {
    expect(keepPlace(place({ id: "h", userRatingCount: 5, types: ["winery"] }))).toBe(false);
    expect(keepPlace(place({ id: "i", userRatingCount: 50, types: ["store"] }))).toBe(false);
    expect(keepPlace(place({ id: "j", userRatingCount: 50, types: ["winery"] }))).toBe(true);
    expect(keepPlace(place({ id: "k", userRatingCount: 20, types: ["winery"] }))).toBe(true);
  });

  it("every ALLOWED_PLACE_TYPES entry is a non-empty snake_case string", () => {
    for (const type of ALLOWED_PLACE_TYPES) {
      expect(type).toMatch(/^[a-z_]+$/);
    }
  });
});

describe("filterPlaces / dedupePlaces / sortPlacesByRatingCount", () => {
  it("filterPlaces keeps only places passing keepPlace", () => {
    const places = [
      place({ id: "ok", userRatingCount: 30, types: ["winery"] }),
      place({ id: "low-rating", userRatingCount: 5, types: ["winery"] }),
      place({ id: "noise", userRatingCount: 30, types: ["store"] }),
    ];
    expect(filterPlaces(places).map((p) => p.id)).toEqual(["ok"]);
  });

  it("dedupePlaces keeps the first occurrence per id", () => {
    const first = place({ id: "dup", userRatingCount: 10 });
    const second = place({ id: "dup", userRatingCount: 999 });
    const other = place({ id: "other" });

    const result = dedupePlaces([first, second, other]);

    expect(result).toHaveLength(2);
    expect(result.find((p) => p.id === "dup")?.userRatingCount).toBe(10);
  });

  it("sortPlacesByRatingCount sorts descending, treating missing counts as 0", () => {
    const places = [
      place({ id: "mid", userRatingCount: 50 }),
      place({ id: "high", userRatingCount: 500 }),
      place({ id: "none", userRatingCount: undefined }),
      place({ id: "low", userRatingCount: 10 }),
    ];

    expect(sortPlacesByRatingCount(places).map((p) => p.id)).toEqual([
      "high",
      "mid",
      "low",
      "none",
    ]);
  });
});

describe("summarizeByZone / formatSummaryTable", () => {
  it("counts kept places per zone, defaulting to 0 for zones with none", () => {
    const placesByZone = new Map([
      ["bernal", [place({ id: "b1" }), place({ id: "b2" })]],
      ["cadereyta", []],
    ]);

    const rows = summarizeByZone(["bernal", "cadereyta", "colon"], placesByZone);

    expect(rows).toEqual([
      { zoneId: "bernal", count: 2 },
      { zoneId: "cadereyta", count: 0 },
      { zoneId: "colon", count: 0 },
    ]);
  });

  it("formats a readable table with a total row", () => {
    const table = formatSummaryTable([
      { zoneId: "bernal", count: 12 },
      { zoneId: "colon", count: 3 },
    ]);

    expect(table).toContain("bernal");
    expect(table).toContain("12");
    expect(table).toContain("Total");
    expect(table).toContain("15");
  });
});

describe("runIngest (end-to-end dry run over MSW)", () => {
  const zones = [
    { id: "ezequiel_montes", center: { lat: 20.6964, lng: -99.8982 }, radiusMeters: 20000 },
    { id: "bernal", center: { lat: 20.75, lng: -99.9474 }, radiusMeters: 10000 },
  ];

  function placeResponse(id: string, overrides: Partial<Place> = {}) {
    return place({ id, userRatingCount: 40, types: ["winery"], ...overrides });
  }

  it("queries every zone × category once (within the 1-category plan) and aggregates results", async () => {
    let calls = 0;

    server.use(
      mockPlacesSearchText(({ body }) => {
        calls += 1;
        const query = body.textQuery as string;
        const id = query.includes("ezequiel") ? "em-venue" : "bn-venue";
        return HttpResponse.json({ places: [placeResponse(id)] });
      }),
    );

    const client = createPlacesClient({ apiKey: "test-key" });
    const result = await runIngest(client, {
      zones,
      categories: ["hacienda para bodas"],
      rateLimitMs: 0,
      sleep: async () => {},
    });

    expect(calls).toBe(2); // 2 zones * 1 category, 1 page each (no nextPageToken)
    expect(result.queries).toBe(2);
    expect(result.places.map((p) => p.id).sort()).toEqual(["bn-venue", "em-venue"]);
    expect(result.summary).toEqual([
      { zoneId: "ezequiel_montes", count: 1 },
      { zoneId: "bernal", count: 1 },
    ]);
    expect(new Date(result.fetchedAt).toString()).not.toBe("Invalid Date");
  });

  it("dedupes places returned by more than one zone/category and filters out noise", async () => {
    server.use(
      mockPlacesSearchText(() =>
        HttpResponse.json({
          places: [
            placeResponse("shared-venue"),
            place({ id: "too-new", userRatingCount: 3, types: ["winery"] }),
            place({ id: "a-store", userRatingCount: 100, types: ["store"] }),
          ],
        }),
      ),
    );

    const client = createPlacesClient({ apiKey: "test-key" });
    const result = await runIngest(client, {
      zones,
      categories: ["hacienda para bodas"],
      rateLimitMs: 0,
      sleep: async () => {},
    });

    expect(result.places.map((p) => p.id)).toEqual(["shared-venue"]);
  });

  it("follows pagination up to maxPagesPerQuery", async () => {
    let callIndex = 0;

    server.use(
      mockPlacesSearchText(() => {
        callIndex += 1;
        if (callIndex === 1) {
          return HttpResponse.json({
            places: [placeResponse("page1")],
            nextPageToken: "tok",
          });
        }
        return HttpResponse.json({ places: [placeResponse("page2")] });
      }),
    );

    const client = createPlacesClient({ apiKey: "test-key" });
    const result = await runIngest(client, {
      zones: [zones[0]!],
      categories: ["hacienda para bodas"],
      maxPagesPerQuery: 2,
      rateLimitMs: 0,
      sleep: async () => {},
    });

    expect(result.queries).toBe(2);
    expect(result.places.map((p) => p.id).sort()).toEqual(["page1", "page2"]);
  });

  it("retries once on a 429 and then succeeds", async () => {
    let attempts = 0;
    const sleeps: number[] = [];

    server.use(
      mockPlacesSearchText(() => {
        attempts += 1;
        if (attempts === 1) {
          return HttpResponse.json({ error: { message: "rate limited" } }, { status: 429 });
        }
        return HttpResponse.json({ places: [placeResponse("retried")] });
      }),
    );

    const client = createPlacesClient({ apiKey: "test-key" });
    const result = await runIngest(client, {
      zones: [zones[0]!],
      categories: ["hacienda para bodas"],
      rateLimitMs: 0,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });

    expect(attempts).toBe(2);
    expect(result.places.map((p) => p.id)).toEqual(["retried"]);
    expect(sleeps.length).toBeGreaterThan(0);
  });
});

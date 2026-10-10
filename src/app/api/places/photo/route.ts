import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ApiResponse } from "@/domain/api/envelope";
import { loadKb } from "@/domain/kb/load";
import { createPlacesClient, PLACES_PHOTO_WIDTHS, type PlacesPhotoWidth } from "@/domain/places";
import { getPlacesPhotoDeps } from "@/lib/places-photo-deps";

/**
 * `GET /api/places/photo?name=<places photo resource name>&w=<400|800|1200>`
 *
 * Proxies a Google Places (New) photo: `name` must belong to a `"places"`
 * photo on a known KB venue (never an arbitrary, attacker-supplied
 * resource name), the bytes are cached on disk for 30 days, and the
 * response carries the photographer's attribution.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const CANDIDATE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];

function jsonError(body: ApiResponse<never>, status: number): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function isPlacesPhotoWidth(value: number): value is PlacesPhotoWidth {
  return (PLACES_PHOTO_WIDTHS as readonly number[]).includes(value);
}

function cacheKeyFor(name: string, w: PlacesPhotoWidth): string {
  return createHash("sha1").update(`${name}:${w}`).digest("hex");
}

interface CachedPhoto {
  bytes: Buffer;
  contentType: string;
}

async function readFromCache(cacheDir: string, key: string): Promise<CachedPhoto | undefined> {
  for (const ext of CANDIDATE_EXTENSIONS) {
    const filePath = path.join(cacheDir, `${key}.${ext}`);

    try {
      const info = await stat(filePath);
      if (Date.now() - info.mtimeMs > CACHE_TTL_MS) {
        continue;
      }

      const bytes = await readFile(filePath);
      return { bytes, contentType: EXT_TO_MIME[ext] ?? "image/jpeg" };
    } catch {
      continue;
    }
  }

  return undefined;
}

async function writeToCache(
  cacheDir: string,
  key: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<void> {
  const ext = MIME_TO_EXT[contentType] ?? "jpg";
  await mkdir(cacheDir, { recursive: true });
  await writeFile(path.join(cacheDir, `${key}.${ext}`), bytes);
}

function imageResponse(bytes: Uint8Array, contentType: string, attribution?: string): Response {
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=86400, s-maxage=2592000",
  };

  if (attribution) {
    headers["X-Attribution"] = attribution;
  }

  return new Response(bytes as BodyInit, { status: 200, headers });
}

function findKnownPhotoAttribution(name: string): string | undefined {
  const { venues } = loadKb();

  for (const venue of venues) {
    for (const photo of venue.photos) {
      if (photo.kind === "places" && photo.ref === name) {
        return photo.attribution;
      }
    }
  }

  return undefined;
}

function isKnownPlacesPhotoName(name: string): boolean {
  const { venues } = loadKb();
  return venues.some((venue) =>
    venue.photos.some((photo) => photo.kind === "places" && photo.ref === name),
  );
}

export async function GET(request: Request): Promise<Response> {
  const deps = getPlacesPhotoDeps();

  if (!deps.apiKey) {
    return jsonError(
      {
        ok: false,
        error: {
          code: "places_disabled",
          message: "Places photos are disabled (no API key configured).",
        },
      },
      404,
    );
  }

  const url = new URL(request.url);
  const name = url.searchParams.get("name");
  const wRaw = url.searchParams.get("w");
  const w = wRaw === null ? NaN : Number(wRaw);

  if (!name || wRaw === null || !Number.isInteger(w) || !isPlacesPhotoWidth(w)) {
    return jsonError(
      {
        ok: false,
        error: {
          code: "invalid_params",
          message:
            "Expected 'name' (a Places photo resource name) and 'w' (one of 400, 800, 1200).",
        },
      },
      400,
    );
  }

  if (!isKnownPlacesPhotoName(name)) {
    return jsonError(
      { ok: false, error: { code: "not_found", message: "Unknown Places photo name." } },
      404,
    );
  }

  const attribution = findKnownPhotoAttribution(name);
  const cacheDir = path.resolve(deps.cacheDir);
  const key = cacheKeyFor(name, w);

  const cached = await readFromCache(cacheDir, key);
  if (cached) {
    return imageResponse(cached.bytes, cached.contentType, attribution);
  }

  try {
    const client = createPlacesClient({ apiKey: deps.apiKey });
    const photo = await client.fetchPhoto(name, w);
    await writeToCache(cacheDir, key, photo.bytes, photo.contentType);
    return imageResponse(photo.bytes, photo.contentType, attribution);
  } catch (error) {
    console.error("[api/places/photo] fetch failed", error);
    return jsonError(
      { ok: false, error: { code: "internal", message: "Failed to fetch the photo." } },
      500,
    );
  }
}

import { readFile, stat } from "node:fs/promises";

import type { ApiResponse } from "@/domain/api/envelope";
import { getNarrationDeps } from "@/lib/narration-deps";

/**
 * `GET /api/narration/[hash]`
 *
 * Serves a cached narration mp3 by its content-addressed hash (see
 * `narrationHash`/`createNarrationStore`), with simple `Range` support so
 * `<audio>`/Remotion's player can seek, and a long, immutable cache
 * header (the hash already encodes the voice/model/script, so the bytes
 * at a given hash never change).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const HASH_PATTERN = /^[0-9a-f]{64}$/;

function jsonError(body: ApiResponse<never>, status: number): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

interface ByteRange {
  start: number;
  end: number;
}

/** Parses a single `bytes=start-end` range (the only form `<audio>`/Remotion ever send); anything else is ignored (served as a full 200). */
function parseRange(rangeHeader: string | null, size: number): ByteRange | undefined {
  if (!rangeHeader) {
    return undefined;
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) {
    return undefined;
  }

  const [, startRaw, endRaw] = match;
  if (!startRaw && !endRaw) {
    return undefined;
  }

  const start = startRaw ? Number(startRaw) : 0;
  const end = endRaw ? Number(endRaw) : size - 1;

  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end >= size ||
    start > end
  ) {
    return undefined;
  }

  return { start, end };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ hash: string }> },
): Promise<Response> {
  const { hash } = await params;

  if (!HASH_PATTERN.test(hash)) {
    return jsonError(
      { ok: false, error: { code: "invalid_params", message: "Expected a 64-char hex hash." } },
      400,
    );
  }

  const { store } = getNarrationDeps();
  const entry = await store.get(hash);

  if (!entry) {
    return jsonError(
      { ok: false, error: { code: "not_found", message: "Narration not found." } },
      404,
    );
  }

  if (entry.audioUrl) {
    // Blob URLs are public and support range requests natively.
    return new Response(null, {
      status: 302,
      headers: {
        Location: entry.audioUrl,
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  if (!entry.audioPath) {
    return jsonError(
      { ok: false, error: { code: "not_found", message: "Narration not found." } },
      404,
    );
  }

  const stats = await stat(entry.audioPath);
  const range = parseRange(request.headers.get("range"), stats.size);
  const buffer = await readFile(entry.audioPath);

  const headers: Record<string, string> = {
    "Content-Type": "audio/mpeg",
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000, immutable",
  };

  if (range) {
    const chunk = buffer.subarray(range.start, range.end + 1);
    headers["Content-Range"] = `bytes ${range.start}-${range.end}/${stats.size}`;
    headers["Content-Length"] = String(chunk.length);
    return new Response(chunk as BodyInit, { status: 206, headers });
  }

  headers["Content-Length"] = String(buffer.length);
  return new Response(buffer as BodyInit, { status: 200, headers });
}

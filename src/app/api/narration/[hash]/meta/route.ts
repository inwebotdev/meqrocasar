import type { ApiResponse } from "@/domain/api/envelope";
import type { NarrationMetaData } from "@/domain/audio/store";
import { getNarrationDeps } from "@/lib/narration-deps";

/**
 * `GET /api/narration/[hash]/meta`
 *
 * Lets the client (`useNarration`) poll a narration's status without
 * downloading the mp3: `"ready"` carries `durationSec`/`sentences` for
 * synced captions, `"pending"` means synthesis is still running in the
 * background, `"missing"` means the hash was never requested (or its
 * synthesis failed).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HASH_PATTERN = /^[0-9a-f]{64}$/;

function jsonResponse<T>(body: ApiResponse<T>, status: number): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ hash: string }> },
): Promise<Response> {
  const { hash } = await params;

  if (!HASH_PATTERN.test(hash)) {
    return jsonResponse(
      { ok: false, error: { code: "invalid_params", message: "Expected a 64-char hex hash." } },
      400,
    );
  }

  const { store } = getNarrationDeps();
  const status = await store.status(hash);

  if (status === "ready") {
    const entry = await store.get(hash);
    if (entry) {
      const data: NarrationMetaData = {
        status: "ready",
        durationSec: entry.meta.durationSec,
        sentences: entry.meta.sentences,
      };
      return jsonResponse({ ok: true, data }, 200);
    }
  }

  return jsonResponse({ ok: true, data: { status } }, 200);
}

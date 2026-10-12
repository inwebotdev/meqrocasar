import { ImageResponse } from "next/og";

import type { ApiResponse } from "@/domain/api/envelope";
import { loadMoodboardFonts } from "@/domain/moodboard/fonts";
import { inlineImages } from "@/domain/moodboard/inline-images";
import { decodeMoodboardParams, slugify } from "@/domain/moodboard/params";
import { MoodboardTemplate } from "@/domain/moodboard/Template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WIDTH = 1200;
const HEIGHT = 630;

function jsonError(body: ApiResponse<never>, status: number): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const encoded = url.searchParams.get("d");

  if (!encoded) {
    return jsonError(
      {
        ok: false,
        error: { code: "invalid_params", message: "Missing required 'd' query param." },
      },
      400,
    );
  }

  const decoded = decodeMoodboardParams(encoded);
  if (!decoded.ok) {
    return jsonError(
      {
        ok: false,
        error: {
          code: "invalid_params",
          message: `Invalid moodboard params (${decoded.reason}).`,
          issues: decoded.detail,
        },
      },
      400,
    );
  }

  const params = decoded.value;
  const download = url.searchParams.get("download") === "1";

  try {
    const [fonts, images] = await Promise.all([
      loadMoodboardFonts(),
      inlineImages(params.photos, request.url),
    ]);

    const [first, second, third] = images;

    return new ImageResponse(
      <MoodboardTemplate params={params} images={[first ?? "", second ?? "", third ?? ""]} />,
      {
        width: WIDTH,
        height: HEIGHT,
        fonts,
        headers: {
          "Cache-Control": "public, max-age=3600, s-maxage=86400",
          "Content-Disposition": `${download ? "attachment" : "inline"}; filename="moodboard-${slugify(params.title)}.png"`,
        },
      },
    );
  } catch (error) {
    console.error("[api/og/moodboard] render failed", error);
    return jsonError(
      {
        ok: false,
        error: { code: "render_failed", message: "Failed to render the moodboard image." },
      },
      500,
    );
  }
}

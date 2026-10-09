import { isUnsplashUrl } from "@/domain/images/allowlist";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 6 * 1024 * 1024; // 6 MB

/** Appends (or overrides) Unsplash sizing params, preserving every other query param. */
function withSizingParams(url: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set("w", "900");
  parsed.searchParams.set("q", "70");
  parsed.searchParams.set("fm", "jpg");
  parsed.searchParams.set("fit", "crop");
  return parsed.toString();
}

function normalizeMime(contentType: string | null): string {
  return (contentType ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
}

async function inlineOne(url: string, fetchImpl: typeof fetch, timeoutMs: number): Promise<string> {
  if (!isUnsplashUrl(url)) return "";

  let sizedUrl: string;
  try {
    sizedUrl = withSizingParams(url);
  } catch {
    return "";
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(sizedUrl, { signal: controller.signal });
    if (!response.ok) return "";

    const mime = normalizeMime(response.headers.get("content-type"));
    if (!ALLOWED_MIME_TYPES.has(mime)) return "";

    const declaredLength = response.headers.get("content-length");
    if (declaredLength !== null && Number(declaredLength) > MAX_BYTES) return "";

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES) return "";

    const base64 = Buffer.from(buffer).toString("base64");
    return `data:${mime};base64,${base64}`;
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetches `urls` (in parallel) and inlines each as a base64 `data:` URL, so
 * Satori never needs to fetch images itself. Any failure for a given URL —
 * a non-Unsplash host, a timeout, a bad status, a disallowed/oversized
 * payload — resolves that slot to `""` rather than rejecting, so one bad
 * photo never fails the whole render.
 */
export function inlineImages(
  urls: string[],
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 4000,
): Promise<string[]> {
  return Promise.all(urls.map((url) => inlineOne(url, fetchImpl, timeoutMs)));
}

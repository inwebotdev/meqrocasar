/**
 * Hostnames allowed for externally-sourced experience photos. Used to
 * validate `photo.url` wherever it is embedded into another resource (e.g.
 * the `/api/og/moodboard` route's `<img src>` params) so we never proxy or
 * render an arbitrary, attacker-controlled URL.
 */
export const UNSPLASH_HOSTNAME_ALLOWLIST: readonly string[] = ["images.unsplash.com"];

/**
 * True when `url` is a well-formed URL whose hostname is on the Unsplash
 * allowlist. Never throws, even for a malformed `url`.
 */
export function isUnsplashUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return UNSPLASH_HOSTNAME_ALLOWLIST.includes(parsed.hostname);
  } catch {
    return false;
  }
}

/** The same-origin path prefix the Places photo proxy serves from (`src/domain/places/photo-url.ts`). */
export const PLACES_PHOTO_PATH_PREFIX = "/api/places/photo";

/**
 * True for a same-origin, relative Places photo proxy path
 * (`/api/places/photo` or `/api/places/photo?...`, as built by
 * `placesPhotoPath`). Never throws.
 */
export function isPlacesPhotoPath(url: string): boolean {
  if (!url.startsWith(PLACES_PHOTO_PATH_PREFIX)) return false;
  const rest = url.slice(PLACES_PHOTO_PATH_PREFIX.length);
  return rest === "" || rest.startsWith("?");
}

/**
 * True for an Unsplash URL (see `isUnsplashUrl`) or a same-origin Places
 * photo proxy path (`isPlacesPhotoPath`). Used wherever an externally- or
 * proxy-sourced photo reference is embedded into another resource (e.g.
 * moodboard params), so we never render an arbitrary, attacker-controlled
 * URL. Never throws.
 */
export function isAllowedImageUrl(url: string): boolean {
  return isPlacesPhotoPath(url) || isUnsplashUrl(url);
}

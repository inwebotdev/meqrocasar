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

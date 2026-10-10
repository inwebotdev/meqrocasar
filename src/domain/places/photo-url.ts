/** The widths the photo proxy route accepts (`src/app/api/places/photo/route.ts`). */
export const PLACES_PHOTO_WIDTHS = [400, 800, 1200] as const;

export type PlacesPhotoWidth = (typeof PLACES_PHOTO_WIDTHS)[number];

/**
 * Builds the same-origin proxy path for a Places photo resource name
 * (`places/{placeId}/photos/{photoId}`), for use in `<img src>` and the
 * moodboard params. Never calls Google directly from the browser.
 */
export function placesPhotoPath(name: string, w: PlacesPhotoWidth): string {
  const query = new URLSearchParams({ name, w: String(w) });
  return `/api/places/photo?${query.toString()}`;
}

import type { ExperiencePhoto } from "@/domain/experience/types";
import { getPhoto, type PhotoId } from "@/domain/media/photos";
import { photoForVenueFacets } from "@/domain/media/photos-for-answers";
import type { KbVenue } from "@/domain/kb/types";

/**
 * Picks a fallback photo for `venue` when its `"places"` photo can't be
 * served right now (Places unusable, or the upstream fetch itself
 * failed): the venue's own registry/url photo when it has one, otherwise
 * a registry photo matched to the venue's facets. Always returns a
 * photo — used by the photo proxy route to 302-redirect a broken Places
 * link to something that renders, rather than 500ing.
 */
export function fallbackPhotoForVenue(venue: KbVenue): ExperiencePhoto {
  const registryPhoto = venue.photos.find((photo) => photo.kind === "registry");
  if (registryPhoto) {
    const photo = getPhoto(registryPhoto.ref as PhotoId);
    return { url: photo.url, alt: venue.name, credit: registryPhoto.attribution ?? photo.credit };
  }

  const urlPhoto = venue.photos.find((photo) => photo.kind === "url");
  if (urlPhoto) {
    return { url: urlPhoto.ref, alt: venue.name, credit: urlPhoto.attribution ?? venue.name };
  }

  const { url, credit } = photoForVenueFacets(venue.facets);
  return { url, alt: venue.name, credit };
}

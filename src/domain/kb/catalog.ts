import { getPhoto, type PhotoId } from "@/domain/media/photos";
import { placesPhotoPath } from "@/domain/places/photo-url";

import { facetLabel, type ZoneValue } from "./taxonomy";
import type { Kb, KbPhoto, KbVenue } from "./types";

/**
 * Serialisable projection of a `KbVenue` for `/recintos` (`CatalogScreen`):
 * the same shape `VenueCard` already renders for a quiz-result
 * `ExperienceVenue` (rating, address, website/maps links, a real photo),
 * minus the quiz-specific `role`/`reason` (there's no "why this venue"
 * narrative outside a generated experience) — see `VenueCardVenue`.
 *
 * Pure TypeScript: no React, no Next.js, no `server-only`. `/recintos`'s
 * server component builds this from `loadKb()` and passes it straight to
 * the (client) `CatalogScreen`.
 */
export interface KbCatalogVenue {
  id: string;
  name: string;
  zoneId: ZoneValue;
  /** es-MX display label, e.g. "Bernal" — see `facetLabel("zone", ...)`. */
  zone: string;
  municipality: string;
  subtitle: string;
  capacity: number;
  capacityApprox: true;
  features: readonly [string, string, string];
  priceCategory: "Medio" | "Medio-Alto" | "Exclusivo";
  aliases: readonly string[];
  website?: string;
  rating?: number;
  userRatingCount?: number;
  address?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  photoUrl?: string;
  photoAttribution?: string;
  /** Hand-curated venues are listed before places-sourced ones — see `buildCatalogVenues`. */
  curated: boolean;
}

export interface KbCatalogZone {
  id: ZoneValue;
  label: string;
}

interface ResolvedCatalogPhoto {
  url?: string;
  attribution?: string;
}

/** Prefers a real Places photo, then an explicit URL, then the local registry — same preference order as the quiz engine's `findPlacesPhoto`. */
function resolveCatalogPhoto(photos: readonly KbPhoto[]): ResolvedCatalogPhoto {
  const places = photos.find((photo) => photo.kind === "places");
  if (places) {
    return { url: placesPhotoPath(places.ref, 800), attribution: places.attribution };
  }

  const url = photos.find((photo) => photo.kind === "url");
  if (url) {
    return { url: url.ref, attribution: url.attribution };
  }

  const registry = photos.find((photo) => photo.kind === "registry");
  if (registry) {
    const photo = getPhoto(registry.ref as PhotoId);
    return { url: photo.url, attribution: registry.attribution ?? photo.credit };
  }

  return {};
}

function toCatalogVenue(venue: KbVenue): KbCatalogVenue {
  const photo = resolveCatalogPhoto(venue.photos);

  return {
    id: venue.id,
    name: venue.name,
    zoneId: venue.zone,
    zone: facetLabel("zone", venue.zone),
    municipality: venue.municipality,
    subtitle: venue.oneLiner,
    capacity: venue.capacityEstimate,
    capacityApprox: true,
    features: venue.highlights,
    priceCategory: facetLabel("budget", venue.facets.budget) as KbCatalogVenue["priceCategory"],
    aliases: venue.aliases,
    website: venue.websiteUri,
    rating: venue.rating,
    userRatingCount: venue.userRatingCount,
    address: venue.address,
    websiteUri: venue.websiteUri,
    googleMapsUri: venue.googleMapsUri,
    photoUrl: photo.url,
    photoAttribution: photo.attribution,
    curated: venue.source === "curated",
  };
}

/**
 * Curated venues first, then by rating descending (unrated venues last
 * within each group), ties broken alphabetically (es-MX) — a stable,
 * deterministic order for `/recintos`.
 */
export function buildCatalogVenues(kb: Kb): KbCatalogVenue[] {
  return [...kb.venues]
    .sort((a, b) => {
      if (a.source !== b.source) {
        return a.source === "curated" ? -1 : 1;
      }
      const ratingDiff = (b.rating ?? 0) - (a.rating ?? 0);
      if (ratingDiff !== 0) {
        return ratingDiff;
      }
      return a.name.localeCompare(b.name, "es-MX");
    })
    .map(toCatalogVenue);
}

/** The 10 taxonomy zones, in `data/kb/zones.json`'s order, for the catalog's zone filter. */
export function buildCatalogZones(kb: Kb): KbCatalogZone[] {
  return kb.zones.map((zone) => ({ id: zone.id, label: facetLabel("zone", zone.id) }));
}

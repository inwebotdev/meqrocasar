import { getPhoto, type PhotoId } from "@/domain/media/photos";
import { scoreVenue } from "@/domain/kb/search";
import { facetLabel, type BudgetValue, type Facets } from "@/domain/kb/taxonomy";
import type { Kb, KbPhoto, KbVenue } from "@/domain/kb/types";
import { placesPhotoPath } from "@/domain/places/photo-url";

import type { ExperienceVenue } from "./types";

/**
 * Maps the primary model's `recommendedVenues` (knowledge-base ids +
 * reasons) to full `ExperienceVenue`s with real Places/KB data (rating,
 * address, website, maps link, photo), filling up to `MIN_VENUES` by
 * ranking `kb.venues` with `scoreVenue` when fewer than that many ids
 * resolve to a real venue. Ranks `kb.venues` directly (via `scoreVenue`)
 * rather than calling `searchVenues` (which always reads the process-wide
 * `loadKb()` singleton), so a caller that injects its own `kb` — tests,
 * mainly — gets a fully self-contained result. The first resolved venue
 * is always `principal`, the rest `destacada`.
 */

const MIN_VENUES = 2;
const MAX_VENUES = 3;

const BUDGET_TO_PRICE_CATEGORY: Record<BudgetValue, ExperienceVenue["priceCategory"]> = {
  medio: "Medio",
  medio_alto: "Medio-Alto",
  exclusivo: "Exclusivo",
};

export interface RecommendedVenueInput {
  venueId: string;
  reason: string;
}

interface ResolvedPhoto {
  url: string;
  attribution?: string;
}

function resolveKbPhoto(venue: KbVenue): ResolvedPhoto | undefined {
  const placesPhoto = venue.photos.find((photo): photo is KbPhoto => photo.kind === "places");
  if (placesPhoto) {
    return { url: placesPhotoPath(placesPhoto.ref, 800), attribution: placesPhoto.attribution };
  }

  const registryPhoto = venue.photos.find((photo) => photo.kind === "registry");
  if (registryPhoto) {
    const photo = getPhoto(registryPhoto.ref as PhotoId);
    return { url: photo.url, attribution: registryPhoto.attribution ?? photo.credit };
  }

  const urlPhoto = venue.photos.find((photo) => photo.kind === "url");
  if (urlPhoto) {
    return { url: urlPhoto.ref, attribution: urlPhoto.attribution };
  }

  return undefined;
}

function toExperienceVenue(
  venue: KbVenue,
  role: ExperienceVenue["role"],
  reason: string,
): ExperienceVenue {
  const photo = resolveKbPhoto(venue);

  return {
    id: venue.id,
    name: venue.name,
    zone: facetLabel("zone", venue.zone),
    municipality: venue.municipality,
    subtitle: venue.oneLiner,
    capacity: venue.capacityEstimate,
    capacityApprox: true,
    features: venue.highlights,
    priceCategory: BUDGET_TO_PRICE_CATEGORY[venue.facets.budget],
    tags: [],
    aliases: venue.aliases,
    website: venue.websiteUri,
    reason,
    role,
    rating: venue.rating,
    userRatingCount: venue.userRatingCount,
    address: venue.address,
    websiteUri: venue.websiteUri,
    googleMapsUri: venue.googleMapsUri,
    photoUrl: photo?.url,
    photoAttribution: photo?.attribution,
    oneLiner: venue.oneLiner,
    whyWeddings: venue.whyWeddings,
  };
}

/**
 * Resolves the model's recommended venue ids against the knowledge base,
 * dropping unknown ids and deduplicating, then fills up to `MIN_VENUES`
 * (never exceeding `MAX_VENUES`) with the top `searchVenues({ facets })`
 * results not already included. Each KB venue's real Places/KB fields
 * (rating, address, website, maps link, photo) are copied onto the
 * resulting `ExperienceVenue`; the fill-in venues' `reason` comes from
 * their `whyWeddings` (falling back to `oneLiner`) since the model never
 * recommended them.
 */
export function assembleVenuesFromKb(
  recommended: readonly RecommendedVenueInput[],
  facets: Facets,
  kb: Kb,
): ExperienceVenue[] {
  const result: ExperienceVenue[] = [];
  const seenIds = new Set<string>();

  for (const candidate of recommended) {
    if (result.length >= MAX_VENUES) break;

    const venue = kb.venues.find((kbVenue) => kbVenue.id === candidate.venueId);
    if (!venue || seenIds.has(venue.id)) continue;

    seenIds.add(venue.id);
    result.push(
      toExperienceVenue(venue, result.length === 0 ? "principal" : "destacada", candidate.reason),
    );
  }

  if (result.length < MIN_VENUES) {
    const ranked = kb.venues
      .filter((venue) => !seenIds.has(venue.id))
      .map((venue) => ({ venue, score: scoreVenue(venue, facets) }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.venue.name.localeCompare(b.venue.name, "es");
      })
      .map((entry) => entry.venue);

    for (const venue of ranked) {
      if (result.length >= MIN_VENUES) break;

      seenIds.add(venue.id);
      result.push(
        toExperienceVenue(
          venue,
          result.length === 0 ? "principal" : "destacada",
          venue.whyWeddings || venue.oneLiner,
        ),
      );
    }
  }

  return result;
}

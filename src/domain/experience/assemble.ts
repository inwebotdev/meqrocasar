import { getPhoto, type PhotoId } from "@/domain/media/photos";
import { scoreVenue } from "@/domain/kb/search";
import { facetLabel, type BudgetValue, type Facets, type ZoneValue } from "@/domain/kb/taxonomy";
import type { Kb, KbPhoto, KbVenue } from "@/domain/kb/types";
import { isPlacesUsable } from "@/domain/places/availability";
import { placesPhotoPath } from "@/domain/places/photo-url";

import type { ExperienceVenue } from "./types";

/**
 * Maps the primary model's `recommendedVenues` (knowledge-base ids +
 * reasons) to full `ExperienceVenue`s with real Places/KB data (rating,
 * address, website, maps link, photo), filling up to `MIN_VENUES` by
 * ranking `kb.venues` with `scoreVenue` when fewer than that many ids
 * resolve to a real venue, preferring the known `zone` among the fill-ins.
 * Ranks `kb.venues` directly (via `scoreVenue`) rather than calling
 * `searchVenues` (which always reads the process-wide `loadKb()`
 * singleton), so a caller that injects its own `kb` — tests, mainly —
 * gets a fully self-contained result.
 *
 * A venue the couple already chose during the quiz (`chosenVenueIds`),
 * when the model did recommend it, sorts first regardless of the model's
 * own order — a safety net alongside the prompt's own "must appear first"
 * rule (`experience-prompt.ts`), so `principal` is a chosen venue whenever
 * the model recommended one; otherwise the first resolved venue is
 * `principal`, the rest `destacada`.
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

/**
 * Resolves `venue`'s photo: a `"places"` photo is skipped entirely when
 * `isUsable()` is false (Places is disabled/unconfigured), falling
 * through to the venue's own registry/url photo instead — the app must
 * never hand out a `/api/places/photo` URL it knows won't resolve.
 */
function resolveKbPhoto(venue: KbVenue, isUsable: () => boolean): ResolvedPhoto | undefined {
  const placesPhoto = venue.photos.find((photo): photo is KbPhoto => photo.kind === "places");
  if (placesPhoto && isUsable()) {
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
  isUsable: () => boolean,
): ExperienceVenue {
  const photo = resolveKbPhoto(venue, isUsable);

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
export interface AssembleVenuesDeps {
  /** Whether a `"places"` photo may be used. Defaults to the process-wide `isPlacesUsable`. */
  isUsable?: () => boolean;
  /**
   * Venue ids the couple already chose during the quiz — when the model's
   * own `recommended` includes one, it's sorted first (in `chosenVenueIds`
   * order), as a safety net alongside the prompt's own "must appear first"
   * rule (`experience-prompt.ts`). Deliberately never synthesizes an entry
   * for a chosen id the model didn't recommend at all: `chosenRefs` also
   * picks up incidental venue refs that aren't a literal "this is our
   * venue" choice (e.g. the legacy 4-answer quiz's per-step illustrative
   * venueHint), so inventing a recommendation for those would crowd out
   * what the model actually grounded its narrative in.
   */
  chosenVenueIds?: readonly string[];
  /** The couple's known zone, when any — preferred among the KB fill-in venues (not the model's own `recommended`, which is trusted as given). */
  zone?: ZoneValue;
}

/** Stable-sorts `recommended` so any entry whose id is in `chosenVenueIds` moves first, in `chosenVenueIds`'s own order — never adding or dropping entries. */
function withChosenVenuesFirst(
  recommended: readonly RecommendedVenueInput[],
  chosenVenueIds: readonly string[],
): RecommendedVenueInput[] {
  if (chosenVenueIds.length === 0) {
    return [...recommended];
  }

  const chosenIndex = new Map(chosenVenueIds.map((id, index) => [id, index]));

  return [...recommended].sort((a, b) => {
    const aIndex = chosenIndex.get(a.venueId);
    const bIndex = chosenIndex.get(b.venueId);
    if (aIndex === undefined && bIndex === undefined) return 0;
    if (aIndex === undefined) return 1;
    if (bIndex === undefined) return -1;
    return aIndex - bIndex;
  });
}

export function assembleVenuesFromKb(
  recommended: readonly RecommendedVenueInput[],
  facets: Facets,
  kb: Kb,
  deps: AssembleVenuesDeps = {},
): ExperienceVenue[] {
  const isUsable = deps.isUsable ?? isPlacesUsable;
  const chosenVenueIds = deps.chosenVenueIds ?? [];
  const ordered = withChosenVenuesFirst(recommended, chosenVenueIds);
  const result: ExperienceVenue[] = [];
  const seenIds = new Set<string>();

  for (const candidate of ordered) {
    if (result.length >= MAX_VENUES) break;

    const venue = kb.venues.find((kbVenue) => kbVenue.id === candidate.venueId);
    if (!venue || seenIds.has(venue.id)) continue;

    seenIds.add(venue.id);
    result.push(
      toExperienceVenue(
        venue,
        result.length === 0 ? "principal" : "destacada",
        candidate.reason,
        isUsable,
      ),
    );
  }

  if (result.length < MIN_VENUES) {
    const ranked = kb.venues
      .filter((venue) => !seenIds.has(venue.id))
      .map((venue) => ({
        venue,
        score: scoreVenue(venue, facets),
        inZone: deps.zone !== undefined && venue.zone === deps.zone,
      }))
      .sort((a, b) => {
        if (a.inZone !== b.inZone) return a.inZone ? -1 : 1;
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
          isUsable,
        ),
      );
    }
  }

  return result;
}

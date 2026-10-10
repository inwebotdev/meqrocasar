import type { Place } from "@/domain/places";

import {
  facetLabel,
  type BudgetValue,
  type ExperienceValue,
  type SettingValue,
  type StyleValue,
  type ZoneValue,
} from "./taxonomy";
import type { KbPhoto, KbVenue, KbZone } from "./types";

/**
 * Maps raw Google Places results (`data/kb/places.raw.json`) onto the
 * knowledge-base venue shape (`KbVenueSchema`), and merges a snapshot of
 * them into the curated seed venues. Pure TypeScript: no `fs`, no
 * `server-only` — `scripts/kb/build-venues.ts` is the only thing that
 * reads/writes files.
 */

export interface PlacesSnapshot {
  fetchedAt: string;
  queries: number;
  places: Place[];
}

// --- zone assignment ------------------------------------------------------

const EARTH_RADIUS_METERS = 6371000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

/**
 * Assigns a place to the nearest zone whose centre is within
 * `radiusMeters * 1.5`; if no zone qualifies (a place far from every
 * centre), falls back to the overall closest zone. Falls back to the
 * first zone in `zones` when `place.location` is missing entirely.
 */
export function zoneForPlace(place: Place, zones: readonly KbZone[]): ZoneValue {
  const first = zones[0];
  if (!first) {
    throw new Error("zoneForPlace requires at least one zone.");
  }
  if (!place.location) {
    return first.id;
  }

  const placeLatLng = { lat: place.location.latitude, lng: place.location.longitude };
  const distances = zones
    .map((zone) => ({ zone, distanceMeters: haversineMeters(placeLatLng, zone.center) }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  const withinRadius = distances.find(
    (entry) => entry.distanceMeters <= entry.zone.radiusMeters * 1.5,
  );

  return (withinRadius ?? distances[0]!).zone.id;
}

// --- facet / highlight heuristics ------------------------------------------

interface VenueFacets {
  styles: StyleValue[];
  settings: SettingValue[];
  scale: ["intimate" | "medium" | "grand"];
  experiences: ExperienceValue[];
  budget: BudgetValue;
}

function placeTypes(place: Place): string[] {
  const types = place.types ?? [];
  return place.primaryType ? [place.primaryType, ...types] : types;
}

function hasAnyType(types: readonly string[], candidates: readonly string[]): boolean {
  return candidates.some((candidate) => types.includes(candidate));
}

const PRICE_LEVEL_TO_BUDGET: Record<string, BudgetValue> = {
  PRICE_LEVEL_FREE: "medio",
  PRICE_LEVEL_INEXPENSIVE: "medio",
  PRICE_LEVEL_MODERATE: "medio_alto",
  PRICE_LEVEL_EXPENSIVE: "exclusivo",
  PRICE_LEVEL_VERY_EXPENSIVE: "exclusivo",
};

/**
 * Heuristic default facets from a place's Google types, falling back to
 * `zone`'s own facets when nothing more specific applies. These are
 * coarse, low-confidence defaults (see `confidence` on the resulting
 * venue) meant to be refined by a later enrichment pass.
 */
function heuristicFacets(place: Place, zone: KbZone): VenueFacets {
  const types = placeTypes(place);
  const isVineyard = hasAnyType(types, ["winery", "vineyard"]);
  const isLandmark = hasAnyType(types, ["historical_landmark"]);

  const styles: StyleValue[] = isVineyard
    ? ["rustic_vineyard"]
    : isLandmark
      ? ["colonial"]
      : zone.facets.styles.slice(0, 1);

  const settings: SettingValue[] = isVineyard ? ["day_vineyard"] : zone.facets.settings.slice(0, 1);

  const experiences: ExperienceValue[] = isVineyard ? ["wine_tasting"] : [];

  const budget: BudgetValue = place.priceLevel
    ? (PRICE_LEVEL_TO_BUDGET[place.priceLevel] ?? "medio_alto")
    : "medio_alto";

  return { styles, settings, scale: ["medium"], experiences, budget };
}

const TYPE_LABELS_ES: Record<string, string> = {
  wedding_venue: "Recinto para Bodas",
  event_venue: "Recinto de Eventos",
  banquet_hall: "Salón de Banquetes",
  hotel: "Hospedaje Boutique",
  resort_hotel: "Resort con Hospedaje",
  lodging: "Hospedaje para Invitados",
  winery: "Viñedo y Cava",
  vineyard: "Viñedo Propio",
  park: "Parque y Jardines",
  garden: "Jardines",
  restaurant: "Restaurante Gourmet",
  tourist_attraction: "Atractivo Turístico",
  historical_landmark: "Patrimonio Histórico",
};

const DEFAULT_HIGHLIGHTS = ["Recomendado en Google", "Buena Ubicación", "Ideal para Fotos"];

/** Picks up to 3 distinct es-MX highlight chips from the place's types, padding with generic defaults. */
function buildHighlights(place: Place): [string, string, string] {
  const labels: string[] = [];

  for (const type of placeTypes(place)) {
    const label = TYPE_LABELS_ES[type];
    if (label && !labels.includes(label)) {
      labels.push(label);
    }
    if (labels.length === 3) break;
  }

  for (const fallback of DEFAULT_HIGHLIGHTS) {
    if (labels.length === 3) break;
    if (!labels.includes(fallback)) {
      labels.push(fallback);
    }
  }

  return [labels[0]!, labels[1]!, labels[2]!];
}

function buildOneLiner(place: Place): string {
  const raw =
    place.editorialSummary?.text ?? place.reviews?.[0]?.text?.text ?? `${place.displayName.text}.`;
  const trimmed = raw.trim();
  return trimmed.length > 120 ? `${trimmed.slice(0, 119)}…` : trimmed;
}

function buildPhotos(place: Place): KbPhoto[] {
  return (place.photos ?? []).slice(0, 3).map((photo) => ({
    kind: "places" as const,
    ref: photo.name,
    attribution: photo.authorAttributions?.[0]?.displayName,
  }));
}

// --- mapping ------------------------------------------------------------

function slugifyPlaceId(placeId: string): string {
  return placeId.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Maps one raw Google Place onto a `KbVenue`, with `source: "places"` and
 * `confidence: 0.4` (pending enrichment). `whyWeddings` is intentionally
 * left empty — a future enrichment layer fills it in from the digest.
 */
export function kbVenueFromPlace(place: Place, zoneId: ZoneValue, zone: KbZone): KbVenue {
  return {
    id: `v_${slugifyPlaceId(place.id)}`,
    name: place.displayName.text,
    aliases: [],
    zone: zoneId,
    municipality: facetLabel("zone", zoneId),
    address: place.formattedAddress,
    location: place.location
      ? { lat: place.location.latitude, lng: place.location.longitude }
      : undefined,
    rating: place.rating,
    userRatingCount: place.userRatingCount,
    websiteUri: place.websiteUri,
    googleMapsUri: place.googleMapsUri,
    priceLevel: place.priceLevel,
    capacityEstimate: 150,
    capacityApprox: true,
    oneLiner: buildOneLiner(place),
    whyWeddings: "",
    highlights: buildHighlights(place),
    facets: heuristicFacets(place, zone),
    photos: buildPhotos(place),
    source: "places",
    placeId: place.id,
    confidence: 0.4,
  };
}

// --- seed merge ------------------------------------------------------------

function normalizeName(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function seedMatchesPlace(seed: KbVenue, place: Place): boolean {
  const placeName = normalizeName(place.displayName.text);
  const seedNames = [seed.name, ...seed.aliases].map(normalizeName);
  return seedNames.includes(placeName);
}

/**
 * Finds the snapshot place for `seed`: matched by `placeId` when the seed
 * already carries one (robust to a later Places rename — this is the
 * primary strategy so a rebuild never silently re-links a seed to the
 * wrong place), falling back to a name/alias match for a seed that
 * hasn't been linked to a place yet (a curated seed on its first
 * `kb:build`, or a places-sourced venue re-ingested without its id).
 */
function findMatchingPlace(seed: KbVenue, places: readonly Place[]): Place | undefined {
  if (seed.placeId) {
    const byId = places.find((place) => place.id === seed.placeId);
    if (byId) return byId;
  }

  return places.find((place) => seedMatchesPlace(seed, place));
}

/** Attaches Places metadata (placeId, rating, counts, links, extra photos) to a seed venue, keeping the seed's own curated copy. */
function attachPlaceToSeed(seed: KbVenue, place: Place): KbVenue {
  const extraPhotos = buildPhotos(place).filter(
    (photo) => !seed.photos.some((existing) => existing.ref === photo.ref),
  );
  const photos = [...seed.photos, ...extraPhotos].slice(0, 3);

  return {
    ...seed,
    placeId: place.id,
    rating: place.rating ?? seed.rating,
    userRatingCount: place.userRatingCount ?? seed.userRatingCount,
    address: seed.address ?? place.formattedAddress,
    location:
      seed.location ??
      (place.location
        ? { lat: place.location.latitude, lng: place.location.longitude }
        : undefined),
    websiteUri: place.websiteUri ?? seed.websiteUri,
    googleMapsUri: place.googleMapsUri ?? seed.googleMapsUri,
    priceLevel: place.priceLevel ?? seed.priceLevel,
    photos,
  };
}

/**
 * Merges a Places snapshot into the curated seed venues: a snapshot place
 * matching a seed by `placeId` (preferred) or by name/alias (first-time
 * linking) enriches that seed in place — the seed's own copy (name,
 * facets, one-liner, capacity, confidence, etc., i.e. anything an
 * enrichment pass may have written) always wins, `attachPlaceToSeed`
 * only ever adds metadata the seed doesn't already have. Every unmatched
 * snapshot place is appended as a new, low-confidence venue via
 * `kbVenueFromPlace`.
 */
export function mergeSnapshotIntoKb(
  seedVenues: readonly KbVenue[],
  snapshot: PlacesSnapshot,
  zones: readonly KbZone[],
): KbVenue[] {
  const matchedPlaceIds = new Set<string>();

  const merged = seedVenues.map((seed) => {
    const match = findMatchingPlace(seed, snapshot.places);
    if (!match) return seed;
    matchedPlaceIds.add(match.id);
    return attachPlaceToSeed(seed, match);
  });

  const zoneById = new Map(zones.map((zone) => [zone.id, zone] as const));

  for (const place of snapshot.places) {
    if (matchedPlaceIds.has(place.id)) continue;
    const zoneId = zoneForPlace(place, zones);
    const zone = zoneById.get(zoneId);
    if (!zone) continue;
    merged.push(kbVenueFromPlace(place, zoneId, zone));
  }

  return merged;
}

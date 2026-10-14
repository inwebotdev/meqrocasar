import { loadKb } from "./load";
import { experiencesFor, searchVenues } from "./search";
import { facetLabel, ZONE_VALUES, type Facets, type StyleValue, type ZoneValue } from "./taxonomy";
import type { KbExperience, KbVenue } from "./types";

/**
 * Renders a compact text block of the top-ranked venues and experiences
 * for a couple's known facets, sized to fit the quiz engine's and the
 * final generation's prompt budget. When `zone`/`style` are known, the
 * digest is narrowed to stay coherent with what the couple already chose
 * (see `DigestOptions`).
 */

export interface DigestOptions {
  maxVenues?: number;
  maxExperiences?: number;
  maxChars?: number;
  /** When known, only venues in this zone (plus state-wide/multi-zone experiences) are considered. */
  zone?: ZoneValue;
  /** When known, venues lacking this style are ranked after the ones that have it, and capped (see `STYLE_LACKING_CAP`). */
  style?: StyleValue;
  /** Venue ids already chosen by the couple: always included, first, and tagged "ya elegido" regardless of ranking. */
  chosenVenueIds?: readonly string[];
}

/** Cap on how many style-lacking venues are allowed into the digest once `style` is known — they're a fallback, not the point. */
const STYLE_LACKING_CAP = 5;

/** An experience with more than one `zoneIds` reads as a touring/regional experience (e.g. a wine-and-cheese route across 4 zones), so it stays available even once a specific zone is known. */
function isExperienceInScope(experience: KbExperience, zone: ZoneValue | undefined): boolean {
  if (!zone) return true;
  return experience.zoneIds.includes(zone) || experience.zoneIds.length > 1;
}

/**
 * Ranks every venue by `facets` (optionally restricted to `zone`), then
 * reorders so venues lacking the known `style` sink to the end (capped to
 * `STYLE_LACKING_CAP`), and finally forces every id in `chosenVenueIds` to
 * the front (added back in even if zone/style narrowing would have
 * excluded it — a chosen venue is always relevant).
 */
function selectVenues(
  facets: Facets,
  options: {
    zone: ZoneValue | undefined;
    style: StyleValue | undefined;
    chosenVenueIds: readonly string[];
  },
): KbVenue[] {
  const { zone, style, chosenVenueIds } = options;
  const allVenues = loadKb().venues;

  const ranked = searchVenues({ facets, zone, limit: allVenues.length });

  const ordered = style
    ? [
        ...ranked.filter((venue) => venue.facets.styles.includes(style)),
        ...ranked
          .filter((venue) => !venue.facets.styles.includes(style))
          .slice(0, STYLE_LACKING_CAP),
      ]
    : ranked;

  const chosenSet = new Set(chosenVenueIds);
  const chosen = allVenues.filter((venue) => chosenSet.has(venue.id));
  const rest = ordered.filter((venue) => !chosenSet.has(venue.id));

  return [...chosen, ...rest];
}

function selectExperiences(facets: Facets, zone: ZoneValue | undefined): KbExperience[] {
  const allExperiences = loadKb().experiences;
  const ranked = experiencesFor(facets, allExperiences.length);
  return ranked.filter((experience) => isExperienceInScope(experience, zone));
}

export interface Digest {
  text: string;
  venueIds: string[];
  experienceIds: string[];
}

function formatRatingSuffix(venue: KbVenue): string {
  if (typeof venue.rating !== "number") {
    return "";
  }

  const stars = ` ★${venue.rating.toFixed(1)}`;

  if (typeof venue.userRatingCount !== "number") {
    return stars;
  }

  const count =
    venue.userRatingCount >= 1000
      ? `${(venue.userRatingCount / 1000).toFixed(1)}k`
      : `${venue.userRatingCount}`;

  return `${stars} (${count})`;
}

function formatVenueLine(venue: KbVenue, chosenVenueIds: ReadonlySet<string>): string {
  const zoneLabel = facetLabel("zone", venue.zone);
  const tags: string[] = [];

  if (venue.facets.styles[0]) tags.push(facetLabel("style", venue.facets.styles[0]));
  if (venue.facets.experiences[0]) tags.push(facetLabel("experience", venue.facets.experiences[0]));
  if (chosenVenueIds.has(venue.id)) tags.push("ya elegido");

  const tagsPart = tags.length > 0 ? ` · ${tags.join(", ")}` : "";

  return `- [${venue.id}] ${venue.name} (${zoneLabel})${formatRatingSuffix(venue)}${tagsPart} · ~${venue.capacityEstimate} inv · "${venue.oneLiner}"`;
}

function formatExperienceLine(experience: KbExperience): string {
  const zoneLabel = facetLabel("zone", experience.zoneIds[0]);
  const seasonLabel = facetLabel("season", experience.seasons[0]);

  return `- [${experience.id}] ${experience.name} (${zoneLabel}, ${seasonLabel}) · "${experience.description}"`;
}

function zonesLine(venues: readonly KbVenue[], experiences: readonly KbExperience[]): string {
  const zoneIds = new Set<ZoneValue>([
    ...venues.map((venue) => venue.zone),
    ...experiences.flatMap((experience) => experience.zoneIds),
  ]);

  if (zoneIds.size === 0) {
    return "";
  }

  const ordered = ZONE_VALUES.filter((zone) => zoneIds.has(zone));
  return `Zonas: ${ordered.map((zone) => facetLabel("zone", zone)).join(", ")}`;
}

function render(
  venues: readonly KbVenue[],
  experiences: readonly KbExperience[],
  chosenVenueIds: ReadonlySet<string>,
): string {
  const sections: string[] = [];

  const zones = zonesLine(venues, experiences);
  if (zones) sections.push(zones);

  sections.push("Venues:");
  sections.push(...venues.map((venue) => formatVenueLine(venue, chosenVenueIds)));
  sections.push("Experiencias:");
  sections.push(...experiences.map(formatExperienceLine));

  return sections.join("\n");
}

/**
 * Builds the KB digest for a couple's known facets: the top-ranked venues
 * and experiences (see `searchVenues`/`experiencesFor`), rendered as one
 * line per item plus a zones summary line, truncated to `maxChars` by
 * dropping the lowest-ranked items (never cutting a line in half, and
 * never dropping a chosen venue). `zone`/`style`/`chosenVenueIds` narrow
 * and reorder the candidates before ranking/truncation — see `DigestOptions`.
 */
export function buildDigest(facets: Facets, options: DigestOptions = {}): Digest {
  const {
    maxVenues = 25,
    maxExperiences = 12,
    maxChars = 6000,
    zone,
    style,
    chosenVenueIds = [],
  } = options;
  const chosenSet = new Set(chosenVenueIds);

  const allSelectedVenues = selectVenues(facets, { zone, style, chosenVenueIds });
  const chosenVenues = allSelectedVenues.filter((venue) => chosenSet.has(venue.id));
  const restVenues = allSelectedVenues.filter((venue) => !chosenSet.has(venue.id));

  let venues = [
    ...chosenVenues,
    ...restVenues.slice(0, Math.max(maxVenues - chosenVenues.length, 0)),
  ];
  let experiences = selectExperiences(facets, zone).slice(0, maxExperiences);

  let text = render(venues, experiences, chosenSet);

  while (
    text.length > maxChars &&
    (experiences.length > 0 || venues.length > chosenVenues.length)
  ) {
    if (experiences.length > 0) {
      experiences = experiences.slice(0, -1);
    } else {
      venues = venues.slice(0, -1);
    }
    text = render(venues, experiences, chosenSet);
  }

  return {
    text,
    venueIds: venues.map((venue) => venue.id),
    experienceIds: experiences.map((experience) => experience.id),
  };
}

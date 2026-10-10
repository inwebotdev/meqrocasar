import { experiencesFor, searchVenues } from "./search";
import { facetLabel, ZONE_VALUES, type Facets, type ZoneValue } from "./taxonomy";
import type { KbExperience, KbVenue } from "./types";

/**
 * Renders a compact text block of the top-ranked venues and experiences
 * for a couple's known facets, sized to fit the quiz engine's and the
 * final generation's prompt budget.
 */

export interface DigestOptions {
  maxVenues?: number;
  maxExperiences?: number;
  maxChars?: number;
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

function formatVenueLine(venue: KbVenue): string {
  const zoneLabel = facetLabel("zone", venue.zone);
  const tags: string[] = [];

  if (venue.facets.styles[0]) tags.push(facetLabel("style", venue.facets.styles[0]));
  if (venue.facets.experiences[0]) tags.push(facetLabel("experience", venue.facets.experiences[0]));

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

function render(venues: readonly KbVenue[], experiences: readonly KbExperience[]): string {
  const sections: string[] = [];

  const zones = zonesLine(venues, experiences);
  if (zones) sections.push(zones);

  sections.push("Venues:");
  sections.push(...venues.map(formatVenueLine));
  sections.push("Experiencias:");
  sections.push(...experiences.map(formatExperienceLine));

  return sections.join("\n");
}

/**
 * Builds the KB digest for a couple's known facets: the top-ranked venues
 * and experiences (see `searchVenues`/`experiencesFor`), rendered as one
 * line per item plus a zones summary line, truncated to `maxChars` by
 * dropping the lowest-ranked items (never cutting a line in half).
 */
export function buildDigest(facets: Facets, options: DigestOptions = {}): Digest {
  const { maxVenues = 25, maxExperiences = 12, maxChars = 6000 } = options;

  let venues = searchVenues({ facets, limit: maxVenues });
  let experiences = experiencesFor(facets, maxExperiences);

  let text = render(venues, experiences);

  while (text.length > maxChars && (experiences.length > 0 || venues.length > 0)) {
    if (experiences.length > 0) {
      experiences = experiences.slice(0, -1);
    } else {
      venues = venues.slice(0, -1);
    }
    text = render(venues, experiences);
  }

  return {
    text,
    venueIds: venues.map((venue) => venue.id),
    experienceIds: experiences.map((experience) => experience.id),
  };
}

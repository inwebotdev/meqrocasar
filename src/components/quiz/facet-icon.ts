import type { FacetKey } from "@/domain/kb/taxonomy";
import type { ResolvedOption } from "@/domain/quiz/generated-step";

/**
 * Which facet key wins the quick-strip icon when an option carries more
 * than one (most options carry just one or two): earlier keys here take
 * priority over later ones.
 */
const FACET_ICON_PRIORITY: readonly FacetKey[] = [
  "setting",
  "scale",
  "experience",
  "zone",
  "budget",
  "lodging",
  "season",
  "style",
];

const FACET_ICONS: Record<FacetKey, string> = {
  setting: "wb_twilight",
  scale: "groups",
  experience: "celebration",
  zone: "location_on",
  budget: "payments",
  lodging: "hotel",
  season: "calendar_month",
  style: "palette",
};

const DEFAULT_ICON = "auto_awesome";

/**
 * Picks a Material Symbol for a resolved option by the first facet key it
 * carries, in `FACET_ICON_PRIORITY` order. Falls back to a generic sparkle
 * icon for the (should-never-happen) case of an option with no facets.
 */
export function iconForOption(option: ResolvedOption): string {
  const key = FACET_ICON_PRIORITY.find((candidate) => option.facets[candidate] !== undefined);
  return key ? FACET_ICONS[key] : DEFAULT_ICON;
}

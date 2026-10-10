import { Chip } from "@/components/ui";
import { FACET_KEYS, facetLabel, type Facets, type FacetKey } from "@/domain/kb/taxonomy";
import { foldFacets, type TranscriptEntry } from "@/domain/quiz/transcript";

export interface KnownFacetsStripProps {
  entries: readonly TranscriptEntry[];
}

/** Chip label for one facet key, `undefined` when the couple hasn't answered it yet. */
function chipLabel(key: FacetKey, facets: Facets): string | undefined {
  switch (key) {
    case "style":
      return facets.style ? facetLabel("style", facets.style) : undefined;
    case "setting":
      return facets.setting ? facetLabel("setting", facets.setting) : undefined;
    case "scale":
      return facets.scale ? facetLabel("scale", facets.scale) : undefined;
    case "zone":
      return facets.zone ? facetLabel("zone", facets.zone) : undefined;
    case "experience":
      return facets.experience ? facetLabel("experience", facets.experience) : undefined;
    case "budget":
      return facets.budget ? facetLabel("budget", facets.budget) : undefined;
    case "lodging":
      return facets.lodging ? facetLabel("lodging", facets.lodging) : undefined;
    case "season":
      return facets.season ? facetLabel("season", facets.season) : undefined;
  }
}

/**
 * Chips for every facet the couple has already revealed, e.g. "Rústico
 * Viñedo · Atardecer de Jardín · Íntima (hasta 60) · Ezequiel Montes".
 * Renders nothing before the first choice is made.
 */
export function KnownFacetsStrip({ entries }: KnownFacetsStripProps) {
  const facets = foldFacets(entries);
  const labels = FACET_KEYS.map((key) => chipLabel(key, facets)).filter(
    (label): label is string => label !== undefined,
  );

  if (labels.length === 0) {
    return null;
  }

  return (
    <div aria-label="Lo que ya sabemos de su boda" className="flex flex-wrap items-center gap-1.5">
      {labels.map((label) => (
        <Chip key={label} tone="primary-container">
          {label}
        </Chip>
      ))}
    </div>
  );
}

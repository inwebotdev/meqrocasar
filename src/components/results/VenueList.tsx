import { SectionHeader } from "@/components/ui";
import type { ExperienceVenue } from "@/domain/experience/types";

import { VenueCard } from "./VenueCard";

export interface VenueListProps {
  venues: readonly ExperienceVenue[];
}

export function VenueList({ venues }: VenueListProps) {
  return (
    <div className="space-y-space-md">
      <SectionHeader
        eyebrow="Locaciones Recomendadas"
        title="Sedes para tu Celebración"
        icon="castle"
      />
      <div className="space-y-space-md">
        {venues.map((venue) => (
          <VenueCard key={venue.id} venue={venue} />
        ))}
      </div>
    </div>
  );
}

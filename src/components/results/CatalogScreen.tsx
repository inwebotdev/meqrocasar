"use client";

import { useState } from "react";

import { SectionHeader } from "@/components/ui";
import type { Venue, Zone } from "@/domain/venues/types";
import { cn } from "@/lib/cn";

import { VenueCard } from "./VenueCard";

export interface CatalogScreenProps {
  venues: readonly Venue[];
  zones: readonly Zone[];
}

const ALL_ZONES_LABEL = "Todas" as const;

type ZoneFilter = Zone | typeof ALL_ZONES_LABEL;

export function CatalogScreen({ venues, zones }: CatalogScreenProps) {
  const [selectedZone, setSelectedZone] = useState<ZoneFilter>(ALL_ZONES_LABEL);

  const filteredVenues =
    selectedZone === ALL_ZONES_LABEL
      ? venues
      : venues.filter((venue) => venue.zone === selectedZone);

  const zoneFilters: readonly ZoneFilter[] = [ALL_ZONES_LABEL, ...zones];

  return (
    <div className="flex flex-col gap-y-space-lg">
      <SectionHeader
        eyebrow="Catálogo SECTUR"
        title="Recintos y Zonas de Querétaro"
        icon="castle"
        level="h1"
      />

      <div className="-mx-margin flex gap-space-xs overflow-x-auto px-margin pb-1">
        {zoneFilters.map((zone) => {
          const isActive = zone === selectedZone;
          return (
            <button
              key={zone}
              type="button"
              aria-pressed={isActive}
              onClick={() => setSelectedZone(zone)}
              className={cn(
                "shrink-0 rounded-full px-space-md py-1.5 font-label-sm text-label-sm font-bold whitespace-nowrap transition-colors",
                isActive
                  ? "bg-primary text-on-primary shadow-lg"
                  : "bg-primary/5 text-primary hover:bg-primary/10",
              )}
            >
              {zone}
            </button>
          );
        })}
      </div>

      <div className="space-y-space-md">
        {filteredVenues.map((venue) => (
          <VenueCard key={venue.id} venue={venue} />
        ))}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";

import { SectionHeader } from "@/components/ui";
import type { KbCatalogVenue, KbCatalogZone } from "@/domain/kb/catalog";
import { cn } from "@/lib/cn";

import { VenueCard } from "./VenueCard";

export interface CatalogScreenProps {
  venues: readonly KbCatalogVenue[];
  zones: readonly KbCatalogZone[];
}

const ALL_ZONES_LABEL = "Todas" as const;

type ZoneFilter = KbCatalogZone["id"] | typeof ALL_ZONES_LABEL;

export function CatalogScreen({ venues, zones }: CatalogScreenProps) {
  const [selectedZone, setSelectedZone] = useState<ZoneFilter>(ALL_ZONES_LABEL);

  const filteredVenues =
    selectedZone === ALL_ZONES_LABEL
      ? venues
      : venues.filter((venue) => venue.zoneId === selectedZone);

  return (
    <div className="flex flex-col gap-y-space-lg">
      <SectionHeader
        eyebrow="Catálogo SECTUR"
        title="Recintos y Zonas de Querétaro"
        icon="castle"
        level="h1"
      />

      <div className="-mx-margin flex gap-space-xs overflow-x-auto px-margin pb-1">
        <button
          type="button"
          aria-pressed={selectedZone === ALL_ZONES_LABEL}
          onClick={() => setSelectedZone(ALL_ZONES_LABEL)}
          className={cn(
            "shrink-0 rounded-full px-space-md py-1.5 font-label-sm text-label-sm font-bold whitespace-nowrap transition-colors",
            selectedZone === ALL_ZONES_LABEL
              ? "bg-primary text-on-primary shadow-lg"
              : "bg-primary/5 text-primary hover:bg-primary/10",
          )}
        >
          {ALL_ZONES_LABEL}
        </button>
        {zones.map((zone) => {
          const isActive = zone.id === selectedZone;
          return (
            <button
              key={zone.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => setSelectedZone(zone.id)}
              className={cn(
                "shrink-0 rounded-full px-space-md py-1.5 font-label-sm text-label-sm font-bold whitespace-nowrap transition-colors",
                isActive
                  ? "bg-primary text-on-primary shadow-lg"
                  : "bg-primary/5 text-primary hover:bg-primary/10",
              )}
            >
              {zone.label}
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

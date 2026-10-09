"use client";

import { useState } from "react";

import { Button, Card, Chip, Icon, Pill } from "@/components/ui";
import type { ExperienceVenue } from "@/domain/experience/types";
import { getPhoto } from "@/domain/media/photos";
import type { Venue } from "@/domain/venues/types";

export interface VenueCardProps {
  venue: ExperienceVenue | Venue;
  role?: ExperienceVenue["role"];
  reason?: string;
}

const ROLE_BADGE: Record<ExperienceVenue["role"], { icon: string; label: string }> = {
  principal: { icon: "hotel_class", label: "Sede Principal" },
  destacada: { icon: "verified", label: "Sede Destacada" },
};

function isExperienceVenue(venue: ExperienceVenue | Venue): venue is ExperienceVenue {
  return "role" in venue;
}

export function VenueCard({ venue, role, reason }: VenueCardProps) {
  const [showReason, setShowReason] = useState(false);
  const effectiveRole = role ?? (isExperienceVenue(venue) ? venue.role : undefined);
  const effectiveReason = reason ?? (isExperienceVenue(venue) ? venue.reason : undefined);
  const photo = getPhoto(venue.photoId);
  const badge = effectiveRole ? ROLE_BADGE[effectiveRole] : undefined;

  function handleDetailsClick() {
    if (effectiveReason) {
      setShowReason((value) => !value);
      return;
    }

    if (venue.website) {
      window.open(venue.website, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <Card padding="none" className="group overflow-hidden">
      <div className="relative h-44 w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt={photo.alt}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {badge && (
          <Pill
            tone="primary"
            icon={badge.icon}
            className="absolute top-space-sm right-space-sm shadow-lg backdrop-blur-sm [&>span:first-child]:text-on-tertiary-container"
          >
            <span className="font-label-sm text-label-sm font-bold tracking-wide">
              {badge.label}
            </span>
          </Pill>
        )}
        <Pill
          tone="glass-light"
          icon="location_on"
          className="absolute bottom-space-sm left-space-sm [&>span:first-child]:text-tertiary-fixed-dim"
        >
          {venue.zone}
        </Pill>
      </div>
      <div className="space-y-space-sm p-space-md">
        <div>
          <h4 className="font-headline-sm text-headline-sm font-bold text-primary">{venue.name}</h4>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {venue.subtitle} • Capacidad: {venue.capacityApprox ? "~" : ""}
            {venue.capacity} invitados
          </p>
        </div>
        <div className="flex flex-wrap gap-space-xs">
          {venue.features.map((feature) => (
            <Chip key={feature} tone="surface">
              {feature}
            </Chip>
          ))}
        </div>
        <div className="flex items-center justify-between pt-space-xs">
          <div className="font-label-md text-label-md font-bold text-secondary">
            Categoría: {venue.priceCategory}
          </div>
          <Button variant="soft" trailingIcon="arrow_forward" onClick={handleDetailsClick}>
            Ver detalles
          </Button>
        </div>
        {showReason && effectiveReason && (
          <div className="flex items-start gap-space-xs rounded-lg bg-primary/5 p-space-sm">
            <Icon name="auto_awesome" size={16} className="mt-0.5 shrink-0 text-primary" />
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              <span className="block font-label-sm text-label-sm font-bold text-primary">
                Por qué conecta con su estilo
              </span>
              {effectiveReason}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

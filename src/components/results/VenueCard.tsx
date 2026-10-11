"use client";

import { useState } from "react";

import { Button, Card, Chip, Icon, LinkButton, Pill } from "@/components/ui";
import type { ExperienceVenue } from "@/domain/experience/types";
import { getPhoto, type PhotoId } from "@/domain/media/photos";

/**
 * Everything `VenueCard` needs, structurally broad enough that a legacy
 * `Venue`, a quiz-result `ExperienceVenue` and a KB catalog projection
 * (`KbCatalogVenue`, see `src/domain/kb/catalog.ts`) all satisfy it as-is
 * — no adapter needed at the call site. Only `id`/`name`/`zone`/`subtitle`/
 * `capacity*`/`features`/`priceCategory` are required; everything else
 * (role/reason, rating, address, website/maps links, `photoUrl`) is
 * optional, since a browsing-the-catalog card has no quiz "role"/"reason"
 * and a legacy venue has no real Places data.
 */
export interface VenueCardVenue {
  id: string;
  name: string;
  zone: string;
  subtitle: string;
  capacity: number;
  capacityApprox: boolean;
  features: readonly string[];
  priceCategory: "Medio" | "Medio-Alto" | "Exclusivo";
  website?: string;
  role?: ExperienceVenue["role"];
  reason?: string;
  rating?: number;
  userRatingCount?: number;
  address?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  photoUrl?: string;
  photoAttribution?: string;
  photoId?: PhotoId;
}

export interface VenueCardProps {
  venue: VenueCardVenue;
  role?: ExperienceVenue["role"];
  reason?: string;
}

const ROLE_BADGE: Record<ExperienceVenue["role"], { icon: string; label: string }> = {
  principal: { icon: "hotel_class", label: "Sede Principal" },
  destacada: { icon: "verified", label: "Sede Destacada" },
};

interface ResolvedPhoto {
  url: string;
  alt: string;
  caption?: string;
}

/** Falls back to when a card somehow has neither a real `photoUrl` nor a legacy `photoId` — shouldn't happen in practice, but keeps this a total function. */
const FALLBACK_PHOTO_ID: PhotoId = "patio-cantera-rosa";

/** Prefers a KB-sourced venue's real Places/registry `photoUrl`; falls back to the legacy photo registry by `photoId`. */
function resolvePhoto(venue: VenueCardVenue): ResolvedPhoto {
  if (venue.photoUrl) {
    return { url: venue.photoUrl, alt: venue.name, caption: venue.photoAttribution };
  }

  const photo = getPhoto(venue.photoId ?? FALLBACK_PHOTO_ID);
  return { url: photo.url, alt: photo.alt };
}

function formatRatingCount(count: number): string {
  return count.toLocaleString("es-MX");
}

export function VenueCard({ venue, role, reason }: VenueCardProps) {
  const [showReason, setShowReason] = useState(false);
  const effectiveRole = role ?? venue.role;
  const effectiveReason = reason ?? venue.reason;
  const photo = resolvePhoto(venue);
  const badge = effectiveRole ? ROLE_BADGE[effectiveRole] : undefined;

  const { rating, userRatingCount, address, websiteUri, googleMapsUri } = venue;

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
        {typeof rating === "number" && (
          <Pill
            tone="gold"
            icon="star"
            className="absolute top-space-sm left-space-sm shadow-lg backdrop-blur-sm"
          >
            {rating.toFixed(1)}
            {typeof userRatingCount === "number" &&
              ` (${formatRatingCount(userRatingCount)} reseñas)`}
          </Pill>
        )}
        <Pill
          tone="glass-light"
          icon="location_on"
          className="absolute bottom-space-sm left-space-sm [&>span:first-child]:text-tertiary-fixed-dim"
        >
          {venue.zone}
        </Pill>
        {photo.caption && (
          <span className="absolute right-space-sm bottom-space-sm font-label-sm text-label-sm text-white/80">
            {photo.caption}
          </span>
        )}
      </div>
      <div className="space-y-space-sm p-space-md">
        <div>
          <h3 className="font-headline-sm text-headline-sm font-bold text-primary">{venue.name}</h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {venue.subtitle} • Capacidad: {venue.capacityApprox ? "~" : ""}
            {venue.capacity} invitados
          </p>
          {address && (
            <p className="flex items-center gap-1 font-body-sm text-body-sm text-on-surface-variant">
              <Icon name="location_on" size={14} className="text-on-surface-variant" />
              {address}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-space-xs">
          {venue.features.map((feature) => (
            <Chip key={feature} tone="surface">
              {feature}
            </Chip>
          ))}
        </div>
        {(websiteUri || googleMapsUri) && (
          <div className="flex flex-wrap gap-space-xs">
            {websiteUri && (
              <LinkButton
                href={websiteUri}
                target="_blank"
                rel="noopener noreferrer"
                variant="surface"
                trailingIcon="open_in_new"
              >
                Sitio web
              </LinkButton>
            )}
            {googleMapsUri && (
              <LinkButton
                href={googleMapsUri}
                target="_blank"
                rel="noopener noreferrer"
                variant="soft"
                trailingIcon="map"
              >
                Ver en Google Maps
              </LinkButton>
            )}
          </div>
        )}
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

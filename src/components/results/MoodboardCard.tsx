"use client";

import { useState } from "react";

import { Icon, LinkButton, Pill } from "@/components/ui";
import type { ExperienceResult } from "@/domain/experience/types";
import {
  buildMoodboardPath,
  moodboardParamsFromExperience,
  slugify,
} from "@/domain/moodboard/params";

export interface MoodboardCardProps {
  result: ExperienceResult;
}

export function MoodboardCard({ result }: MoodboardCardProps) {
  const [showPreview, setShowPreview] = useState(false);
  const params = moodboardParamsFromExperience(result);
  const previewPath = buildMoodboardPath(params);
  const downloadPath = buildMoodboardPath(params, { download: true });
  const [photoLeft, photoTopRight, photoBottomRight] = result.photos;

  return (
    <div className="space-y-space-sm rounded-xl bg-surface-container-lowest p-space-md shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-space-xs">
          <Icon name="view_quilt" size={20} className="text-primary" />
          <h3 className="font-label-lg text-label-lg font-bold text-primary">
            Moodboard Oficial de Inspiración
          </h3>
        </div>
        <span className="font-label-sm text-label-sm font-bold tracking-wider text-secondary uppercase">
          1200 × 630
        </span>
      </div>

      <div className="relative overflow-hidden rounded-lg border border-outline-variant/30 shadow">
        <div className="grid h-44 grid-cols-2 gap-1 bg-surface-container">
          <div className="relative h-full overflow-hidden">
            {photoLeft && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoLeft.url} alt={photoLeft.alt} className="h-full w-full object-cover" />
            )}
          </div>
          <div className="flex h-full flex-col gap-1">
            <div className="relative h-1/2 overflow-hidden">
              {photoTopRight && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoTopRight.url}
                  alt={photoTopRight.alt}
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <div className="relative h-1/2 overflow-hidden">
              {photoBottomRight && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoBottomRight.url}
                  alt={photoBottomRight.alt}
                  className="h-full w-full object-cover"
                />
              )}
            </div>
          </div>
        </div>
        <Pill
          tone="primary"
          icon="verified"
          className="absolute top-2 left-2 shadow [&>span:first-child]:text-tertiary-fixed-dim"
        >
          Sello SECTUR
        </Pill>
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className="font-body-sm text-body-sm text-on-surface-variant">
          Guía estética para organizadores y proveedores
        </span>
        <LinkButton
          variant="surface"
          icon="download"
          href={downloadPath}
          download={`${slugify(result.conceptTitle)}-moodboard.png`}
        >
          Descargar Moodboard
        </LinkButton>
      </div>

      <button
        type="button"
        onClick={() => setShowPreview((value) => !value)}
        className="flex items-center gap-1 font-label-sm text-label-sm font-bold text-primary"
      >
        <Icon name={showPreview ? "expand_less" : "expand_more"} size={16} />
        Ver vista previa real
      </button>

      {showPreview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewPath}
          alt="Moodboard"
          loading="lazy"
          className="w-full rounded-lg border border-outline-variant/30 shadow"
        />
      )}
    </div>
  );
}

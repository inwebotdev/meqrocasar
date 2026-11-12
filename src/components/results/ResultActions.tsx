"use client";

import { Button, LinkButton, useToast } from "@/components/ui";
import type { ExperienceResult } from "@/domain/experience/types";
import { shareExperience } from "@/lib/share";

export interface ResultActionsProps {
  result: ExperienceResult;
}

export const SAVED_EXPERIENCES_KEY = "qro-romance:saved:v1";

function saveExperience(result: ExperienceResult): void {
  if (typeof window === "undefined") {
    return;
  }

  let saved: ExperienceResult[] = [];

  try {
    const raw = window.localStorage.getItem(SAVED_EXPERIENCES_KEY);
    saved = raw ? (JSON.parse(raw) as ExperienceResult[]) : [];
  } catch {
    saved = [];
  }

  const withoutDuplicate = saved.filter(
    (entry) => entry.meta.generatedAt !== result.meta.generatedAt,
  );

  try {
    window.localStorage.setItem(
      SAVED_EXPERIENCES_KEY,
      JSON.stringify([...withoutDuplicate, result]),
    );
  } catch {
    // Private mode / quota exceeded: silently ignore.
  }
}

function buildMailtoHref(result: ExperienceResult): string {
  const subject = `Quiero platicar sobre: ${result.conceptTitle}`;
  const body = `Hola, me interesa organizar mi boda inspirada en "${result.conceptTitle}". ¿Podemos agendar una llamada?`;
  return `mailto:romance@queretaro.travel?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function ResultActions({ result }: ResultActionsProps) {
  const toast = useToast();

  function handleSave() {
    saveExperience(result);
    toast.show("¡Guardado en tus favoritos!", "bookmark");
  }

  async function handleShare() {
    const outcome = await shareExperience(result);
    if (outcome === "copied") {
      toast.show("Enlace copiado", "content_copy");
    }
  }

  return (
    <div className="space-y-space-sm pt-space-xs pb-space-md">
      <Button variant="accent" fullWidth icon="share" onClick={() => void handleShare()}>
        Compartir en Redes
      </Button>
      <div className="grid grid-cols-2 gap-space-sm">
        <Button variant="surface" icon="bookmark" className="text-secondary" onClick={handleSave}>
          Guardar mi Experiencia
        </Button>
        <LinkButton variant="surface" icon="support_agent" href={buildMailtoHref(result)}>
          Contactar Planner
        </LinkButton>
      </div>
    </div>
  );
}

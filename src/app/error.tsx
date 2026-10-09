"use client";

import { useEffect } from "react";

import { Button, Card, Icon, LinkButton } from "@/components/ui";
import { PageShell } from "@/components/shell/PageShell";

export interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PageShell title="Algo salió mal">
      <Card
        padding="lg"
        className="flex flex-col items-center gap-space-md py-space-xl text-center"
      >
        <Icon name="error" size={48} className="text-primary" />
        <div className="space-y-1">
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-primary">
            Algo salió mal
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Ocurrió un error inesperado. Puedes intentar de nuevo o volver al inicio.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-space-sm">
          <Button variant="primary" icon="refresh" onClick={reset}>
            Intentar de nuevo
          </Button>
          <LinkButton href="/" variant="surface" icon="arrow_back">
            Volver al quiz
          </LinkButton>
        </div>
      </Card>
    </PageShell>
  );
}

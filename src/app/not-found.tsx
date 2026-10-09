import { Card, Icon, LinkButton } from "@/components/ui";
import { PageShell } from "@/components/shell/PageShell";

export default function NotFound() {
  return (
    <PageShell title="Página no encontrada">
      <Card
        padding="lg"
        className="flex flex-col items-center gap-space-md py-space-xl text-center"
      >
        <Icon name="explore_off" size={48} className="text-primary" />
        <div className="space-y-1">
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-primary">
            Esta ruta no existe
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            El enlace que seguiste ya no está disponible. Vuelve al inicio para continuar con tu
            quiz.
          </p>
        </div>
        <LinkButton href="/" variant="primary" icon="arrow_back">
          Volver al quiz
        </LinkButton>
      </Card>
    </PageShell>
  );
}

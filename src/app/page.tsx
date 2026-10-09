import { Card, SectionHeader } from "@/components/ui";
import { PageShell } from "@/components/shell/PageShell";

export default function Home() {
  return (
    <PageShell title="Quiz Swipe & Play">
      <Card padding="lg">
        <SectionHeader eyebrow="Propuesta Swipe & Play" title="Cuestionario en construcción" />
        <p className="mt-space-sm font-body-md text-body-md text-on-surface-variant">
          El cuestionario gamificado para descubrir el estilo de boda soñado en Querétaro estará
          disponible próximamente.
        </p>
      </Card>
    </PageShell>
  );
}

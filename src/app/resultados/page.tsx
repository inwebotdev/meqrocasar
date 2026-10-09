import { Card, SectionHeader } from "@/components/ui";
import { PageShell } from "@/components/shell/PageShell";

export default function ResultadosPage() {
  return (
    <PageShell title="Resultados Moodboard">
      <Card padding="lg">
        <SectionHeader eyebrow="Diseño Exclusivo" title="Resultados en construcción" />
        <p className="mt-space-sm font-body-md text-body-md text-on-surface-variant">
          El moodboard de resultados estará disponible próximamente.
        </p>
      </Card>
    </PageShell>
  );
}

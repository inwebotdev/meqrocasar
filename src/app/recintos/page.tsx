import { Card, SectionHeader } from "@/components/ui";
import { PageShell } from "@/components/shell/PageShell";

export default function RecintosPage() {
  return (
    <PageShell title="Recintos">
      <Card padding="lg">
        <SectionHeader eyebrow="Locaciones Recomendadas" title="Recintos en construcción" />
        <p className="mt-space-sm font-body-md text-body-md text-on-surface-variant">
          El catálogo de recintos estará disponible próximamente.
        </p>
      </Card>
    </PageShell>
  );
}

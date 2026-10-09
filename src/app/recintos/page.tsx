import { CatalogScreen } from "@/components/results/CatalogScreen";
import { PageShell } from "@/components/shell/PageShell";
import { VENUES, ZONES } from "@/domain/venues/catalog";

export default function RecintosPage() {
  return (
    <PageShell title="Recintos">
      <CatalogScreen venues={VENUES} zones={ZONES} />
    </PageShell>
  );
}

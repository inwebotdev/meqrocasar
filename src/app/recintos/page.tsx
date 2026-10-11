import { CatalogScreen } from "@/components/results/CatalogScreen";
import { PageShell } from "@/components/shell/PageShell";
import { buildCatalogVenues, buildCatalogZones } from "@/domain/kb/catalog";
import { loadKb } from "@/domain/kb/load";

export default function RecintosPage() {
  const kb = loadKb();
  const venues = buildCatalogVenues(kb);
  const zones = buildCatalogZones(kb);

  return (
    <PageShell title="Recintos">
      <CatalogScreen venues={venues} zones={zones} />
    </PageShell>
  );
}

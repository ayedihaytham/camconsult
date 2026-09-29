import { useNavigate } from "react-router-dom";
import { Boxes } from "lucide-react";
import { SocieteRegistryPage } from "@/components/ledger/SocieteRegistryPage";
import { usePermissions } from "@/hooks/usePermissions";
import { useData, useSocietes } from "@/store/data";

export function StockPage() {
  const navigate = useNavigate();
  const { canSeeSociete } = usePermissions();
  const allSocietes = useSocietes();
  const societes = allSocietes.filter((s) => canSeeSociete(s.id));
  const hydrated = useData((s) => s.hydrated);

  return (
    <SocieteRegistryPage
      eyebrow="Comptabilité · Financial Ledger"
      title="Gestion de stock"
      description="Achats, ventes et écart de stock, par société cliente."
      societes={societes}
      hydrated={hydrated}
      emptyIcon={Boxes}
      emptyTitle="Aucune société accessible"
      emptyDescription="Créez une société ou faites-vous assigner un périmètre pour voir son stock."
      onOpen={(societeId) => navigate(`/stock/${societeId}`)}
      getAriaLabel={(s) => `Ouvrir le stock de ${s.raisonSociale}`}
      registryLabel="Registre des sociétés"
      registryDescription="Accès à la gestion de stock"
      searchLabel="Rechercher une société, un code, un RNE, un type ou un statut"
      searchPlaceholder="Rechercher une société, un code ou un RNE"
    />
  );
}

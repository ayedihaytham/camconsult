import { useNavigate } from "react-router-dom";
import { CircleDollarSign } from "lucide-react";
import { SocieteRegistryPage } from "@/components/ledger/SocieteRegistryPage";
import { usePermissions } from "@/hooks/usePermissions";
import { useData, useSocietes } from "@/store/data";

export function SuiviDeviseSocietesPage() {
  const navigate = useNavigate();
  const { canSeeSociete } = usePermissions();
  const societes = useSocietes().filter((s) => canSeeSociete(s.id));
  const hydrated = useData((s) => s.hydrated);

  return (
    <SocieteRegistryPage
      eyebrow="Comptabilité · Financial Ledger"
      title="Suivi client devise"
      description="Ventes export en devise, par société et par client — lots LC, charges, avoirs, règlements et solde."
      societes={societes}
      hydrated={hydrated}
      emptyIcon={CircleDollarSign}
      emptyTitle="Aucune société accessible"
      emptyDescription="Créez une société ou faites-vous assigner un périmètre pour suivre ses clients export."
      onOpen={(societeId) => navigate(`/suivi-devise/${societeId}`)}
      getAriaLabel={(s) => `Ouvrir le suivi client devise de ${s.raisonSociale}`}
      registryLabel="Registre des sociétés"
      registryDescription="Accès au suivi client devise"
      searchLabel="Rechercher une société, un code, un RNE, un type ou un statut"
      searchPlaceholder="Rechercher une société, un code ou un RNE"
    />
  );
}

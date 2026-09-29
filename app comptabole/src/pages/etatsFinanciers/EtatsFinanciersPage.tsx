import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Calculator } from "lucide-react";
import { SocieteRegistryPage } from "@/components/ledger/SocieteRegistryPage";
import { usePermissions } from "@/hooks/usePermissions";
import { useData, useSocietes } from "@/store/data";

export function EtatsFinanciersPage() {
  const navigate = useNavigate();
  const { canSeeSociete } = usePermissions();
  const allSocietes = useSocietes();
  const hydrated = useData((state) => state.hydrated);
  const societes = useMemo(
    () => allSocietes.filter((societe) => canSeeSociete(societe.id)),
    [allSocietes, canSeeSociete],
  );

  return (
    <SocieteRegistryPage
      eyebrow="Comptabilité · Financial Ledger"
      title="États financiers"
      description="Classeurs comptables organisés par société et par exercice."
      societes={societes}
      hydrated={hydrated}
      emptyIcon={Calculator}
      emptyTitle="Aucune société accessible"
      emptyDescription="Les dossiers financiers disponibles selon votre périmètre apparaîtront ici."
      onOpen={(societeId) => navigate(`/etats-financiers/${societeId}`)}
      getAriaLabel={(s) => `Ouvrir le dossier financier de ${s.raisonSociale}`}
      registryLabel="Registre des sociétés"
      registryDescription="Accès aux exercices et états financiers"
      searchLabel="Rechercher une société, un code, un RNE, un type ou un statut"
      searchPlaceholder="Rechercher une société, un code ou un RNE"
    />
  );
}

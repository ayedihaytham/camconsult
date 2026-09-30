import { Navigate, useNavigate } from "react-router-dom";
import { Receipt } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { SocieteRegistryPage } from "@/components/ledger/SocieteRegistryPage";
import { useData, useSocietes } from "@/store/data";

/** Admin (toutes les sociétés) ; le responsable de société est redirigé vers
 * la page de SA société (voir RequireEtatClient sur la route) — les
 * honoraires et soldes restent une information sensible au cabinet. */
export function HonorairesListPage() {
  const navigate = useNavigate();
  const societes = useSocietes();
  const hydrated = useData((s) => s.hydrated);
  const { isResponsableSociete, societeIds } = usePermissions();

  // Le responsable de société n'a qu'une société : directement sur sa page.
  if (isResponsableSociete && societeIds?.[0]) {
    return <Navigate to={`/honoraires/${societeIds[0]}`} replace />;
  }

  return (
    <SocieteRegistryPage
      eyebrow="Comptabilité · Financial Ledger"
      title="État client"
      description="Déclarations traitées, honoraires et règlements — compte courant du cabinet, par société."
      societes={societes}
      hydrated={hydrated}
      emptyIcon={Receipt}
      emptyTitle="Aucune société"
      emptyDescription="Créez une société pour suivre son compte d'honoraires."
      onOpen={(societeId) => navigate(`/honoraires/${societeId}`)}
      getAriaLabel={(s) => `Ouvrir l'état client de ${s.raisonSociale}`}
      registryLabel="Registre des sociétés"
      registryDescription="Accès au compte d'honoraires"
      searchLabel="Rechercher une société, un code, un RNE, un type ou un statut"
      searchPlaceholder="Rechercher une société, un code ou un RNE"
    />
  );
}

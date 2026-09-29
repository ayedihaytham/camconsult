import { useNavigate } from "react-router-dom";
import { BookText } from "lucide-react";
import { SocieteRegistryPage } from "@/components/ledger/SocieteRegistryPage";
import { useData, useSocietes } from "@/store/data";

/** Registre des sociétés (Signature Ledger / Financial Ledger) — admin
 * uniquement, voir RequireAdmin sur la route. */
export function SoucheChequesListPage() {
  const navigate = useNavigate();
  const societes = useSocietes();
  const hydrated = useData((s) => s.hydrated);

  return (
    <SocieteRegistryPage
      eyebrow="Comptabilité · Financial Ledger"
      title="Souche de chèques"
      description="Chèques émis par société, montants et statut de débit — export Excel et PDF avec gabarit."
      societes={societes}
      hydrated={hydrated}
      emptyIcon={BookText}
      emptyTitle="Aucune société"
      emptyDescription="Créez une société pour suivre sa souche de chèques."
      onOpen={(societeId) => navigate(`/souche-cheques/${societeId}`)}
      getAriaLabel={(s) => `Ouvrir la souche de chèques de ${s.raisonSociale}`}
      registryLabel="Registre des sociétés"
      registryDescription="Accès à la souche de chèques"
      searchLabel="Rechercher une société, un code, un RNE, un type ou un statut"
      searchPlaceholder="Rechercher une société, un code ou un RNE"
    />
  );
}

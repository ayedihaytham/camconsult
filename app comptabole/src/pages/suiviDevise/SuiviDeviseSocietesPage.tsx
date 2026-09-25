import { useNavigate } from "react-router-dom";
import { CircleDollarSign } from "lucide-react";
import { LedgerPageHeader } from "@/components/ledger/LedgerPageHeader";
import { LedgerSheet } from "@/components/ledger/LedgerSheet";
import { SocieteCard } from "@/components/ledger/SocieteCard";
import { EmptyState } from "@/components/common/EmptyState";
import { usePermissions } from "@/hooks/usePermissions";
import { useSocietes } from "@/store/data";

export function SuiviDeviseSocietesPage() {
  const navigate = useNavigate();
  const { canSeeSociete } = usePermissions();
  const societes = useSocietes().filter((s) => canSeeSociete(s.id));

  return (
    <div>
      <LedgerPageHeader
        title="Suivi client devise"
        description="Ventes export en devise, par société et par client — lots LC, charges, avoirs, règlements et solde."
      />

      {societes.length === 0 ? (
        <LedgerSheet className="mt-3">
          <EmptyState
            icon={CircleDollarSign}
            title="Aucune société accessible"
            description="Créez une société ou faites-vous assigner un périmètre pour suivre ses clients export."
          />
        </LedgerSheet>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {societes.map((s) => (
            <SocieteCard key={s.id} societe={s} onClick={() => navigate(`/suivi-devise/${s.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}

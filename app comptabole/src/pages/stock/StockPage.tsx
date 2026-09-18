import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Boxes } from "lucide-react";
import { LedgerPageHeader } from "@/components/ledger/LedgerPageHeader";
import { LedgerSheet } from "@/components/ledger/LedgerSheet";
import { SocieteCard } from "@/components/ledger/SocieteCard";
import { EmptyState } from "@/components/common/EmptyState";
import { usePermissions } from "@/hooks/usePermissions";
import { useData, useSocietes } from "@/store/data";

export function StockPage() {
  const navigate = useNavigate();
  const { canSeeSociete } = usePermissions();
  const allSocietes = useSocietes();
  const societes = allSocietes.filter((s) => canSeeSociete(s.id));
  const employes = useData((s) => s.employes);
  const employeCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of employes) {
      if (e.role === "societe_employe" && e.societeId)
        m.set(e.societeId, (m.get(e.societeId) ?? 0) + 1);
    }
    return m;
  }, [employes]);

  return (
    <div>
      <LedgerPageHeader
        title="Gestion de stock"
        description="Achats, ventes et écart de stock, par société cliente."
      />

      {societes.length === 0 ? (
        <LedgerSheet className="mt-3">
          <EmptyState
            icon={Boxes}
            title="Aucune société accessible"
            description="Créez une société ou faites-vous assigner un périmètre pour voir son stock."
          />
        </LedgerSheet>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {societes.map((s) => (
            <SocieteCard
              key={s.id}
              societe={s}
              employeCount={employeCount.get(s.id) ?? 0}
              onClick={() => navigate(`/stock/${s.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

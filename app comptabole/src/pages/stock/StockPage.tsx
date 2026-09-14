import { useNavigate } from "react-router-dom";
import { Boxes, ChevronRight } from "lucide-react";
import { LedgerPageHeader } from "@/components/ledger/LedgerPageHeader";
import { LedgerSheet } from "@/components/ledger/LedgerSheet";
import { EmptyState } from "@/components/common/EmptyState";
import { usePermissions } from "@/hooks/usePermissions";
import { useSocietes } from "@/store/data";

export function StockPage() {
  const navigate = useNavigate();
  const { canSeeSociete } = usePermissions();
  const allSocietes = useSocietes();
  const societes = allSocietes.filter((s) => canSeeSociete(s.id));

  return (
    <div>
      <LedgerPageHeader
        title="Gestion de stock"
        description="Achats, ventes et écart de stock, par société cliente."
      />

      {societes.length === 0 ? (
        <LedgerSheet className="mt-4">
          <EmptyState
            icon={Boxes}
            title="Aucune société accessible"
            description="Créez une société ou faites-vous assigner un périmètre pour voir son stock."
          />
        </LedgerSheet>
      ) : (
        <LedgerSheet className="mt-4">
          {societes.map((s, i) => (
            <button
              key={s.id}
              onClick={() => navigate(`/stock/${s.id}`)}
              className={
                "flex w-full items-center justify-between gap-3 border-border px-[18px] py-3 text-left transition-colors hover:bg-primary/[0.03] " +
                (i === societes.length - 1
                  ? ""
                  : (i + 1) % 5 === 0
                    ? "border-b-[1.5px] border-rule-strong"
                    : "border-b")
              }
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {s.raisonSociale}
                </p>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{s.theme}</span>
                  <span className="font-mono">{s.code}</span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </LedgerSheet>
      )}
    </div>
  );
}

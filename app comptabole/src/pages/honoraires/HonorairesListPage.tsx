import { useNavigate } from "react-router-dom";
import { Receipt } from "lucide-react";
import { LedgerPageHeader } from "@/components/ledger/LedgerPageHeader";
import { LedgerSheet } from "@/components/ledger/LedgerSheet";
import { SocieteCard } from "@/components/ledger/SocieteCard";
import { EmptyState } from "@/components/common/EmptyState";
import { useData, useSocietes } from "@/store/data";

/** Réservé à l'admin (voir RequireAdmin sur la route) — les honoraires et
 * soldes clients restent une information sensible au cabinet. */
export function HonorairesListPage() {
  const navigate = useNavigate();
  const societes = useSocietes();
  const employes = useData((s) => s.employes);

  return (
    <div>
      <LedgerPageHeader
        title="État client"
        description="Déclarations traitées, honoraires et règlements — compte courant du cabinet, par société."
      />

      {societes.length === 0 ? (
        <LedgerSheet className="mt-3">
          <EmptyState
            icon={Receipt}
            title="Aucune société"
            description="Créez une société pour suivre son compte d'honoraires."
          />
        </LedgerSheet>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {societes.map((s) => (
            <SocieteCard
              key={s.id}
              societe={s}
              employeCount={
                employes.filter(
                  (e) => e.role === "societe_employe" && e.societeId === s.id,
                ).length
              }
              onClick={() => navigate(`/honoraires/${s.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

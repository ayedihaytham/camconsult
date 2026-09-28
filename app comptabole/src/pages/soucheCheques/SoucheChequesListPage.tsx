import { useNavigate } from "react-router-dom";
import { BookText } from "lucide-react";
import { LedgerPageHeader } from "@/components/ledger/LedgerPageHeader";
import { LedgerSheet } from "@/components/ledger/LedgerSheet";
import { SocieteCard } from "@/components/ledger/SocieteCard";
import { EmptyState } from "@/components/common/EmptyState";
import { useData, useSocietes } from "@/store/data";

/** Choix de la société (admin uniquement — voir RequireAdmin sur la route). */
export function SoucheChequesListPage() {
  const navigate = useNavigate();
  const societes = useSocietes();
  const employes = useData((s) => s.employes);

  return (
    <div>
      <LedgerPageHeader
        title="État de souche de chèques"
        description="Chèques émis par société : bénéficiaire, montant, statut débité et date de débit — export Excel et PDF."
      />

      {societes.length === 0 ? (
        <LedgerSheet className="mt-3">
          <EmptyState
            icon={BookText}
            title="Aucune société"
            description="Créez une société pour suivre sa souche de chèques."
          />
        </LedgerSheet>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {societes.map((s) => (
            <SocieteCard
              key={s.id}
              societe={s}
              employeCount={
                employes.filter((e) => e.role === "societe_employe" && e.societeId === s.id).length
              }
              onClick={() => navigate(`/souche-cheques/${s.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

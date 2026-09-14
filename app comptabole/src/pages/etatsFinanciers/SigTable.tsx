import {
  computeRows,
  computeSig,
  fmt,
  ROWS_SIG_CHARGES,
  ROWS_SIG_PRODUITS,
  type Row,
} from "@/lib/etatsFinanciers/postes";
import type { PostesExercice } from "@/store/balances";
import { cn } from "@/lib/utils";

/**
 * Soldes intermédiaires de gestion — présentation en 2 colonnes
 * (Produits | Charges) comme sur la capture de l'utilisateur, avec les 5
 * soldes chaînés affichés sous chaque bloc concerné. Structurellement
 * différent d'un tableau à une colonne (Bilan/CPC) donc non réutilisable via
 * `FinancialTable`.
 */
export function SigTable({ exercices }: { exercices: PostesExercice[] }) {
  return (
    <div className="space-y-6">
      {exercices.map((e) => (
        <SigExercice key={e.exercice} exercice={e.exercice} postes={e.postes} />
      ))}
    </div>
  );
}

function SigExercice({ exercice, postes }: { exercice: string; postes: PostesExercice["postes"] }) {
  const produits = computeRows(ROWS_SIG_PRODUITS, postes);
  const charges = computeRows(ROWS_SIG_CHARGES, postes);
  const sig = computeSig(postes);

  return (
    <div>
      <p className="mb-2 px-[18px] text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
        Exercice {exercice}
      </p>
      <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-2 md:divide-x md:divide-y-0">
        <SigColonne titre="Produits" rows={ROWS_SIG_PRODUITS} values={produits} />
        <SigColonne titre="Charges" rows={ROWS_SIG_CHARGES} values={charges} />
      </div>
      <div className="border-t-2 border-foreground">
        <SigSolde label="Marge commerciale" value={sig.margeCommerciale} />
        <SigSolde label="Valeur ajoutée" value={sig.valeurAjoutee} />
        <SigSolde label="Excédent brut d'exploitation (EBE)" value={sig.ebe} />
        <SigSolde label="Résultat des activités ordinaires" value={sig.resultatOrdinaire} />
        <SigSolde label="RÉSULTAT NET DE L'EXERCICE" value={sig.resultatNet} bold last />
      </div>
    </div>
  );
}

function SigColonne({
  titre,
  rows,
  values,
}: {
  titre: string;
  rows: Row[];
  values: Record<string, number>;
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr>
          <th className="border-b-2 border-foreground bg-card px-[18px] py-2 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
            {titre}
          </th>
          <th className="border-b-2 border-foreground bg-card px-3 py-2 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
            Montant
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const v = values[r.id] ?? 0;
          return (
            <tr
              key={r.id}
              className={i === rows.length - 1 ? "" : "border-b border-border"}
            >
              <td className="px-[18px] py-1.5 text-foreground">{r.label}</td>
              <td
                className={cn(
                  "px-3 py-1.5 text-right tabular-nums",
                  Math.abs(v) < 0.005 && "text-muted-foreground",
                )}
              >
                {Math.abs(v) < 0.005 ? "—" : fmt(v)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function SigSolde({
  label,
  value,
  bold,
  last,
}: {
  label: string;
  value: number;
  bold?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-[18px] py-2",
        !last && "border-b border-border",
      )}
    >
      <p className={cn("text-sm", bold ? "font-bold text-foreground" : "font-semibold text-foreground")}>
        {label}
      </p>
      <p className={cn("tabular-nums", bold ? "text-base font-bold text-foreground" : "text-sm font-semibold text-foreground")}>
        {fmt(value)}
      </p>
    </div>
  );
}

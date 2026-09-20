import { computeSig, fmt, sigLigneValeur, SIG_BLOCS } from "@/lib/etatsFinanciers/postes";
import type { PostesExercice } from "@/store/balances";
import { cn } from "@/lib/utils";

/**
 * Tableau de Solde Intermédiaire de Gestion (TSIG) — présentation officielle
 * à 3 colonnes (Produits | Charges | Soldes intermédiaires de gestion),
 * chaque solde apparaissant au niveau du groupe de lignes qui le calcule,
 * comme sur le document réel du cabinet — pas une liste Produits/Charges
 * suivie d'un bloc de soldes séparé.
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
  const sig = computeSig(postes);

  return (
    <div>
      <p className="mb-2 px-[18px] text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
        Exercice {exercice}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border-b-2 border-foreground bg-card px-[18px] py-2 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                Produits
              </th>
              <th className="border-b-2 border-foreground bg-card px-3 py-2 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                Montant
              </th>
              <th className="border-b-2 border-l border-foreground bg-card px-[18px] py-2 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                Charges
              </th>
              <th className="border-b-2 border-foreground bg-card px-3 py-2 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                Montant
              </th>
              <th className="border-b-2 border-l border-foreground bg-card px-[18px] py-2 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                Soldes intermédiaires de gestion
              </th>
              <th className="border-b-2 border-foreground bg-card px-3 py-2 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                Montant
              </th>
            </tr>
          </thead>
          <tbody>
            {SIG_BLOCS.map((bloc, blocIdx) => {
              const n = Math.max(bloc.produits.length, bloc.charges.length, 1);
              const rows = Array.from({ length: n }, (_, i) => i);
              const isLast = blocIdx === SIG_BLOCS.length - 1;
              return rows.map((i) => {
                const p = bloc.produits[i];
                const c = bloc.charges[i];
                return (
                  <tr
                    key={`${bloc.soldeId}-${i}`}
                    className={cn(
                      i === n - 1 && !isLast && "border-b-2 border-foreground",
                    )}
                  >
                    <td className="px-[18px] py-1.5 text-foreground">{p?.label ?? ""}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {p ? amountCell(sigLigneValeur(postes, p, "produit")) : ""}
                    </td>
                    <td className="border-l border-border px-[18px] py-1.5 text-foreground">
                      {c?.label ?? ""}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {c ? amountCell(sigLigneValeur(postes, c, "charge")) : ""}
                    </td>
                    {i === 0 ? (
                      <>
                        <td
                          rowSpan={n}
                          className={cn(
                            "border-l border-border px-[18px] py-1.5 align-middle",
                            isLast ? "font-bold text-foreground" : "font-semibold text-foreground",
                          )}
                        >
                          {bloc.soldeLabel}
                        </td>
                        <td
                          rowSpan={n}
                          className={cn(
                            "px-3 py-1.5 text-right align-middle tabular-nums",
                            isLast ? "text-base font-bold text-foreground" : "font-semibold text-foreground",
                          )}
                        >
                          {fmt(sig[bloc.soldeId])}
                        </td>
                      </>
                    ) : null}
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function amountCell(v: number) {
  return Math.abs(v) < 0.005 ? (
    <span className="text-muted-foreground">—</span>
  ) : (
    fmt(v)
  );
}

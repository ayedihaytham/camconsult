import { computeSig, fmt, sigLigneValeur, SIG_BLOCS } from "@/lib/etatsFinanciers/postes";
import type { PostesExercice } from "@/store/balances";
import { cn } from "@/lib/utils";

/**
 * Tableau de Solde Intermédiaire de Gestion (TSIG) — présentation officielle
 * à 3 colonnes (Produits | Charges | Soldes intermédiaires de gestion),
 * chaque solde apparaissant au niveau du groupe de lignes qui le calcule,
 * ET tous les exercices dans le même tableau (une colonne montant par
 * exercice sous chacune des 3 sections), comme sur le document réel du
 * cabinet — pas un tableau séparé par exercice.
 */
export function SigTable({ exercices }: { exercices: PostesExercice[] }) {
  if (exercices.length === 0) return null;
  const sigs = exercices.map((e) => computeSig(e.postes));

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border-b-2 border-foreground bg-card px-[18px] py-2 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
              Produits
            </th>
            {exercices.map((e) => (
              <th
                key={`p-${e.exercice}`}
                className="min-w-[110px] border-b-2 border-foreground bg-card px-3 py-2 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground"
              >
                {e.exercice}
              </th>
            ))}
            <th className="border-b-2 border-l border-foreground bg-card px-[18px] py-2 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
              Charges
            </th>
            {exercices.map((e) => (
              <th
                key={`c-${e.exercice}`}
                className="min-w-[110px] border-b-2 border-foreground bg-card px-3 py-2 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground"
              >
                {e.exercice}
              </th>
            ))}
            <th className="border-b-2 border-l border-foreground bg-card px-[18px] py-2 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
              Soldes intermédiaires de gestion
            </th>
            {exercices.map((e) => (
              <th
                key={`s-${e.exercice}`}
                className="min-w-[110px] border-b-2 border-foreground bg-card px-3 py-2 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground"
              >
                {e.exercice}
              </th>
            ))}
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
                  className={cn(i === n - 1 && !isLast && "border-b-2 border-foreground")}
                >
                  <td className="px-[18px] py-1.5 text-foreground">{p?.label ?? ""}</td>
                  {exercices.map((e) => (
                    <td key={`p-${e.exercice}`} className="px-3 py-1.5 text-right tabular-nums">
                      {p ? amountCell(sigLigneValeur(e.postes, p, "produit")) : ""}
                    </td>
                  ))}
                  <td className="border-l border-border px-[18px] py-1.5 text-foreground">
                    {c?.label ?? ""}
                  </td>
                  {exercices.map((e) => (
                    <td key={`c-${e.exercice}`} className="px-3 py-1.5 text-right tabular-nums">
                      {c ? amountCell(sigLigneValeur(e.postes, c, "charge")) : ""}
                    </td>
                  ))}
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
                      {exercices.map((e, exIdx) => (
                        <td
                          key={`s-${e.exercice}`}
                          rowSpan={n}
                          className={cn(
                            "px-3 py-1.5 text-right align-middle tabular-nums",
                            isLast
                              ? "text-base font-bold text-foreground"
                              : "font-semibold text-foreground",
                          )}
                        >
                          {fmt(sigs[exIdx][bloc.soldeId])}
                        </td>
                      ))}
                    </>
                  ) : null}
                </tr>
              );
            });
          })}
        </tbody>
      </table>
    </div>
  );
}

function amountCell(v: number) {
  return Math.abs(v) < 0.005 ? <span className="text-muted-foreground">—</span> : fmt(v);
}

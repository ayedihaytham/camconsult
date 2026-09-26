import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [selectedExercice, setSelectedExercice] = useState(exercices[0]?.exercice ?? "");
  if (exercices.length === 0) return null;
  const sigs = exercices.map((e) => computeSig(e.postes));
  const mobileExercice = exercices.find((e) => e.exercice === selectedExercice) ?? exercices[0];
  const mobileSig = computeSig(mobileExercice.postes);

  return (
    <>
    <div className="min-w-0 px-3 py-3 lg:hidden print:hidden" aria-label={`SIG — exercice ${mobileExercice.exercice}`}>
      {exercices.length > 1 && (
        <div className="mb-4 space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground" htmlFor="sig-exercice-mobile">Exercice</label>
          <Select value={mobileExercice.exercice} onValueChange={setSelectedExercice}>
            <SelectTrigger id="sig-exercice-mobile" className="min-h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {exercices.map((e) => <SelectItem key={e.exercice} value={e.exercice}>{e.exercice}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      {exercices.length === 1 && <p className="mb-4 text-xs font-semibold text-muted-foreground">Exercice {mobileExercice.exercice}</p>}
      <div className="space-y-5">
        {(["produits", "charges"] as const).map((nature) => (
          <section key={nature} aria-label={nature === "produits" ? "Produits" : "Charges"}>
            <h3 className="border-b border-border pb-2 text-xs font-bold uppercase tracking-wide text-foreground">
              {nature === "produits" ? "Produits" : "Charges"}
            </h3>
            <div>
              {SIG_BLOCS.filter((bloc) => bloc[nature].length > 0).map((bloc) => (
                <div key={bloc.soldeId} className="border-b border-border/70 py-1">
                  <p className="pt-2 text-xs font-medium text-muted-foreground">Pour {bloc.soldeLabel}</p>
                  {bloc[nature].map((ligne) => (
                    <div key={ligne.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 py-2 text-sm">
                      <span className="min-w-0 text-foreground">{ligne.label}</span>
                      <span className="whitespace-nowrap text-right tabular-nums text-foreground">
                        {amountCell(sigLigneValeur(mobileExercice.postes, ligne, nature === "produits" ? "produit" : "charge"))}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>
        ))}
        <section aria-label="Soldes intermédiaires de gestion">
          <h3 className="border-b border-border pb-2 text-xs font-bold uppercase tracking-wide text-foreground">Soldes intermédiaires de gestion</h3>
          <div className="divide-y divide-border/70">
            {SIG_BLOCS.map((bloc, index) => (
              <div key={bloc.soldeId} className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 py-2 text-sm", index === SIG_BLOCS.length - 1 && "font-bold")}>
                <span className="min-w-0 text-foreground">{bloc.soldeLabel}</span>
                <span className="whitespace-nowrap text-right tabular-nums text-foreground">{fmt(mobileSig[bloc.soldeId])}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
    <div className="hidden min-w-0 overflow-x-auto lg:block print:block">
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
    </>
  );
}

function amountCell(v: number) {
  return Math.abs(v) < 0.005 ? <span className="text-muted-foreground">—</span> : fmt(v);
}

import { Fragment } from "react";
import { LedgerSheet } from "@/components/ledger/LedgerSheet";
import { fmt } from "@/lib/etatsFinanciers/postes";
import {
  computeControle,
  computeControleMarge,
  ecartNonNul,
  type ControleLigne,
} from "@/lib/etatsFinanciers/controle";
import type { PostesExercice } from "@/store/balances";
import type { FinancementMouvement, ImmoMouvement, TdrfLigne, TdrfParametres } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Tableau de contrôle des états financiers — recoupe les tableaux du module
 * entre eux (Bilan/État de résultat/SIG/Flux/TDRF) pour repérer une
 * incohérence, comme le document de contrôle du cabinet. Un écart non nul
 * est surligné en rouge, exactement comme sur le document de référence.
 */
export function ControleTable({
  exercices,
  immoMouvements,
  financementMouvements,
  tdrfLignes,
  tdrfParametres,
}: {
  exercices: PostesExercice[];
  immoMouvements: ImmoMouvement[];
  financementMouvements: FinancementMouvement[];
  tdrfLignes: TdrfLigne[];
  tdrfParametres: TdrfParametres[];
}) {
  const controle = computeControle(exercices, immoMouvements, financementMouvements, tdrfLignes, tdrfParametres);
  const marges = computeControleMarge(exercices);

  if (controle.length === 0) return null;

  return (
    <div className="space-y-6">
      {controle.map((c) => (
        <div key={c.exercice}>
          <p className="mb-2 px-[18px] text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
            Contrôle des états financiers — Exercice {c.exercice}
          </p>
          <div className="space-y-3">
            {c.lignes.map((l, i) => (
              <LedgerSheet key={i}>
                <ControleLigneTable ligne={l} />
              </LedgerSheet>
            ))}
          </div>
        </div>
      ))}

      {marges.length > 0 && (
        <div>
          <p className="mb-2 px-[18px] text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
            Contrôle de marge
          </p>
          <LedgerSheet>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="px-[18px] py-2 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                      Libellé
                    </th>
                    {marges.map((m) => (
                      <th
                        key={m.exercice}
                        colSpan={2}
                        className="border-b border-border px-2 py-1 text-center text-[0.62rem] font-bold uppercase tracking-wide text-muted-foreground"
                      >
                        {m.exercice} vs {m.exercicePrecedent}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    <th />
                    {marges.map((m) => (
                      <Fragment key={m.exercice}>
                        <th className="border-b-2 border-foreground px-3 py-1.5 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                          {m.exercice}
                        </th>
                        <th className="border-b-2 border-foreground px-3 py-1.5 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                          {m.exercicePrecedent}
                        </th>
                      </Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border">
                    <td className="px-[18px] py-1.5 text-foreground">Production de l'exercice / Ventes</td>
                    {marges.map((m) => (
                      <Fragment key={m.exercice}>
                        <td className="px-3 py-1.5 text-right tabular-nums">{fmt(m.productionVentes1)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{fmt(m.productionVentes2)}</td>
                      </Fragment>
                    ))}
                  </tr>
                  <tr className="border-b-[1.5px] border-rule-strong">
                    <td className="px-[18px] py-1.5 text-foreground">Achats consommés</td>
                    {marges.map((m) => (
                      <Fragment key={m.exercice}>
                        <td className="px-3 py-1.5 text-right tabular-nums">{fmt(m.achatsConsommes1)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{fmt(m.achatsConsommes2)}</td>
                      </Fragment>
                    ))}
                  </tr>
                  <tr className="border-b border-border">
                    <td className="px-[18px] py-1.5 font-bold text-foreground">Marge en valeur</td>
                    {marges.map((m) => (
                      <Fragment key={m.exercice}>
                        <td className="px-3 py-1.5 text-right font-bold tabular-nums text-foreground">{fmt(m.margeValeur1)}</td>
                        <td className="px-3 py-1.5 text-right font-bold tabular-nums text-foreground">{fmt(m.margeValeur2)}</td>
                      </Fragment>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-[18px] py-1.5 font-bold text-foreground">Marge en %</td>
                    {marges.map((m) => (
                      <Fragment key={m.exercice}>
                        <td className="px-3 py-1.5 text-right font-bold tabular-nums text-foreground">
                          {m.margePct1 === null ? "—" : `${(m.margePct1 * 100).toFixed(1)}%`}
                        </td>
                        <td className="px-3 py-1.5 text-right font-bold tabular-nums text-foreground">
                          {m.margePct2 === null ? "—" : `${(m.margePct2 * 100).toFixed(1)}%`}
                        </td>
                      </Fragment>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </LedgerSheet>
        </div>
      )}
    </div>
  );
}

function ControleLigneTable({ ligne }: { ligne: ControleLigne }) {
  const ecart = ligne.valeur1 - ligne.valeur2;
  const enErreur = ecartNonNul(ligne);
  return (
    <table className="w-full text-sm">
      <thead>
        <tr>
          <th className="w-1/3 border-b-2 border-foreground bg-card px-[18px] py-2 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
            Libellé
          </th>
          <th className="border-b-2 border-foreground bg-card px-3 py-2 text-center text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
            {ligne.sourceLabel1}
          </th>
          <th className="border-b-2 border-l border-foreground bg-card px-3 py-2 text-center text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
            {ligne.sourceLabel2}
          </th>
          <th className="border-b-2 border-l border-foreground bg-card px-3 py-2 text-center text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
            Écart (1) − (2)
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="px-[18px] py-2 font-semibold text-foreground">{ligne.libelle}</td>
          <td className="px-3 py-2 text-right tabular-nums">{fmt(ligne.valeur1)}</td>
          <td className="border-l border-border px-3 py-2 text-right tabular-nums">{fmt(ligne.valeur2)}</td>
          <td
            className={cn(
              "border-l border-border px-3 py-2 text-right font-bold tabular-nums",
              enErreur ? "bg-destructive/15 text-destructive" : "text-foreground",
            )}
          >
            {fmt(ecart)}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

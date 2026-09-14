import { useEffect, useState } from "react";
import { LedgerSheet } from "@/components/ledger/LedgerSheet";
import { Input } from "@/components/ui/input";
import { fmt } from "@/lib/etatsFinanciers/postes";
import {
  computeImmoVariation,
  suggestImmoMouvement,
  MASSE_AMORT_LABELS,
  MASSE_LABELS,
} from "@/lib/etatsFinanciers/immobilisations";
import type { PostesExercice } from "@/store/balances";
import type { ImmoMasse, ImmoMouvement } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Tableau des variations d'immobilisations — 3 masses (Incorporelles /
 * Corporelles / Financières), chacune avec ses valeurs brutes et son
 * amortissement/provision. L'ouverture et la clôture sont calculées ; seuls
 * Acquisitions/Cessions/Dotations/Reprises sont saisis pour l'exercice.
 */
export function ImmoVariationTable({
  exercices,
  immoMouvements,
  onSave,
  readOnlyMasses = [],
}: {
  exercices: PostesExercice[];
  immoMouvements: ImmoMouvement[];
  onSave: (
    exercice: string,
    masse: ImmoMasse,
    data: { acquisitions: number; cessions: number; dotations: number; reprises: number },
  ) => void;
  /** Masses alimentées par le registre d'immobilisations — affichées en
   * lecture seule (plus de saisie manuelle, le registre fait foi). */
  readOnlyMasses?: ImmoMasse[];
}) {
  const chrono = [...exercices].sort((a, b) => b.exercice.localeCompare(a.exercice));

  return (
    <div className="space-y-6">
      {chrono.map((e) => {
        // exercice juste avant : le plus grand exercice strictement inférieur
        const prevExercice =
          chrono
            .filter((x) => x.exercice < e.exercice)
            .sort((a, b) => b.exercice.localeCompare(a.exercice))[0] ?? null;
        const lignes = computeImmoVariation(
          e.exercice,
          e.postes,
          prevExercice ? prevExercice.postes : null,
          immoMouvements,
        );
        return (
          <div key={e.exercice}>
            <p className="mb-2 px-[18px] text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
              Exercice {e.exercice}
            </p>
            <LedgerSheet>
              {lignes.map((l, mi) => {
                const hasSaved = immoMouvements.some(
                  (m) => m.exercice === e.exercice && m.masse === l.masse,
                );
                const suggestion =
                  !hasSaved && !readOnlyMasses.includes(l.masse)
                    ? suggestImmoMouvement(
                        l.masse,
                        e.postesDebit,
                        e.postesCredit,
                        prevExercice ? prevExercice.postesDebit : null,
                        prevExercice ? prevExercice.postesCredit : null,
                      )
                    : null;
                return (
                  <MasseBlock
                    key={l.masse}
                    ligne={l}
                    exercice={e.exercice}
                    last={mi === lignes.length - 1}
                    readOnly={readOnlyMasses.includes(l.masse)}
                    suggestion={suggestion}
                    onSave={(data) => onSave(e.exercice, l.masse, data)}
                  />
                );
              })}
            </LedgerSheet>
          </div>
        );
      })}
    </div>
  );
}

function MasseBlock({
  ligne,
  exercice,
  last,
  readOnly,
  suggestion,
  onSave,
}: {
  ligne: ReturnType<typeof computeImmoVariation>[number];
  exercice: string;
  last: boolean;
  readOnly?: boolean;
  /** Mouvements suggérés depuis la balance (voir suggestImmoMouvement) —
   * préremplissage modifiable quand rien n'a encore été saisi pour cet
   * exercice+masse. */
  suggestion?: { acquisitions: number; cessions: number; dotations: number; reprises: number } | null;
  onSave: (data: { acquisitions: number; cessions: number; dotations: number; reprises: number }) => void;
}) {
  const initial = suggestion ?? ligne;
  const [acquisitions, setAcquisitions] = useState(String(initial.acquisitions || ""));
  const [cessions, setCessions] = useState(String(initial.cessions || ""));
  const [dotations, setDotations] = useState(String(initial.dotations || ""));
  const [reprises, setReprises] = useState(String(initial.reprises || ""));

  function commit() {
    onSave({
      acquisitions: Number(acquisitions) || 0,
      cessions: Number(cessions) || 0,
      dotations: Number(dotations) || 0,
      reprises: Number(reprises) || 0,
    });
  }

  // Bascule la suggestion en mouvement réellement enregistré dès l'affichage
  // (comme demandé : générée automatiquement depuis la balance), sans
  // attendre que l'utilisateur touche un champ — reste modifiable ensuite
  // comme n'importe quel mouvement saisi à la main.
  useEffect(() => {
    if (suggestion) onSave(suggestion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={cn("px-[18px] py-3", !last && "border-b-[1.5px] border-rule-strong")}>
      <p className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
        {MASSE_LABELS[ligne.masse]}
        {readOnly && (
          <span className="rounded-[4px] bg-muted px-1.5 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wide text-muted-foreground">
            Calculé depuis le registre
          </span>
        )}
        {suggestion && (
          <span className="rounded-[4px] bg-muted px-1.5 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wide text-muted-foreground">
            Généré depuis la balance — à vérifier
          </span>
        )}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="w-[180px] py-1.5 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground" />
              <th className="py-1.5 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                Ouverture
              </th>
              <th className="py-1.5 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                Augmentation
              </th>
              <th className="py-1.5 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                Diminution
              </th>
              <th className="py-1.5 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                Clôture
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border">
              <td className="py-1.5 text-muted-foreground">Valeurs brutes</td>
              <td className="py-1.5 text-right tabular-nums">{fmt(ligne.brutOuverture)}</td>
              <td className="py-1 text-right">
                {readOnly ? (
                  <span className="tabular-nums">{fmt(ligne.acquisitions)}</span>
                ) : (
                  <Input
                    value={acquisitions}
                    onChange={(e) => setAcquisitions(e.target.value)}
                    onBlur={commit}
                    placeholder="Acquisitions"
                    className="h-7 w-28 border-0 bg-transparent text-right shadow-none focus-visible:ring-1"
                    key={`acq-${exercice}`}
                  />
                )}
              </td>
              <td className="py-1 text-right">
                {readOnly ? (
                  <span className="tabular-nums">{fmt(ligne.cessions)}</span>
                ) : (
                  <Input
                    value={cessions}
                    onChange={(e) => setCessions(e.target.value)}
                    onBlur={commit}
                    placeholder="Cessions"
                    className="h-7 w-28 border-0 bg-transparent text-right shadow-none focus-visible:ring-1"
                    key={`ces-${exercice}`}
                  />
                )}
              </td>
              <td className="py-1.5 text-right font-semibold tabular-nums text-foreground">
                {fmt(ligne.brutCloture)}
              </td>
            </tr>
            <tr className="border-b border-border">
              <td className="py-1.5 text-muted-foreground">{MASSE_AMORT_LABELS[ligne.masse]}</td>
              <td className="py-1.5 text-right tabular-nums">{fmt(ligne.amortOuverture)}</td>
              <td className="py-1 text-right">
                {readOnly ? (
                  <span className="tabular-nums">{fmt(ligne.dotations)}</span>
                ) : (
                  <Input
                    value={dotations}
                    onChange={(e) => setDotations(e.target.value)}
                    onBlur={commit}
                    placeholder="Dotations"
                    className="h-7 w-28 border-0 bg-transparent text-right shadow-none focus-visible:ring-1"
                    key={`dot-${exercice}`}
                  />
                )}
              </td>
              <td className="py-1 text-right">
                {readOnly ? (
                  <span className="tabular-nums">{fmt(ligne.reprises)}</span>
                ) : (
                  <Input
                    value={reprises}
                    onChange={(e) => setReprises(e.target.value)}
                    onBlur={commit}
                    placeholder="Reprises"
                    className="h-7 w-28 border-0 bg-transparent text-right shadow-none focus-visible:ring-1"
                    key={`rep-${exercice}`}
                  />
                )}
              </td>
              <td className="py-1.5 text-right font-semibold tabular-nums text-foreground">
                {fmt(ligne.amortCloture)}
              </td>
            </tr>
            <tr>
              <td className="py-1.5 font-bold text-foreground">Valeur nette comptable</td>
              <td className="py-1.5 text-right font-bold tabular-nums text-foreground">
                {fmt(ligne.netOuverture)}
              </td>
              <td />
              <td />
              <td className="py-1.5 text-right font-bold tabular-nums text-foreground">
                {fmt(ligne.netCloture)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {ligne.brutOuvertureEcart !== null && Math.abs(ligne.brutOuvertureEcart) > 0.5 && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 shrink-0 rounded-[2px] bg-warning" aria-hidden />
          Écart de {fmt(Math.abs(ligne.brutOuvertureEcart))} entre l'ouverture déduite des mouvements
          {readOnly ? " du registre" : " saisis"} et le solde brut réel de l'exercice précédent —
          vérifiez {readOnly ? "le registre" : "les montants"}.
        </p>
      )}
    </div>
  );
}

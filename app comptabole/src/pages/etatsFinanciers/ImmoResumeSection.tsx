import { LedgerSheet } from "@/components/ledger/LedgerSheet";
import { fmt } from "@/lib/etatsFinanciers/postes";
import { computeImmoVariation, MASSE_LABELS } from "@/lib/etatsFinanciers/immobilisations";
import type { PostesExercice } from "@/store/balances";
import type { ImmoMasse, ImmoMouvement } from "@/types";

/**
 * Résumé condensé des immobilisations pour les notes (5.1/5.2/5.3) — reprend
 * les mêmes mouvements que le TAB VAR Immob mais dans la présentation
 * courte du modèle de notes (brut, dotations antérieures/exercice, net).
 */
export function ImmoResumeSection({
  masse,
  titre,
  exerciceCourant,
  immoMouvements,
}: {
  masse: ImmoMasse;
  titre: string;
  exerciceCourant: PostesExercice;
  immoMouvements: ImmoMouvement[];
}) {
  const ligne = computeImmoVariation(exerciceCourant.exercice, exerciceCourant.postes, null, immoMouvements).find(
    (l) => l.masse === masse,
  );
  if (!ligne) return null;

  const rows: [string, number][] = [
    [`Total brut au ${exerciceCourant.exercice}`, ligne.brutCloture],
    [`Total brut au début de l'exercice`, ligne.brutOuverture],
    ...(ligne.acquisitions ? ([[`Acquisitions ${exerciceCourant.exercice}`, ligne.acquisitions]] as [string, number][]) : []),
    ...(ligne.cessions ? ([[`Cessions ${exerciceCourant.exercice}`, -ligne.cessions]] as [string, number][]) : []),
    [`Dotations antérieures`, ligne.amortOuverture],
    [`Dotations aux amortissements/provisions ${exerciceCourant.exercice}`, ligne.dotations],
    [`Valeur comptable nette au ${exerciceCourant.exercice}`, ligne.netCloture],
  ];

  return (
    <LedgerSheet>
      <p className="px-[18px] pt-[18px] text-sm font-bold text-foreground">{titre}</p>
      <p className="px-[18px] text-xs text-muted-foreground">{MASSE_LABELS[masse]}</p>
      <table className="mt-2 w-full text-sm">
        <tbody>
          {rows.map(([label, value], i) => (
            <tr key={label} className={i === rows.length - 1 ? "border-t border-foreground font-bold text-foreground" : "border-t border-border"}>
              <td className="px-[18px] py-1.5">{label}</td>
              <td className="px-[18px] py-1.5 text-right tabular-nums">
                {Math.abs(value) < 0.005 ? "—" : fmt(value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </LedgerSheet>
  );
}

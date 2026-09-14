import { LedgerSheet } from "@/components/ledger/LedgerSheet";
import { fmt } from "@/lib/etatsFinanciers/postes";
import type { DetailCompteLigne } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Détail par compte d'un poste (ex. 5.4 Clients et comptes rattachés) —
 * chaque compte individuel de la balance rattaché à ce poste, avec son
 * solde par exercice. Généré automatiquement depuis les lignes de balance
 * (aucune ressaisie).
 */
export function DetailComptesSection({
  titre,
  poste,
  lignes,
  exercices,
}: {
  titre: string;
  poste: string;
  lignes: DetailCompteLigne[];
  exercices: string[];
}) {
  const filtered = lignes.filter((l) => l.poste === poste);
  const comptes = [...new Set(filtered.map((l) => l.compte))].sort();

  if (comptes.length === 0) return null;

  const libelleFor = (compte: string) =>
    filtered.find((l) => l.compte === compte && l.libelle)?.libelle || compte;
  const soldeFor = (compte: string, exercice: string) =>
    filtered.find((l) => l.compte === compte && l.exercice === exercice)?.solde ?? 0;

  return (
    <LedgerSheet>
      <p className="px-[18px] pt-[18px] text-sm font-bold text-foreground">{titre}</p>
      <div className="overflow-x-auto p-[18px]">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="py-1.5 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                Compte
              </th>
              {exercices.map((ex) => (
                <th key={ex} className="min-w-[110px] py-1.5 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                  {ex}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comptes.map((compte, i) => (
              <tr key={compte} className={cn(i !== comptes.length - 1 && "border-b border-border")}>
                <td className="py-1.5 pr-2 text-foreground">
                  <span className="font-mono text-xs text-muted-foreground">{compte}</span> {libelleFor(compte)}
                </td>
                {exercices.map((ex) => (
                  <td key={ex} className="py-1.5 text-right tabular-nums">
                    {fmt(soldeFor(compte, ex))}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t-2 border-foreground font-bold text-foreground">
              <td className="py-1.5">Total</td>
              {exercices.map((ex) => (
                <td key={ex} className="py-1.5 text-right tabular-nums">
                  {fmt(comptes.reduce((s, c) => s + soldeFor(c, ex), 0))}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </LedgerSheet>
  );
}

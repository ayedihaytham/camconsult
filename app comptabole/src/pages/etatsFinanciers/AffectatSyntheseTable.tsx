import { fmt } from "@/lib/etatsFinanciers/postes";
import type { PostesExercice } from "@/store/balances";
import type { GrilleAffectatCode } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Synthèse par code AFFECTAT, multi-exercices — même logique que la
 * "Synthèse par code AFFECTAT" de l'écran d'import d'une balance, mais en
 * onglet indépendant (comme Bilan Actif/Passif) pour vérifier un import
 * sans redescendre dans l'écran de saisie des lignes. Une ligne "(sans
 * code)" à part signale les montants non reclassés — jamais masquée, même
 * à 0, pour que l'absence de code saute aux yeux.
 */
export function AffectatSyntheseTable({
  exercices,
  grilleCodes,
}: {
  exercices: PostesExercice[];
  grilleCodes: GrilleAffectatCode[];
}) {
  const libelleByCode = new Map(grilleCodes.map((c) => [c.code, c.libelle]));

  const codes = new Set<string>();
  for (const e of exercices) for (const c of Object.keys(e.codes)) codes.add(c);
  const sorted = [...codes].sort((a, b) =>
    (a || "(sans code)").localeCompare(b || "(sans code)"),
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 border-b-2 border-foreground bg-card px-[18px] py-2.5 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
              Code
            </th>
            <th className="border-b-2 border-foreground bg-card px-3 py-2.5 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
              Libellé
            </th>
            {exercices.map((e) => (
              <th
                key={e.exercice}
                className="min-w-[130px] border-b-2 border-foreground px-3 py-2.5 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground"
              >
                {e.exercice}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((code, i) => {
            const sansCode = code === "";
            return (
              <tr
                key={code || "(sans code)"}
                className={cn(
                  "border-b border-border",
                  (i + 1) % 5 === 0 && "border-b-[1.5px] border-rule-strong",
                )}
              >
                <td
                  className={cn(
                    "sticky left-0 bg-card px-[18px] py-1.5 font-mono text-xs font-semibold",
                    sansCode ? "text-warning" : "text-foreground",
                  )}
                >
                  {sansCode ? "(sans code)" : code}
                </td>
                <td className="px-3 py-1.5 text-muted-foreground">
                  {sansCode ? "Lignes non reclassées" : libelleByCode.get(code) || "—"}
                </td>
                {exercices.map((e) => {
                  const v = e.codes[code] ?? 0;
                  return (
                    <td
                      key={e.exercice}
                      className={cn(
                        "px-3 py-1.5 text-right tabular-nums",
                        sansCode && Math.abs(v) > 0.005 && "font-bold text-warning",
                        Math.abs(v) < 0.005 && "text-muted-foreground",
                      )}
                    >
                      {Math.abs(v) < 0.005 ? "—" : fmt(v)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

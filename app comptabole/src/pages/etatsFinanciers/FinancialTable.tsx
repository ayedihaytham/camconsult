import { computeRows, fmt, type Row } from "@/lib/etatsFinanciers/postes";
import type { PostesExercice } from "@/store/balances";
import { cn } from "@/lib/utils";

/**
 * Tableau financier multi-exercices (Bilan Actif/Passif, Etat de résultat) —
 * une ligne par poste/sous-total, une colonne par exercice (le plus récent
 * en premier). `extraByExercice` permet d'injecter une valeur calculée
 * ailleurs (ex. le Résultat net de l'exercice, qui vient du CPC, pas d'un
 * poste direct) sous l'id de ligne correspondant.
 */
export function FinancialTable({
  rows,
  exercices,
  extraByExercice,
  titre,
}: {
  rows: Row[];
  exercices: PostesExercice[];
  extraByExercice?: (exercice: string) => Record<string, number>;
  titre?: string;
}) {
  const columns = exercices.map((e) => ({
    exercice: e.exercice,
    values: computeRows(rows, e.postes, extraByExercice?.(e.exercice) ?? {}),
  }));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 border-b-2 border-foreground bg-card px-[18px] py-2.5 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
              {titre ?? "Poste"}
            </th>
            {columns.map((c) => (
              <th
                key={c.exercice}
                className="min-w-[130px] border-b-2 border-foreground px-3 py-2.5 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground"
              >
                {c.exercice}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            if (r.section) {
              return (
                <tr key={r.id}>
                  <td
                    colSpan={columns.length + 1}
                    className="border-b border-border bg-muted px-[18px] py-1.5 text-[0.72rem] font-bold uppercase tracking-wide text-foreground"
                  >
                    {r.label}
                  </td>
                </tr>
              );
            }
            return (
              <tr key={r.id} className={cn(r.bold && "border-t border-border")}>
                <td
                  className={cn(
                    "sticky left-0 bg-card px-[18px] py-1.5",
                    r.indent && "pl-8 text-muted-foreground",
                    r.bold && "font-bold text-foreground",
                  )}
                >
                  {r.label}
                </td>
                {columns.map((c) => {
                  const v = c.values[r.id] ?? 0;
                  return (
                    <td
                      key={c.exercice}
                      className={cn(
                        "px-3 py-1.5 text-right tabular-nums",
                        r.indent && "text-muted-foreground",
                        r.bold && "font-bold text-foreground",
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

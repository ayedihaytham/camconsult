import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const [selectedExercise, setSelectedExercise] = useState(
    columns[0]?.exercice ?? "",
  );
  const [compareOnMobile, setCompareOnMobile] = useState(false);

  useEffect(() => {
    if (!columns.some((column) => column.exercice === selectedExercise)) {
      setSelectedExercise(columns[0]?.exercice ?? "");
    }
  }, [selectedExercise, exercices]);

  const selectedColumn =
    columns.find((column) => column.exercice === selectedExercise) ?? columns[0];
  const finalRowId = [...rows].reverse().find((row) => !row.section)?.id;

  return (
    <div className="min-w-0">
      <div className="hidden overflow-x-auto lg:block print:block">
        <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-30 min-w-[240px] border-b-2 border-foreground bg-card px-[18px] py-2.5 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
              {titre ?? "Poste"}
            </th>
            {columns.map((c) => (
              <th
                key={c.exercice}
                className="min-w-[130px] border-b-2 border-foreground bg-card px-3 py-2.5 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground"
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
                    "sticky left-0 z-20 min-w-[240px] bg-card px-[18px] py-1.5",
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

      <div className="min-w-0 lg:hidden print:hidden">
        <div className="flex min-w-0 items-end gap-3 border-b border-border bg-card px-3 py-3">
          <div className="min-w-0 flex-1">
            <Label htmlFor="financial-statement-exercise" className="mb-1.5 block">
              Exercice
            </Label>
            {columns.length > 1 ? (
              <Select
                value={selectedColumn?.exercice ?? ""}
                onValueChange={setSelectedExercise}
              >
                <SelectTrigger
                  id="financial-statement-exercise"
                  className="min-h-11 max-w-40"
                  aria-label="Exercice affiché"
                >
                  <SelectValue placeholder="Choisir un exercice" />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((column) => (
                    <SelectItem key={column.exercice} value={column.exercice}>
                      {column.exercice}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="min-h-11 content-center text-sm font-semibold tabular-nums">
                {selectedColumn?.exercice ?? "—"}
              </p>
            )}
          </div>
          {columns.length > 1 && (
            <Button
              type="button"
              variant={compareOnMobile ? "secondary" : "outline"}
              className="min-h-11 shrink-0"
              aria-pressed={compareOnMobile}
              onClick={() => setCompareOnMobile((current) => !current)}
            >
              {compareOnMobile ? "Lecture simple" : "Comparer"}
            </Button>
          )}
        </div>

        {compareOnMobile && columns.length > 1 ? (
          <div
            className="min-w-0 overflow-x-auto overscroll-x-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            tabIndex={0}
            role="region"
            aria-label="Comparaison des exercices, faites défiler horizontalement"
          >
            <table className="w-full min-w-max text-sm">
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="sticky left-0 z-20 min-w-[200px] border-b-2 border-foreground bg-card px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground"
                  >
                    {titre ?? "Poste"}
                  </th>
                  {columns.map((column) => (
                    <th
                      key={column.exercice}
                      scope="col"
                      className="min-w-[144px] border-b-2 border-foreground bg-card px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wide text-muted-foreground"
                    >
                      {column.exercice}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) =>
                  row.section ? (
                    <tr key={row.id}>
                      <th
                        colSpan={columns.length + 1}
                        className="border-b border-border bg-muted px-3 py-2 text-left text-xs font-bold uppercase tracking-wide"
                      >
                        {row.label}
                      </th>
                    </tr>
                  ) : (
                    <tr
                      key={row.id}
                      className={cn(row.bold && "border-t border-border")}
                    >
                      <th
                        scope="row"
                        className={cn(
                          "sticky left-0 z-10 min-w-[200px] bg-card px-3 py-2 text-left font-normal whitespace-normal",
                          row.indent && "pl-5 text-muted-foreground",
                          row.bold && "font-bold text-foreground",
                          row.id === finalRowId && "border-t-2 bg-muted/50",
                        )}
                      >
                        {row.label}
                      </th>
                      {columns.map((column) => {
                        const value = column.values[row.id] ?? 0;
                        return (
                          <td
                            key={column.exercice}
                            className={cn(
                              "min-w-[144px] whitespace-nowrap px-3 py-2 text-right tabular-nums",
                              row.indent && "text-muted-foreground",
                              row.bold && "font-bold text-foreground",
                              Math.abs(value) < 0.005 && "text-muted-foreground",
                              row.id === finalRowId && "border-t-2 bg-muted/50",
                            )}
                          >
                            {Math.abs(value) < 0.005 ? "—" : fmt(value)}
                          </td>
                        );
                      })}
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <table className="w-full table-fixed text-sm">
            <thead>
              <tr>
                <th scope="col" className="w-auto px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {titre ?? "Poste"}
                </th>
                <th scope="col" className="w-[9rem] min-w-[9rem] border-b-2 border-foreground px-3 py-2 text-right text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {selectedColumn?.exercice ?? "Exercice"}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                if (row.section) {
                  return (
                    <tr key={row.id}>
                      <th
                        colSpan={2}
                        className="border-b border-border bg-muted px-3 py-2 text-left text-xs font-bold uppercase tracking-wide"
                      >
                        {row.label}
                      </th>
                    </tr>
                  );
                }
                const value = selectedColumn?.values[row.id] ?? 0;
                return (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b border-border/70",
                      row.bold && "border-t border-border",
                      row.id === finalRowId && "border-t-2 bg-muted/50",
                    )}
                  >
                    <th
                      scope="row"
                      className={cn(
                        "min-w-0 px-3 py-2 text-left font-normal whitespace-normal break-words",
                        row.indent && "pl-5 text-muted-foreground",
                        row.bold && "font-bold text-foreground",
                        row.id === finalRowId && "font-bold",
                      )}
                    >
                      {row.label}
                    </th>
                    <td
                      className={cn(
                        "w-[9rem] min-w-[9rem] whitespace-nowrap px-3 py-2 text-right tabular-nums",
                        row.indent && "text-muted-foreground",
                        row.bold && "font-bold text-foreground",
                        Math.abs(value) < 0.005 && "text-muted-foreground",
                        row.id === finalRowId && "font-extrabold",
                      )}
                    >
                      {Math.abs(value) < 0.005 ? "—" : fmt(value)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

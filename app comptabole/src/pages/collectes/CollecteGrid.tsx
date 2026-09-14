import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { CollecteLigne } from "@/types";
import { cellNumber, type TabDef, type TabRow } from "@/lib/collecte/tabs";

interface Props {
  def: TabDef;
  lignes: CollecteLigne[];
  readOnly: boolean;
  devise: string;
  onSave: (rows: { data: TabRow; ordre: number }[]) => Promise<void>;
  /** mode « complétion récap » : seules les cases marquées ci-dessous sont modifiables */
  recapClient?: boolean;
  /** clés « ordre:col » des cases à compléter */
  highlight?: Set<string>;
  /** le tableau entier est à remplir (manque « tableau non rempli ») */
  wholeEditable?: boolean;
  /** clés « ordre:col » à signaler « ? » sans verrouiller le reste (vue admin) */
  flagged?: Set<string>;
}

export function CollecteGrid({
  def,
  lignes,
  readOnly,
  devise,
  onSave,
  recapClient = false,
  highlight,
  wholeEditable = false,
  flagged,
}: Props) {
  const cellRO = (i: number, key: string) => {
    if (readOnly) return true;
    if (!recapClient || wholeEditable) return false;
    return !highlight?.has(`${i}:${key}`);
  };
  const cellHi = (i: number, key: string) =>
    (recapClient && !wholeEditable && highlight?.has(`${i}:${key}`)) ||
    flagged?.has(`${i}:${key}`);
  const structureLocked = recapClient && !wholeEditable; // pas d'ajout/suppression de lignes
  const initial = useMemo(
    () =>
      [...lignes]
        .sort((a, b) => a.ordre - b.ordre)
        .map((l) => ({ ...l.data }) as TabRow),
    [lignes],
  );
  const [rows, setRows] = useState<TabRow[]>(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => setRows(initial), [initial]);

  const dirty = JSON.stringify(rows) !== JSON.stringify(initial);
  const derived = useMemo(
    () => (def.derive ? def.derive(rows) : rows),
    [rows, def],
  );

  function setCell(i: number, key: string, value: unknown) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  }
  function addRow() {
    setRows((rs) => [...rs, {}]);
  }
  function removeRow(i: number) {
    setRows((rs) => rs.filter((_, idx) => idx !== i));
  }

  async function save() {
    setSaving(true);
    try {
      const out = def.derive ? def.derive(rows) : rows;
      await onSave(out.map((data, ordre) => ({ data, ordre })));
    } finally {
      setSaving(false);
    }
  }

  const symbol = devise === "EUR" ? "€" : devise;

  const total: number | null = def.checklistTotal
    ? def.checklistTotal(derived)
    : def.totalKey
      ? derived.reduce((s, r) => s + cellNumber(r[def.totalKey as string]), 0)
      : null;
  const totalLabel = def.totalLabel ?? "Total";

  return (
    <div className="space-y-3">
      {def.provisional && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Colonnes provisoires — elles seront ajustées aux colonnes exactes de ce
          tableau.
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-10 px-2 py-2 text-left font-medium">#</th>
              {def.columns.map((c) => (
                <th
                  key={c.key}
                  className="px-2 py-2 text-left font-medium"
                  style={{ minWidth: c.width ?? 140 }}
                >
                  {c.label}
                  {c.type === "number" ? ` (${symbol})` : ""}
                </th>
              ))}
              {!readOnly && <th className="w-10 px-2 py-2" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row, i) => (
              <tr key={i} className="hover:bg-muted/20">
                <td className="px-2 py-1.5 text-xs text-muted-foreground">
                  {i + 1}
                </td>
                {def.columns.map((c) => {
                  const shown = String(derived[i]?.[c.key] ?? "");
                  if (c.computed) {
                    return (
                      <td key={c.key} className="px-1.5 py-1">
                        <Input
                          className="h-8 bg-muted/40"
                          value={shown}
                          readOnly
                          tabIndex={-1}
                        />
                      </td>
                    );
                  }
                  const ro = cellRO(i, c.key);
                  const hi = cellHi(i, c.key);
                  return (
                    <td key={c.key} className="px-1.5 py-1">
                      {c.type === "select" ? (
                        <Select
                          value={String(row[c.key] ?? "")}
                          onValueChange={(v) => setCell(i, c.key, v)}
                          disabled={ro}
                        >
                          <SelectTrigger
                            className={cn(
                              "h-8",
                              hi && "ring-1 ring-amber-400 bg-amber-50",
                            )}
                          >
                            <SelectValue placeholder={hi ? "?" : "—"} />
                          </SelectTrigger>
                          <SelectContent>
                            {(c.options ?? []).map((o) => (
                              <SelectItem key={o} value={o}>
                                {o}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          className={cn(
                            "h-8",
                            hi && "ring-1 ring-amber-400 bg-amber-50",
                            ro && !hi && "bg-muted/30",
                          )}
                          type={
                            c.type === "number"
                              ? "number"
                              : c.type === "date"
                                ? "date"
                                : "text"
                          }
                          inputMode={c.type === "number" ? "decimal" : undefined}
                          placeholder={hi ? "?" : undefined}
                          value={String(row[c.key] ?? "")}
                          onChange={(e) =>
                            setCell(
                              i,
                              c.key,
                              c.type === "number"
                                ? e.target.value === ""
                                  ? ""
                                  : Number(e.target.value)
                                : e.target.value,
                            )
                          }
                          readOnly={ro}
                        />
                      )}
                    </td>
                  );
                })}
                {!readOnly && (
                  <td className="px-1.5 py-1">
                    {!structureLocked && (
                      <button
                        onClick={() => removeRow(i)}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title="Supprimer la ligne"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={def.columns.length + (readOnly ? 1 : 2)}
                  className="px-3 py-8 text-center text-sm text-muted-foreground"
                >
                  {readOnly
                    ? "Aucune ligne saisie."
                    : "Aucune ligne. Cliquez sur « Ajouter une ligne »."}
                </td>
              </tr>
            )}
          </tbody>
          {total !== null && rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/30 font-medium">
                <td />
                <td
                  colSpan={def.columns.length - 1}
                  className="px-2 py-2 text-right text-muted-foreground"
                >
                  {totalLabel}
                </td>
                <td className="px-2 py-2">
                  {total.toLocaleString("fr-FR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  {symbol}
                </td>
                {!readOnly && <td />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {def.key === "etat_caisse" && !readOnly && (
        <p className="text-xs text-muted-foreground">
          1ʳᵉ ligne = solde initial : renseignez seulement la colonne « Solde ».
          Les lignes suivantes calculent le solde automatiquement.
        </p>
      )}

      {recapClient && !wholeEditable && (
        <p className="text-xs text-amber-700">
          Le cabinet vous demande de compléter uniquement les cases marquées{" "}
          <span className="font-semibold">?</span>. Les autres sont verrouillées.
        </p>
      )}

      {!readOnly && (
        <div className="flex items-center justify-between">
          {structureLocked ? (
            <span />
          ) : (
            <Button variant="outline" size="sm" onClick={addRow}>
              <Plus className="h-4 w-4" />
              Ajouter une ligne
            </Button>
          )}
          <Button
            variant="ledger"
            size="sm"
            onClick={save}
            disabled={!dirty || saving}
            className={cn(!dirty && "opacity-60")}
          >
            <Save className="h-4 w-4" />
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      )}
    </div>
  );
}

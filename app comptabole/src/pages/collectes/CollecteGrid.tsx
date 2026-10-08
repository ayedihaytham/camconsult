import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
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
  onDirtyChange?: (dirty: boolean) => void;
}

export interface CollecteGridHandle {
  isDirty: () => boolean;
  save: () => Promise<void>;
  discard: () => void;
}

/** Largeur minimale d'une colonne : réduite par rapport à la largeur « confortable »
 * du modèle pour que le tableau tienne à l'écran sans défilement horizontal
 * (les colonnes se répartissent ensuite l'espace disponible). Une date garde
 * la place de « jj/mm/aaaa » + icône. */
const minColWidth = (c: { width?: number; type?: string }) =>
  Math.max(c.type === "date" ? 112 : 84, Math.round((c.width ?? 140) * 0.62));

/** Une ligne dont aucune case saisissable n'est remplie : ajoutée pour écrire dessus, ignorée tant qu'elle reste vide. */
function ligneVide(def: TabDef, row: TabRow) {
  return def.columns.filter((c) => !c.computed).every((c) => String(row[c.key] ?? "").trim() === "");
}

export const CollecteGrid = forwardRef<CollecteGridHandle, Props>(function CollecteGrid({
  def,
  lignes,
  readOnly,
  devise,
  onSave,
  recapClient = false,
  highlight,
  wholeEditable = false,
  flagged,
  onDirtyChange,
}, ref) {
  const cellRO = (i: number, key: string) => {
    if (readOnly) return true;
    if (!recapClient || wholeEditable) return false;
    return !highlight?.has(`${i}:${key}`);
  };
  const cellHi = (i: number, key: string) =>
    (recapClient && !wholeEditable && highlight?.has(`${i}:${key}`)) ||
    flagged?.has(`${i}:${key}`);
  const structureLocked = recapClient && !wholeEditable; // pas d'ajout/suppression de lignes
  const sansLignesVides = (liste: TabRow[]) => JSON.stringify(liste.filter((r) => !ligneVide(def, r)));
  const initial = useMemo(
    () =>
      [...lignes]
        .sort((a, b) => a.ordre - b.ordre)
        .map((l) => ({ ...l.data }) as TabRow),
    [lignes],
  );
  const [rows, setRows] = useState<TabRow[]>(initial);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saved, setSaved] = useState(false);
  // Ligne à qui donner le curseur après l'avoir ajoutée.
  const [focusRow, setFocusRow] = useState<number | null>(null);
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  const baseline = useRef(initial);
  const latestInitial = useRef(initial);

  useEffect(() => {
    latestInitial.current = initial;
    // Store updates from comments/notes must not overwrite an unsaved grid draft.
    if (sansLignesVides(rows) !== sansLignesVides(baseline.current)) return;
    baseline.current = initial;
    setRows(initial);
  }, [initial]);

  const dirty = sansLignesVides(rows) !== sansLignesVides(baseline.current);
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  const derived = useMemo(
    () => (def.derive ? def.derive(rows) : rows),
    [rows, def],
  );

  function setCell(i: number, key: string, value: unknown) {
    setSaved(false);
    setSaveError(false);
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  }
  /** Ajoute une ligne vide à la suite, directement dans le tableau, et y place le curseur. */
  function addRow() {
    setSaved(false);
    setSaveError(false);
    setRows((current) => [...current, Object.fromEntries(def.columns.map((c) => [c.key, ""]))]);
    setFocusRow(rows.length);
  }

  useEffect(() => {
    if (focusRow === null) return;
    const premiere = tbodyRef.current?.querySelector<HTMLElement>(
      `tr[data-row="${focusRow}"] input:not([readonly]), tr[data-row="${focusRow}"] button[role="combobox"]:not([disabled])`,
    );
    premiere?.focus();
    setFocusRow(null);
  }, [focusRow, rows.length]);
  function removeRow(i: number) {
    setSaved(false);
    setSaveError(false);
    setRows((rs) => rs.filter((_, idx) => idx !== i));
  }

  async function save() {
    if (saving) throw new Error("Enregistrement déjà en cours");
    if (!dirty) return;
    setSaving(true);
    setSaveError(false);
    try {
      // Les lignes restées vides ne sont pas enregistrées.
      const kept = rows.filter((r) => !ligneVide(def, r));
      const out = def.derive ? def.derive(kept) : kept;
      await onSave(out.map((data, ordre) => ({ data, ordre })));
      baseline.current = kept;
      latestInitial.current = kept;
      setRows([...kept]);
      setSaved(true);
    } catch (error) {
      setSaveError(true);
      throw error;
    } finally {
      setSaving(false);
    }
  }

  useImperativeHandle(ref, () => ({
    isDirty: () => dirty,
    save,
    discard: () => {
      baseline.current = latestInitial.current;
      setRows(latestInitial.current);
      setSaved(false);
      setSaveError(false);
      onDirtyChange?.(false);
    },
  }));

  const canAdd = !readOnly && !structureLocked;
  const largeurModele = def.columns.reduce((s, c) => s + (c.width ?? 140), 0) || 1;
  const derniereColonne = [...def.columns].reverse().find((c) => !c.computed)?.key;
  const symbol = devise === "EUR" ? "€" : devise === "USD" ? "$" : devise;

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

      {/* Sur grand écran le tableau occupe exactement la largeur disponible, sans défilement horizontal : les colonnes
          se répartissent selon leur largeur de modèle. Sous 1024 px, il garde un défilement de secours. */}
      <div className="overflow-x-auto rounded-lg border border-border lg:overflow-x-visible">
        <table className="w-full text-sm lg:table-fixed">
          <colgroup className="hidden lg:table-column-group">
            <col style={{ width: 40 }} />
            {def.columns.map((c) => (
              <col key={c.key} style={{ width: `calc((100% - ${readOnly ? 40 : 80}px) * ${(c.width ?? 140) / largeurModele})` }} />
            ))}
            {!readOnly && <col style={{ width: 40 }} />}
          </colgroup>
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-10 px-2 py-2 text-left font-medium">#</th>
              {def.columns.map((c) => (
                <th
                  key={c.key}
                  className="px-1.5 py-2 text-left font-medium"
                  style={{ minWidth: minColWidth(c) }}
                >
                  {c.label}
                  {c.type === "number" && !c.label.includes("%") && !/\(.+\)$/.test(c.label)
                    ? ` (${symbol})`
                    : ""}
                </th>
              ))}
              {!readOnly && <th className="w-10 px-2 py-2" />}
            </tr>
          </thead>
          <tbody ref={tbodyRef} className="divide-y divide-border">
            {rows.map((row, i) => (
              <tr key={i} data-row={i} className="hover:bg-muted/20">
                <td className="px-2 py-1.5 text-xs text-muted-foreground">
                  {i + 1}
                </td>
                {def.columns.map((c) => {
                  const shown = String(derived[i]?.[c.key] ?? "");
                  if (c.computed || (def.key === "etat_caisse" && c.key === "solde" && i > 0)) {
                    return (
                      <td key={c.key} className="px-1 py-1">
                        <Input
                          className="h-8 bg-muted/40 px-2 text-[13px]"
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
                    <td key={c.key} className="px-1 py-1">
                      {c.type === "select" ? (
                        <Select
                          value={String(row[c.key] ?? "")}
                          onValueChange={(v) => setCell(i, c.key, v)}
                          disabled={ro}
                        >
                          <SelectTrigger
                            className={cn(
                              "h-8 px-2 text-[13px]",
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
                            "h-8 min-w-0 px-2 text-[13px]",
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
                          step={c.type === "number" ? "any" : undefined}
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
                          onKeyDown={(e) => {
                            // Entrée dans la dernière case de la dernière ligne remplie : ligne suivante.
                            if (e.key === "Enter" && canAdd && i === rows.length - 1 && c.key === derniereColonne && !ligneVide(def, row)) {
                              e.preventDefault();
                              addRow();
                            }
                          }}
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
                  className="px-3 py-3 text-center text-sm text-muted-foreground"
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
                    minimumFractionDigits: 3,
                    maximumFractionDigits: 3,
                  })}{" "}
                  {symbol}
                </td>
                {!readOnly && <td />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {canAdd && (
        <p className="text-xs text-muted-foreground">
          Saisissez directement dans le tableau : <kbd className="rounded border border-border px-1">Entrée</kbd> dans la dernière case ajoute la ligne suivante.
        </p>
      )}

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
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          {structureLocked ? (
            <span />
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="min-h-11 lg:min-h-8"
              onClick={addRow}
            >
              <Plus className="h-4 w-4" />
              Ajouter une ligne
            </Button>
          )}
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 lg:justify-end">
            {dirty && (
              <span role="status" className="w-full text-xs font-medium text-warning lg:w-auto">
                Modifications non enregistrées
              </span>
            )}
            {saveError && (
              <span role="alert" className="w-full text-xs text-destructive lg:w-auto">
                Enregistrement impossible · réessayez
              </span>
            )}
            {saved && !dirty && (
              <span role="status" className="w-full text-xs text-success lg:w-auto">
                Enregistré
              </span>
            )}
            <Button
              data-tour="collecte-save"
              variant="ledger"
              size="sm"
              onClick={() => { void save().catch(() => {}); }}
              disabled={!dirty || saving}
              className={cn(
                "min-h-10 lg:min-h-8",
                !dirty &&
                  "disabled:border-border disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100",
              )}
            >
              <Save className="h-4 w-4" />
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </div>
      )}

    </div>
  );
});

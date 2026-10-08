import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { ChevronDown, FileUp, LoaderCircle, Paperclip, Plus, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { CollecteLigne } from "@/types";
import { cellNumber, repartitionGroupes, type TabDef, type TabRow } from "@/lib/collecte/tabs";
import { TABLEAUX_GRAND_LIVRE } from "@/lib/collecte/grandLivre";
import { ImportDocumentDialog } from "./ImportDocumentDialog";

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
  /** Côté client : la ligne d'un bordereau envoyée par le cabinet (n°, montant, banque, sans chèque) reste telle quelle, et une
   * ligne vierge du même bordereau est proposée dessous pour y saisir les chèques jusqu'au montant. */
  ligneBordereauFigee?: boolean;
  /** Côté client : on modifie les cases et on ajoute des lignes, mais une ligne déjà enregistrée ne se supprime pas. */
  sansSuppression?: boolean;
  /** Envoie un fichier joint à une case « pièce jointe » et renvoie son id et son nom. */
  onJoindre?: (file: File) => Promise<{ id: string; nom: string }>;
  /** Ouvre l'aperçu d'une pièce jointe. */
  onVoirPiece?: (fichierId: string) => void;
}

export interface CollecteGridHandle {
  isDirty: () => boolean;
  save: () => Promise<void>;
  discard: () => void;
  /** Faux tant qu'un groupe de lignes (ex. un bordereau) n'a pas atteint son montant annoncé. */
  isComplete: () => boolean;
  /** Ce qu'il reste à compléter, pour prévenir avant de quitter la section. */
  incompleteMessage: () => string;
}

/** Largeur minimale d'une colonne : réduite par rapport à la largeur « confortable »
 * du modèle pour que le tableau tienne à l'écran sans défilement horizontal
 * (les colonnes se répartissent ensuite l'espace disponible). Une date garde
 * la place de « jj/mm/aaaa » + icône. */
const minColWidth = (c: { width?: number; type?: string }) =>
  Math.max(c.type === "date" ? 112 : 84, Math.round((c.width ?? 140) * 0.62));

/** Une ligne dont aucune case saisissable n'est remplie : ajoutée pour écrire dessus, ignorée tant qu'elle reste vide. */
function ligneVide(def: TabDef, row: TabRow) {
  return def.columns
    .filter((c) => !c.computed)
    .every((c) => String(row[c.key] ?? "").trim() === "" && !(c.piece && row[`${c.key}_fichier`]));
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
  ligneBordereauFigee = false,
  sansSuppression = false,
  onJoindre,
  onVoirPiece,
}, ref) {
  const cellRO = (i: number, key: string) => {
    if (readOnly) return true;
    if (estEntete(i)) return true;
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
  const [focusCol, setFocusCol] = useState<string | null>(null);
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
  /** Ajoute une ligne à la suite, directement dans le tableau, et y place le curseur. Dans un groupe qui n'a pas
   * encore atteint son montant (un bordereau), la ligne reprend la date, le n° et la banque du groupe. `nouveau` force une ligne
   * vierge : le début d'un autre bordereau, même si le précédent n'est pas terminé. */
  function addRow(groupeId?: string, nouveau = false) {
    setSaved(false);
    setSaveError(false);
    const vide = Object.fromEntries(def.columns.map((c) => [c.key, ""]));
    const g = def.groupe;
    const cible =
      g &&
      !nouveau &&
      (groupeId
        ? groupes.find((x) => x.id === groupeId)
        : (() => {
            const derniere = rows[rows.length - 1];
            const id = derniere ? String(derniere[g.cle] ?? "").trim().toLowerCase() : "";
            const trouve = groupes.find((x) => x.id === id);
            return trouve && !trouve.complet ? trouve : undefined;
          })());
    if (g && cible) {
      const modele = [...rows].reverse().find((r) => String(r[g.cle] ?? "").trim().toLowerCase() === cible.id);
      for (const k of g.prefill) vide[k] = String(modele?.[k] ?? "");
    }
    setRows((current) => [...current, vide]);
    setFocusRow(rows.length);
    // Ligne d'un bordereau en cours : le curseur va à la première case propre au chèque.
    setFocusCol(g && cible ? (def.columns.find((c) => !c.computed && !g.prefill.includes(c.key) && c.key !== g.totalCol)?.key ?? null) : null);
  }

  useEffect(() => {
    if (focusRow === null) return;
    const champs = Array.from(
      tbodyRef.current?.querySelectorAll<HTMLElement>(
        `tr[data-row="${focusRow}"] input:not([readonly]), tr[data-row="${focusRow}"] button[role="combobox"]:not([disabled])`,
      ) ?? [],
    );
    const voulue = focusCol ? champs.find((el) => el.dataset.col === focusCol) : undefined;
    const premiere = voulue ?? champs.find((el) => el instanceof HTMLInputElement && el.value === "") ?? champs[0];
    premiere?.focus();
    setFocusRow(null);
    setFocusCol(null);
  }, [focusRow, rows.length]);
  /** Modifie plusieurs cases d'une ligne d'un coup (ex. le fichier joint et son nom). */
  function setCells(i: number, patch: Record<string, unknown>) {
    setSaved(false);
    setSaveError(false);
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  const [importOpen, setImportOpen] = useState(false);
  const [envoi, setEnvoi] = useState<string | null>(null);
  async function joindre(i: number, key: string, file: File) {
    if (!onJoindre) return;
    setEnvoi(`${i}:${key}`);
    try {
      const { id, nom } = await onJoindre(file);
      setCells(i, { [`${key}_fichier`]: id, [`${key}_fichier_nom`]: nom });
    } catch {
      // l'erreur est déjà affichée par l'appelant : la case reste inchangée
    } finally {
      setEnvoi(null);
    }
  }
  /** Ajoute à la suite les lignes d'un document importé ; les lignes restées vides sont remplacées. */
  function addRows(nouvelles: TabRow[]) {
    if (nouvelles.length === 0) return;
    setSaved(false);
    setSaveError(false);
    const vide = Object.fromEntries(def.columns.map((c) => [c.key, ""]));
    setRows((courantes) => [...courantes.filter((r) => !ligneVide(def, r)), ...nouvelles.map((r) => ({ ...vide, ...r }))]);
  }
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

  const groupes = useMemo(() => repartitionGroupes(def, rows), [def, rows]);

  /** Ligne d'en-tête de bordereau reçue du cabinet : enregistrée, avec le montant du bordereau et sans chèque. */
  function estEntete(i: number): boolean {
    const g = def.groupe;
    const r = rows[i];
    if (!ligneBordereauFigee || !g || !r || !baseline.current.includes(r)) return false;
    return (
      String(r[g.cle] ?? "").trim() !== "" &&
      cellNumber(r[g.totalCol]) > 0 &&
      String(r[g.montantCol] ?? "").trim() === ""
    );
  }

  /** N° affiché d'une ligne : la ligne d'en-tête envoyée par le cabinet n'en a pas, les chèques sont numérotés 1, 2, 3… */
  function numeroLigne(i: number): number | string {
    if (!ligneBordereauFigee) return i + 1;
    if (estEntete(i)) return "";
    let n = 0;
    for (let k = 0; k <= i; k++) if (!estEntete(k)) n += 1;
    return n;
  }

  // À l'ouverture, un bordereau dont seule l'en-tête existe reçoit une ligne vierge (date, n° et banque repris) pour saisir ses chèques.
  useEffect(() => {
    const g = def.groupe;
    if (!ligneBordereauFigee || !g || readOnly) return;
    if (sansLignesVides(rows) !== sansLignesVides(baseline.current)) return;
    const manquantes = repartitionGroupes(def, rows).filter((x) => x.reparti === 0 && x.reste > 0 && x.nbLignes === 1);
    if (manquantes.length === 0) return;
    const ajoutees = manquantes.map((x) => {
      const modele = rows.find((r) => String(r[g.cle] ?? "").trim().toLowerCase() === x.id);
      const vide: TabRow = Object.fromEntries(def.columns.map((c) => [c.key, ""]));
      for (const k of g.prefill) vide[k] = String(modele?.[k] ?? "");
      return vide;
    });
    // Ces lignes font partie de l'état de départ : ouvrir le tableau ne le rend pas « modifié ».
    baseline.current = [...baseline.current, ...ajoutees];
    setRows((r) => [...r, ...ajoutees]);
  }, [rows, def, ligneBordereauFigee, readOnly]);
  const symboleGroupe = devise === "EUR" ? "€" : devise === "USD" ? "$" : devise;
  const montantFr = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  useImperativeHandle(ref, () => ({
    isComplete: () => groupes.every((g) => g.complet),
    incompleteMessage: () =>
      groupes
        .filter((g) => !g.complet)
        .map((g) =>
          g.reste > 0
            ? `${def.groupe?.libelle ?? "Groupe"} ${g.nom} : il reste ${montantFr(g.reste)} ${symboleGroupe} à répartir`
            : `${def.groupe?.libelle ?? "Groupe"} ${g.nom} : dépassé de ${montantFr(-g.reste)} ${symboleGroupe}`,
        )
        .join(" · "),
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

  /** « Ajouter une ligne » : dans un tableau à bordereaux, on choisit entre un NOUVEAU bordereau et une ligne de plus dans
   * un bordereau existant (un chèque de plus, qui reprend sa date, son n° et sa banque). */
  function ajoutLigne() {
    const nom = def.groupe?.libelle.toLowerCase() ?? "groupe";
    if (!def.groupe || groupes.length === 0) {
      return (
        <Button variant="outline" size="sm" className="min-h-11 lg:min-h-8" onClick={() => addRow()}>
          <Plus className="h-4 w-4" />
          Ajouter une ligne
        </Button>
      );
    }
    return (
      <>
        <Button variant="outline" size="sm" className="min-h-11 lg:min-h-8" onClick={() => addRow(undefined, true)}>
          <Plus className="h-4 w-4" />
          Nouveau {nom}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="min-h-11 lg:min-h-8">
              <Plus className="h-4 w-4" />
              Ajouter à un {nom}
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-72 overflow-auto">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Une ligne de plus dans…</DropdownMenuLabel>
            {groupes.map((g) => (
              <DropdownMenuItem key={g.id} onSelect={() => addRow(g.id)}>
                <span className="font-semibold">{g.nom}</span>
                <span className="ml-3 text-xs text-muted-foreground">
                  {g.complet ? "complet" : g.reste > 0 ? `reste ${montantFr(g.reste)} ${symboleGroupe}` : `dépassé de ${montantFr(-g.reste)} ${symboleGroupe}`}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    );
  }

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
                  {numeroLigne(i)}
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
                            data-col={c.key}
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
                      ) : c.piece ? (
                        <div className="relative">
                          <Input
                            data-col={c.key}
                            className={cn(
                              "h-8 min-w-0 px-2 pr-14 text-[13px]",
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
                          <span className="absolute inset-y-0 right-1 flex items-center gap-0.5">
                            {row[`${c.key}_fichier`] ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => onVoirPiece?.(String(row[`${c.key}_fichier`]))}
                                  className="rounded p-1 text-success hover:bg-success/10"
                                  title={`Voir la pièce jointe : ${String(row[`${c.key}_fichier_nom`] ?? "")}`}
                                  aria-label={`Voir la pièce jointe de la ligne ${i + 1}`}
                                >
                                  <Paperclip className="h-4 w-4" />
                                </button>
                                {!ro && (
                                  <button
                                    type="button"
                                    onClick={() => setCells(i, { [`${c.key}_fichier`]: "", [`${c.key}_fichier_nom`]: "" })}
                                    className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                    title="Retirer la pièce jointe de cette ligne"
                                    aria-label={`Retirer la pièce jointe de la ligne ${i + 1}`}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </>
                            ) : (
                              !ro &&
                              onJoindre && (
                                <label
                                  className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground focus-within:ring-2 focus-within:ring-ring"
                                  title="Joindre un fichier (scan, PDF)"
                                >
                                  {envoi === `${i}:${c.key}` ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                                  <input
                                    type="file"
                                    accept="image/*,.pdf,application/pdf"
                                    aria-label={`Joindre un fichier à la ligne ${i + 1}`}
                                    className="sr-only"
                                    disabled={envoi !== null}
                                    onChange={(e) => {
                                      const fichier = e.target.files?.[0];
                                      e.target.value = "";
                                      if (fichier) void joindre(i, c.key, fichier);
                                    }}
                                  />
                                </label>
                              )
                            )}
                          </span>
                        </div>
                      ) : (
                        <Input
                          data-col={c.key}
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
                    {!structureLocked && !estEntete(i) && !(sansSuppression && i < baseline.current.length) && (
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

      {groupes.length > 0 && (
        <div data-tour="collecte-repartition" className="space-y-2 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Répartition par {def.groupe?.libelle.toLowerCase()} : saisissez les lignes jusqu'à atteindre le montant
          </p>
          {groupes.map((g) => (
            <div key={g.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
              <span className="min-w-[8rem] font-semibold text-foreground">
                {def.groupe?.libelle} {g.nom}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {montantFr(g.reparti)} / {montantFr(g.total)} {symboleGroupe} · {g.nbLignes} ligne{g.nbLignes > 1 ? "s" : ""}
              </span>
              <span
                role="progressbar"
                aria-label={`${def.groupe?.libelle} ${g.nom}`}
                aria-valuemin={0}
                aria-valuemax={g.total}
                aria-valuenow={Math.min(g.reparti, g.total)}
                className="h-1.5 w-32 overflow-hidden rounded-full bg-border"
              >
                <span
                  className={cn("block h-full rounded-full", g.complet ? "bg-success" : g.reste < 0 ? "bg-destructive" : "bg-warning")}
                  style={{ width: `${Math.min(100, Math.round((g.reparti / g.total) * 100))}%` }}
                />
              </span>
              <span className={cn("text-xs font-semibold", g.complet ? "text-success" : g.reste < 0 ? "text-destructive" : "text-warning")}>
                {g.complet ? "Complet" : g.reste < 0 ? `Dépassé de ${montantFr(-g.reste)}` : `Reste ${montantFr(g.reste)}`}
              </span>
              {canAdd && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-8"
                  title={g.complet ? `Ce ${def.groupe?.libelle.toLowerCase()} a atteint son montant : une ligne de plus le fera dépasser, pensez à revoir le montant.` : undefined}
                  onClick={() => addRow(g.id)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {g.complet ? `Ajouter un chèque à ce ${def.groupe?.libelle.toLowerCase()}` : `Ajouter une ligne à ce ${def.groupe?.libelle.toLowerCase()}`}
                </Button>
              )}
            </div>
          ))}
          {canAdd && (
            <div className="flex flex-wrap items-center gap-2 border-t border-border/70 pt-2">
              <Button type="button" variant="outline" size="sm" className="min-h-8" onClick={() => addRow(undefined, true)}>
                <Plus className="h-3.5 w-3.5" />
                Commencer un nouveau {def.groupe?.libelle.toLowerCase()}
              </Button>
              <span className="text-xs text-muted-foreground">
                Ajouter à un {def.groupe?.libelle.toLowerCase()} existant garde sa date, son n° et sa banque ; un nouveau {def.groupe?.libelle.toLowerCase()} démarre une ligne vierge.
              </span>
            </div>
          )}
        </div>
      )}

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
          <div className="flex flex-wrap items-center gap-2">
            {structureLocked ? <span /> : ajoutLigne()}
            {!structureLocked && TABLEAUX_GRAND_LIVRE[def.key] && (
              <Button variant="outline" size="sm" className="min-h-11 lg:min-h-8" onClick={() => setImportOpen(true)}>
                <FileUp className="h-4 w-4" />
                Importer un document
              </Button>
            )}
          </div>
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

      {canAdd && TABLEAUX_GRAND_LIVRE[def.key] && (
        <ImportDocumentDialog open={importOpen} onOpenChange={setImportOpen} def={def} devise={devise} onAjouter={addRows} />
      )}
    </div>
  );
});

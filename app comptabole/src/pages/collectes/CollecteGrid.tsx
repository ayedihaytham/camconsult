import { Fragment, forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronRight, FileUp, LoaderCircle, MoreHorizontal, Paperclip, Plus, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
import { cellNumber, repartitionGroupes, type TabDef, type TabRow } from "@/lib/collecte/tabs";
import { TABLEAUX_GRAND_LIVRE } from "@/lib/collecte/grandLivre";
import { plageNumeros } from "@/lib/collecte/souche";
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
  /** Case précise à reprendre depuis le récap; un tableau vide ouvre sa première ligne de saisie. */
  focusTarget?: { ordre: number | null; col: string | null; revision: number };
  /** Enregistrement explicite du cabinet suivi du récap ; l'auto-enregistrement conserve sa destination. */
  saveAndContinue?: () => Promise<void>;
  continueLabel?: string;
  /** Circuit du tableau, conservé à portée de main dans la même barre fixe. */
  workflowActions?: ReactNode;
  /** Exports de ce tableau fournis par la page (aucune logique de téléchargement dupliquée ici). */
  exportActions?: ReactNode;
}

export interface CollecteGridHandle {
  isDirty: () => boolean;
  save: () => Promise<void>;
  discard: () => void;
  /** Faux tant qu'un groupe de lignes (ex. un bordereau) n'a pas atteint son montant annoncé. */
  isComplete: () => boolean;
  /** Ce qu'il reste à compléter, pour prévenir avant de quitter la section. */
  incompleteMessage: () => string;
  /** Nature de l'écart : montant pas encore atteint (`manque`) et/ou dépassé (`depasse`, souvent une faute de frappe). */
  ecart: () => { manque: boolean; depasse: boolean };
  /** Ajoute des lignes au tableau (à enregistrer ensuite), comme si on les avait saisies. */
  ajouterLignes: (lignes: TabRow[]) => void;
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
  focusTarget,
  saveAndContinue,
  continueLabel = "Enregistrer et vérifier",
  workflowActions,
  exportActions,
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
   * encore atteint son montant (un bordereau), la ligne reprend la date, le n° et la banque du groupe.
   * La création explicite d'un nouveau bordereau n'est pas proposée dans cette interface. */
  function addRow(groupeId?: string) {
    // Une ligne vierge est déjà en bas du tableau : on y place le curseur au lieu d'en empiler d'autres.
    const derniere = rows[rows.length - 1];
    if (!groupeId && derniere && ligneVide(def, derniere)) {
      setFocusRow(rows.length - 1);
      setFocusCol(null);
      return;
    }
    // Même chose dans un bordereau : sa dernière ligne attend encore son chèque, c'est elle qu'on remplit.
    const gr = def.groupe;
    if (gr && groupeId) {
      const idx = rows.map((r) => idLigne(r)).lastIndexOf(groupeId);
      const r = idx >= 0 ? rows[idx] : null;
      const attend =
        r !== null &&
        !estEnteteBordereau(idx) &&
        // La première ligne d'un bordereau porte son numéro : Entrée y ajoute le chèque suivant au lieu de la rouvrir.
        rows.findIndex((x) => idLigne(x) === groupeId) !== idx &&
        def.columns
          .filter((c) => !c.computed && !gr.prefill.includes(c.key) && c.key !== gr.totalCol)
          .every((c) => String(r[c.key] ?? "").trim() === "" && !(c.piece && r[`${c.key}_fichier`]));
      if (attend) {
        setOuverts((o) => new Set(o).add(groupeId));
        setFocusRow(idx);
        setFocusCol(def.columns.find((c) => !c.computed && !gr.prefill.includes(c.key) && c.key !== gr.totalCol)?.key ?? null);
        return;
      }
    }
    setSaved(false);
    setSaveError(false);
    const vide = Object.fromEntries(def.columns.map((c) => [c.key, ""]));
    const g = def.groupe;
    const cible =
      g &&
      (groupeId
        ? groupes.find((x) => x.id === groupeId)
        : (() => {
            const derniere = rows[rows.length - 1];
            const id = derniere ? String(derniere[g.cle] ?? "").trim().toLowerCase() : "";
            const trouve = groupes.find((x) => x.id === id);
            return trouve;
          })());
    const idDuBordereau = groupeId || cible?.id;
    if (g && idDuBordereau) {
      // Même sans montant annoncé, Entrée continue le groupe saisi et ne crée pas de bordereau vide.
      // Une ligne ajoutée à un bordereau terminé (replié) le déplie.
      if (cible?.complet) setOuverts((o) => new Set(o).add(cible.id));
      const modele = [...rows].reverse().find((r) => String(r[g.cle] ?? "").trim().toLowerCase() === idDuBordereau);
      for (const k of g.prefill) vide[k] = String(modele?.[k] ?? "");
    }
    setRows((current) => [...current, vide]);
    setFocusRow(rows.length);
    // Ligne d'un groupe en cours : le curseur va à la première case propre au chèque / à la traite.
    setFocusCol(g && idDuBordereau ? (def.columns.find((c) => !c.computed && !g.prefill.includes(c.key) && c.key !== g.totalCol)?.key ?? null) : null);
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
  // Bordereaux terminés dont les lignes sont dépliées par l'utilisateur (les autres sont repliés sur une seule ligne).
  const [ouverts, setOuverts] = useState<Set<string>>(new Set());
  const [plageDebut, setPlageDebut] = useState("");
  const [plageFin, setPlageFin] = useState("");
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

  /** Ligne d'en-tête d'un bordereau : n° et montant du bordereau, sans montant de chèque. Elle n'a pas de n° de ligne. */
  function estEnteteBordereau(i: number): boolean {
    const g = def.groupe;
    const r = rows[i];
    if (!g || !r) return false;
    return (
      String(r[g.cle] ?? "").trim() !== "" &&
      cellNumber(r[g.totalCol]) > 0 &&
      String(r[g.montantCol] ?? "").trim() === ""
    );
  }

  /** Cette même ligne, telle que le cabinet l'a envoyée au client : enregistrée, donc figée côté client. */
  function estEntete(i: number): boolean {
    const r = rows[i];
    return ligneBordereauFigee && Boolean(r) && baseline.current.includes(r) && estEnteteBordereau(i);
  }

  /** Bordereaux terminés : repliés sur une seule ligne dès qu'on passe à un autre bordereau (ou qu'il y en a plusieurs), dépliables en détail. */
  const idLigne = (r: TabRow) => (def.groupe ? String(r[def.groupe.cle] ?? "").trim().toLowerCase() : "");
  const terminesIds = new Set(groupes.filter((x) => x.complet).map((x) => x.id));
  const repliables = groupes.length >= 2 || rows.some((r) => !terminesIds.has(idLigne(r))) ? terminesIds : new Set<string>();
  function replie(i: number): { id: string; premier: boolean; ouvert: boolean } | null {
    const id = idLigne(rows[i]);
    if (!id || !repliables.has(id)) return null;
    return { id, premier: rows.findIndex((r) => idLigne(r) === id) === i, ouvert: ouverts.has(id) };
  }
  function basculer(id: string) {
    setOuverts((s) => {
      const suite = new Set(s);
      if (!suite.delete(id)) suite.add(id);
      return suite;
    });
  }

  useEffect(() => {
    if (!focusTarget) return;
    if (focusTarget.ordre === null) {
      if (!readOnly && !structureLocked && rows.length === 0) addRow();
      return;
    }
    const groupId = rows[focusTarget.ordre] ? idLigne(rows[focusTarget.ordre]) : "";
    if (groupId && repliables.has(groupId)) {
      setOuverts((current) => current.has(groupId) ? current : new Set(current).add(groupId));
    }
  // A revision allows the same requested cell to be focused again after the user returns to the recap.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTarget?.revision]);

  useEffect(() => {
    if (!focusTarget) return;
    const timer = window.setTimeout(() => {
      const row = focusTarget.ordre ?? 0;
      const column = focusTarget.col?.replace(/["\\]/g, "\\$&");
      const selector = column
        ? `tr[data-row="${row}"] [data-col="${column}"]`
        : `tr[data-row="${row}"] input:not([readonly]), tr[data-row="${row}"] button[role="combobox"]`;
      const field = tbodyRef.current?.querySelector<HTMLElement>(selector) ??
        tbodyRef.current?.querySelector<HTMLElement>("input:not([readonly]), button[role=combobox]:not([disabled])");
      if (!field) return;
      field.focus();
      field.scrollIntoView?.({ block: "center", inline: "nearest" });
    });
    return () => window.clearTimeout(timer);
  }, [focusTarget, ouverts, rows.length]);

  /** N° affiché d'une ligne : la ligne d'en-tête d'un bordereau n'en a pas, les chèques sont numérotés 1, 2, 3… */
  function numeroLigne(i: number): number | string {
    if (!def.groupe) return i + 1;
    if (estEnteteBordereau(i)) return "";
    let n = 0;
    for (let k = 0; k <= i; k++) if (!estEnteteBordereau(k)) n += 1;
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
    ecart: () => ({ manque: groupes.some((g) => g.reste > 0), depasse: groupes.some((g) => g.reste < 0) }),
    isDirty: () => dirty,
    ajouterLignes: addRows,
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

  /** Dans les tableaux groupés, l'action générale sert uniquement au premier bordereau ;
   * les chèques/traites suivants sont ajoutés dans le groupe concerné depuis la barre de suivi. */
  function ajoutLigne() {
    return (
      <Button type="button" variant="outline" size="sm" className="min-h-11 shrink-0 gap-1.5 sm:min-h-9" onClick={() => addRow()}>
        <Plus className="size-4" aria-hidden="true" /> Ajouter une ligne
      </Button>
    );
  }

  const total: number | null = def.checklistTotal
    ? def.checklistTotal(derived)
    : def.totalKey
      ? derived.reduce((s, r) => s + cellNumber(r[def.totalKey as string]), 0)
      : null;
  const totalLabel = def.totalLabel ?? "Total";

  return (
    <fieldset disabled={saving} className="min-w-0 space-y-3" aria-label={`Saisie de ${def.label}`}>
      {def.provisional && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Colonnes provisoires — elles seront ajustées aux colonnes exactes de ce
          tableau.
        </p>
      )}

      {/* Le suivi et les actions sont réunis dans une seule barre sticky. La création
          d'un nouveau bordereau n'est pas exposée : on continue les groupes existants. */}
      {(groupes.length > 0 || !readOnly || exportActions || workflowActions) && (
        <section
          data-tour="collecte-sticky-tools"
          aria-label="Suivi et actions du tableau"
          className="sticky top-0 z-30 rounded-lg border border-border bg-card shadow-[0_7px_22px_-15px_rgba(11,37,69,0.4)]"
        >
          {groupes.length > 0 && (
            <div
              data-tour="collecte-repartition"
              aria-label="Avancement des bordereaux"
              className="flex min-w-0 gap-2 overflow-x-auto border-b border-border bg-muted/30 px-3 py-2 md:px-4"
            >
              {groupes.map((g) => {
                const pourcentage = g.total > 0 ? Math.min(100, Math.max(0, (g.reparti / g.total) * 100)) : 0;
                return (
                  <div
                    key={g.id}
                    className={cn(
                      "flex items-center gap-3",
                      groupes.length === 1
                        ? "min-w-0 w-full flex-1 flex-wrap px-0.5 py-0.5 sm:flex-nowrap"
                        : "min-w-[280px] flex-1 rounded-md border border-border/80 bg-card px-3 py-2 lg:max-w-[420px]",
                    )}
                  >
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                        <span className="min-w-0 truncate text-sm font-semibold text-foreground" title={`${def.groupe?.libelle} ${g.nom}`}>
                          {def.groupe?.libelle} {g.nom}
                        </span>
                        <span
                          className={cn(
                            "shrink-0 text-xs font-semibold",
                            g.complet ? "text-success" : g.reste < 0 ? "text-destructive" : "text-warning",
                          )}
                        >
                          {g.complet ? "Complet" : g.reste < 0 ? `Dépassé de ${montantFr(-g.reste)} ${symboleGroupe}` : `Reste ${montantFr(g.reste)} ${symboleGroupe}`}
                        </span>
                      </div>
                      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
                        <span className="min-w-0 text-xs tabular-nums text-muted-foreground">
                          {montantFr(g.reparti)} / {montantFr(g.total)} {symboleGroupe}
                          <span className="ml-2 text-muted-foreground/70"> · {g.nbLignes} ligne{g.nbLignes > 1 ? "s" : ""}</span>
                        </span>
                        <div
                          role="progressbar"
                          aria-label={`Montant réparti : ${def.groupe?.libelle} ${g.nom}`}
                          aria-valuemin={0}
                          aria-valuemax={Math.max(0, g.total)}
                          aria-valuenow={Math.min(Math.max(0, g.reparti), Math.max(0, g.total))}
                          className="h-1.5 min-w-[64px] flex-1 overflow-hidden rounded-full bg-border"
                        >
                          <div
                            className={cn("h-full rounded-full transition-[width] duration-200", g.complet ? "bg-success" : g.reste < 0 ? "bg-destructive" : "bg-warning")}
                            style={{ width: `${pourcentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    {canAdd && groupes.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="size-9 shrink-0 border-primary/20 bg-card p-0 text-primary hover:bg-secondary"
                        onClick={() => addRow(g.id)}
                        aria-label={`${def.groupe?.ajout} à ce ${def.groupe?.libelle.toLowerCase()} ${g.nom}`}
                        title={`${def.groupe?.ajout}${g.complet ? " — vérifiez le montant après l'ajout" : ""}`}
                      >
                        <Plus className="size-4" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {(!readOnly || exportActions) && <div aria-label="Commandes du tableau" className="flex min-w-0 items-center gap-1.5 px-2 py-2 sm:px-3 md:px-4">
              {canAdd && (def.plageNumeros && rows.length === 0 ? null : groupes.length === 0 ? ajoutLigne() : null)}
              {canAdd && groupes.length === 1 && (
                <Button type="button" variant="outline" size="sm" className="min-h-11 shrink-0 gap-1.5 sm:min-h-9"
                  aria-label={`${def.groupe?.ajout} à ce ${def.groupe?.libelle.toLowerCase()} ${groupes[0].nom}`}
                  title={`${def.groupe?.ajout} à ce ${def.groupe?.libelle.toLowerCase()} ${groupes[0].nom}`}
                  onClick={() => addRow(groupes[0].id)}>
                  <Plus className="size-4" aria-hidden="true" />{def.groupe?.ajout}
                </Button>
              )}
              {canAdd && TABLEAUX_GRAND_LIVRE[def.key] && (
                <Button type="button" variant="outline" size="icon" aria-label="Importer un document" title="Importer un document" className="size-11 shrink-0 sm:size-9" onClick={() => setImportOpen(true)}>
                  <FileUp className="size-4" aria-hidden="true" />
                </Button>
              )}
              {exportActions && (
                <div data-tour="collecte-export-sticky" className="shrink-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="outline" size="icon" className="size-11 sm:size-9" aria-label="Exporter le tableau" title="Excel, PDF et impression" disabled={saving}>
                        <MoreHorizontal className="size-4" aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-40 rounded-md">
                      {exportActions}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
              {!readOnly && (
                  <Button
                    data-tour="collecte-save"
                    variant="ledger"
                    size="icon"
                    aria-label={saving ? "Enregistrement…" : saveAndContinue ? continueLabel : "Enregistrer"}
                    title={saveError ? "Enregistrement impossible : réessayez" : saving ? "Enregistrement…" : saveAndContinue ? continueLabel : "Enregistrer"}
                    className={cn("size-11 shrink-0 sm:size-9", saveError && "border border-destructive bg-destructive/10 text-destructive hover:bg-destructive/15", !dirty && !saveAndContinue && "disabled:border-border disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100")}
                    onClick={() => { void (saveAndContinue ? saveAndContinue() : save()).catch(() => {}); }}
                    disabled={saving || (!dirty && !saveAndContinue)}
                  >
                    {saving ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
                  </Button>
              )}
              {saveError && <span role="alert" className="sr-only min-w-0 text-xs font-medium text-destructive sm:not-sr-only sm:truncate">Échec de l'enregistrement</span>}
              {!saveError && dirty && <span role="status" className="sr-only min-w-0 text-xs font-medium text-warning sm:not-sr-only sm:truncate">Non enregistré</span>}
              {!dirty && saved && !saveError && <span role="status" className="sr-only min-w-0 text-xs text-success sm:not-sr-only sm:truncate">Enregistré</span>}
          </div>}
          {workflowActions && <div className={cn((!readOnly || exportActions || groupes.length > 0) && "border-t border-border")}>{workflowActions}</div>}
        </section>
      )}
      {canAdd && def.plageNumeros && rows.length === 0 && (() => {
        const plage = plageNumeros(plageDebut, plageFin);
        const saisi = plageDebut.trim() !== "" && plageFin.trim() !== "";
        const nom = def.plageNumeros.libelle;
        return (
          <div data-tour="collecte-plage" className="space-y-2 rounded-lg border border-accent/40 bg-accent/5 px-3 py-3">
            <p className="text-sm font-semibold text-foreground">Avant de saisir : les numéros de votre souche</p>
            <p className="text-xs text-muted-foreground">
              Indiquez le premier et le dernier numéro de {nom} à remplir : une ligne est créée pour chaque numéro, vous n'avez plus qu'à compléter les autres cases.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <label className="space-y-1 text-xs font-medium text-foreground">
                N° du premier {nom}
                <Input className="h-10 w-44" value={plageDebut} onChange={(e) => setPlageDebut(e.target.value)} placeholder="ex. 4001001" inputMode="text" />
              </label>
              <label className="space-y-1 text-xs font-medium text-foreground">
                N° du dernier {nom}
                <Input className="h-10 w-44" value={plageFin} onChange={(e) => setPlageFin(e.target.value)} placeholder="ex. 4001025" inputMode="text" />
              </label>
              <Button
                type="button"
                variant="ledger"
                className="min-h-10"
                disabled={!plage.ok}
                onClick={() => {
                  if (!plage.ok) return;
                  const col = def.plageNumeros!.col;
                  addRows(plage.numeros.map((n) => ({ [col]: n })));
                  setFocusRow(0);
                }}
              >
                {plage.ok ? `Créer ${plage.numeros.length} ligne${plage.numeros.length > 1 ? "s" : ""}` : "Créer les lignes"}
              </Button>
            </div>
            {saisi && !plage.ok && (
              <p role="alert" className="text-xs text-destructive">
                {plage.erreur}
              </p>
            )}
          </div>
        );
      })()}

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
            {rows.map((row, i) => {
              const repli = replie(i);
              if (repli && !repli.ouvert && !repli.premier) return null;
              const resume = repli?.premier ? groupes.find((x) => x.id === repli.id) : undefined;
              return (
              <Fragment key={i}>
              {repli?.premier && resume && (
                <tr data-bordereau={repli.id} className="bg-secondary/40">
                  <td colSpan={def.columns.length + (readOnly ? 1 : 2)} className="px-2 py-1.5">
                    <button
                      type="button"
                      onClick={() => basculer(repli.id)}
                      aria-expanded={repli.ouvert}
                      aria-label={`${repli.ouvert ? "Replier" : "Détail du"} ${def.groupe?.libelle.toLowerCase()} ${resume.nom}`}
                      className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-md px-1 py-1 text-left text-sm hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <ChevronRight className={cn("size-4 shrink-0 text-muted-foreground transition-transform", repli.ouvert && "rotate-90")} aria-hidden="true" />
                      <span className="min-w-[8rem] font-semibold text-foreground">
                        {def.groupe?.libelle} {resume.nom}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {resume.nbLignes} ligne{resume.nbLignes > 1 ? "s" : ""} · {montantFr(resume.reparti)} {symboleGroupe}
                      </span>
                      <span className="text-xs font-semibold text-success">Complet</span>
                      <span className="ml-auto text-xs font-medium text-primary underline underline-offset-2">{repli.ouvert ? "Replier" : "Voir le détail"}</span>
                    </button>
                  </td>
                </tr>
              )}
              {(!repli || repli.ouvert) && (
              <tr data-row={i} className="hover:bg-muted/20">
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
                                addRow(def.groupe ? idLigne(row) || undefined : undefined);
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
                              addRow(def.groupe ? idLigne(row) || undefined : undefined);
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
              )}
              </Fragment>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={def.columns.length + (readOnly ? 1 : 2)}
                  className="px-3 py-3 text-center text-sm text-muted-foreground"
                >
                  {readOnly
                    ? "Aucune ligne saisie."
                    : def.plageNumeros && canAdd
                      ? `Indiquez ci-dessus les numéros de la souche : une ligne sera créée par ${def.plageNumeros.libelle}.`
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



      {canAdd && TABLEAUX_GRAND_LIVRE[def.key] && (
        <ImportDocumentDialog open={importOpen} onOpenChange={setImportOpen} def={def} devise={devise} onAjouter={addRows} />
      )}
    </fieldset>
  );
});

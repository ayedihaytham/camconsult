import { useEffect, useId, useState, type ReactNode } from "react";
import { ArrowUpRight, CheckCircle2, LoaderCircle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import type { ChecklistRow } from "@/lib/collecte/checklist";

export interface SuiviPatch {
  recuManuel?: boolean;
  dateSuivi?: string | null;
  totalSaisi?: number | null;
}

interface Props {
  rows: ChecklistRow[];
  devise: string;
  editable: boolean;
  onSelectTab: (key: string) => void;
  onSaveComment: (key: string, value: string) => Promise<void>;
  /** Pièce cochée « reçue », date de suivi ou total saisi : enregistré tout de suite. */
  onSaveSuivi?: (key: string, patch: SuiviPatch) => Promise<void>;
  /** « Tout marquer comme reçu » : les pièces encore en attente passent toutes à reçues. */
  onMarkAll?: (keys: string[]) => Promise<void>;
  /** Exports (Excel, PDF, Imprimer) placés à côté des actions. */
  exports?: ReactNode;
  /** Message affiché quand la liste n'est pas modifiable (collecte validée, archivée…). */
  notice?: string;
}

function Comment({
  row,
  editable,
  onSave,
}: {
  row: ChecklistRow;
  editable: boolean;
  onSave: (value: string) => Promise<void>;
}) {
  const isMobile = useIsMobile();
  const textareaId = useId();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(row.commentaire);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const hasComment = Boolean(row.commentaire.trim());

  useEffect(() => {
    if (!open) setValue(row.commentaire);
  }, [row.commentaire, open]);

  function closeEditor() {
    if (saving) return;
    setValue(row.commentaire);
    setError(false);
    setOpen(false);
  }

  async function save() {
    if (saving) return;
    if (value === row.commentaire) {
      closeEditor();
      return;
    }
    setSaving(true);
    setError(false);
    try {
      await onSave(value);
      setOpen(false);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  if (!editable)
    return (
      <span className="text-muted-foreground">{row.commentaire || "—"}</span>
    );

  const editorTitle = hasComment
    ? "Modifier le commentaire"
    : "Ajouter un commentaire";
  const editorContext = (
    <>
      <span className="block">{row.pieceLabel}</span>
      <span className="block">{row.tabLabel}</span>
    </>
  );
  const commentField = (
    <div className="space-y-2">
      <Label htmlFor={textareaId}>Commentaire</Label>
      <Textarea
        id={textareaId}
        className="min-h-28 resize-y"
        value={value}
        disabled={saving}
        onChange={(event) => {
          setValue(event.target.value);
          setError(false);
        }}
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          Commentaire non enregistré. Vérifiez votre connexion puis réessayez.
        </p>
      )}
    </div>
  );
  const actions = (
    <div
      className={
        "flex w-full items-center gap-2 " +
        (isMobile ? "justify-between" : "justify-end")
      }
    >
      <Button
        type="button"
        variant="ghost"
        className={isMobile ? "min-h-11 px-4" : "min-h-9"}
        disabled={saving}
        onClick={closeEditor}
      >
        Annuler
      </Button>
      <Button
        type="button"
        variant="ledger"
        className={isMobile ? "min-h-11 px-5" : "min-h-9"}
        disabled={saving}
        aria-busy={saving}
        onClick={() => void save()}
      >
        {saving && (
          <LoaderCircle
            className="mr-2 size-4 animate-spin"
            aria-hidden="true"
          />
        )}
        {saving ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </div>
  );
  const handleOpenChange = (nextOpen: boolean) => {
    if (saving && !nextOpen) return;
    if (!nextOpen) {
      setValue(row.commentaire);
      setError(false);
    }
    setOpen(nextOpen);
  };
  const trigger = (
    <button
      type="button"
      className="inline-flex min-h-9 max-w-full min-w-0 items-center gap-1 text-left text-xs text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={
        (hasComment ? "Modifier" : "Ajouter") +
        " le commentaire pour " +
        row.pieceLabel
      }
      title={hasComment ? row.commentaire : undefined}
    >
      <Pencil className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">
        {row.commentaire || "Ajouter une note"}
      </span>
    </button>
  );

  return (
    <div className="min-w-0">
      {isMobile ? (
        <Sheet open={open} onOpenChange={handleOpenChange}>
          <SheetTrigger asChild>{trigger}</SheetTrigger>
          <SheetContent
            side="bottom"
            className="max-h-[90dvh] rounded-t-2xl border-x-0 px-4 pt-5 sm:px-6"
          >
            <div
              className="mx-auto mb-4 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/30"
              aria-hidden="true"
            />
            <SheetHeader className="space-y-1 border-0 px-0 py-0 pr-9">
              <SheetTitle>{editorTitle}</SheetTitle>
              <SheetDescription className="text-xs leading-relaxed">
                {editorContext}
              </SheetDescription>
            </SheetHeader>
            <SheetBody className="min-h-0 space-y-5 px-0 py-5">
              {commentField}
            </SheetBody>
            <SheetFooter className="mt-auto flex-row items-center justify-between gap-2 px-0 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
              {actions}
            </SheetFooter>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>{trigger}</DialogTrigger>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-lg gap-5 rounded-xl p-5 sm:p-6">
            <DialogHeader className="pr-8">
              <DialogTitle>{editorTitle}</DialogTitle>
              <DialogDescription className="text-xs leading-relaxed">
                {editorContext}
              </DialogDescription>
            </DialogHeader>
            {commentField}
            {actions}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

type Filtre = "toutes" | "attente" | "recues";

const champSuivi =
  "h-9 rounded-lg border border-border bg-background px-2 text-sm tabular-nums text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:bg-transparent disabled:text-muted-foreground/70";

interface ChampProps {
  row: ChecklistRow;
  editable: boolean;
  onSaveSuivi?: Props["onSaveSuivi"];
  compact?: boolean;
}

/** Date de suivi d'une pièce : enregistrée en quittant la case. */
function ChampDate({ row, editable, onSaveSuivi, compact = false }: ChampProps) {
  const [date, setDate] = useState(row.dateSuivi ?? "");
  useEffect(() => setDate(row.dateSuivi ?? ""), [row.dateSuivi]);
  return (
    <input
      type="date"
      aria-label={`Date de suivi pour ${row.pieceLabel}`}
      disabled={!(editable && row.recu && onSaveSuivi)}
      value={date}
      className={cn(champSuivi, "w-full min-w-0", compact && "w-40")}
      onChange={(e) => setDate(e.target.value)}
      onBlur={() => {
        if (date !== (row.dateSuivi ?? ""))
          void onSaveSuivi?.(row.onglet, { dateSuivi: date || null }).catch(() => setDate(row.dateSuivi ?? ""));
      }}
    />
  );
}

/** Total d'une pièce : calculé d'après les lignes du tableau quand il y en a, sinon saisi ici. */
function ChampTotal({ row, devise, editable, onSaveSuivi, compact = false }: ChampProps & { devise: string }) {
  const [total, setTotal] = useState(row.total == null ? "" : String(row.total));
  useEffect(() => setTotal(row.total == null ? "" : String(row.total)), [row.total]);
  const symbole = devise === "EUR" ? "€" : devise === "USD" ? "$" : devise;
  if (row.recuAuto)
    return (
      <span className="whitespace-nowrap font-medium tabular-nums text-foreground" title="Calculé d'après les lignes du tableau">
        {row.total == null ? "—" : row.total.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
        <span className="ml-1.5 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">{symbole}</span>
      </span>
    );
  return (
    <span className="flex items-center justify-end gap-1.5">
      <input
        type="number"
        inputMode="decimal"
        step="any"
        min="0"
        aria-label={`Total pour ${row.pieceLabel}`}
        disabled={!(editable && row.recu && onSaveSuivi)}
        placeholder="0,000"
        value={total}
        className={cn(champSuivi, "w-full min-w-0 text-right", compact && "w-32")}
        onChange={(e) => setTotal(e.target.value)}
        onBlur={() => {
          const nombre = total === "" ? null : Number(total);
          if (nombre !== row.total && (nombre === null || Number.isFinite(nombre)))
            void onSaveSuivi?.(row.onglet, { totalSaisi: nombre }).catch(() => setTotal(row.total == null ? "" : String(row.total)));
        }}
      />
      <span className="shrink-0 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">{symbole}</span>
    </span>
  );
}

export function CollecteChecklist({ rows, devise, editable, onSelectTab, onSaveComment, onSaveSuivi, onMarkAll, exports, notice }: Props) {
  const [filtre, setFiltre] = useState<Filtre>("toutes");
  const [marquage, setMarquage] = useState(false);
  const recus = rows.filter((row) => row.recu).length;
  const enAttente = rows.filter((row) => !row.recu);
  const visibles = filtre === "toutes" ? rows : rows.filter((row) => (filtre === "recues" ? row.recu : !row.recu));

  const lien = (row: ChecklistRow) => (
    <button
      type="button"
      onClick={() => onSelectTab(row.onglet)}
      className="mt-0.5 inline-flex items-center gap-1 text-left text-xs text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      Ouvrir « {row.tabLabel} »<ArrowUpRight className="h-3 w-3 shrink-0" />
    </button>
  );

  const coche = (row: ChecklistRow) => (
    <Checkbox
      checked={row.recu}
      disabled={!editable || row.recuAuto || !onSaveSuivi}
      aria-label={`Pièce reçue : ${row.pieceLabel}`}
      title={row.recuAuto ? "Des lignes sont saisies dans le tableau : pièce reçue d'office" : undefined}
      className="size-7 shrink-0 rounded-lg border-border data-[state=checked]:border-success data-[state=checked]:bg-success data-[state=checked]:text-white"
      onCheckedChange={(valeur) => void onSaveSuivi?.(row.onglet, { recuManuel: valeur === true }).catch(() => undefined)}
    />
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
        <span className="text-xs text-muted-foreground">{recus} / {rows.length} pièces reçues</span>
        <div className="flex flex-wrap items-center gap-2">
        {editable && onMarkAll && (
          <Button
            variant="outline"
            size="sm"
            className="min-h-9 gap-1.5"
            disabled={enAttente.length === 0 || marquage}
            onClick={() => {
              setMarquage(true);
              void onMarkAll(enAttente.map((row) => row.onglet))
                .catch(() => undefined)
                .finally(() => setMarquage(false));
            }}
          >
            <CheckCircle2 className="h-4 w-4 text-success" />
            {marquage ? "Marquage…" : "Tout marquer comme reçu"}
          </Button>
        )}
        {exports}
          <Select value={filtre} onValueChange={(value) => setFiltre(value as Filtre)}>
            <SelectTrigger aria-label="Filtrer les pièces" className="min-h-9 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="toutes">Toutes ({rows.length})</SelectItem>
              <SelectItem value="attente">En attente ({enAttente.length})</SelectItem>
              <SelectItem value="recues">Reçues ({recus})</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {notice && <p className="mx-4 mt-3 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-muted-foreground">{notice}</p>}

      <div className="hidden lg:block">
        <table className="w-full table-fixed text-sm">
          <thead className="border-y border-border bg-secondary/65 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            <tr>
              <th className="w-[38%] px-4 py-3 text-left">Pièce à transmettre</th>
              <th className="w-[17%] px-2 py-3 text-left">Date de suivi</th>
              <th className="w-[18%] px-2 py-3 text-right">Total</th>
              <th className="w-[27%] px-4 py-3 text-left">Commentaire</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visibles.map((row) => {
              return (
                <tr key={row.onglet} className="align-middle hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      {coche(row)}
                      <div className="min-w-0">
                        <p className="font-serif text-[1.05rem] leading-snug text-primary">
                          {row.etat && <CodeEtat code={row.etat} />}
                          {row.pieceLabel}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">Circuit du tableau · {row.circuitLabel}</p>
                        {lien(row)}
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-3"><ChampDate row={row} editable={editable} onSaveSuivi={onSaveSuivi} /></td>
                  <td className="px-2 py-3 text-right"><ChampTotal row={row} devise={devise} editable={editable} onSaveSuivi={onSaveSuivi} /></td>
                  <td className="px-4 py-3">
                    <Comment row={row} editable={editable} onSave={(value) => onSaveComment(row.onglet, value)} />
                  </td>
                </tr>
              );
            })}
            {visibles.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Aucune pièce dans ce filtre.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="divide-y divide-border border-t border-border lg:hidden">
        {visibles.map((row) => (
          <MobileChecklistRow
            key={row.onglet}
            row={row}
            devise={devise}
            editable={editable}
            coche={coche(row)}
            lien={lien(row)}
            onSaveSuivi={onSaveSuivi}
            onSaveComment={onSaveComment}
          />
        ))}
        {visibles.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted-foreground">Aucune pièce dans ce filtre.</p>}
      </div>
      <div className="flex items-center justify-between border-t border-border bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
        <span>Pièces reçues</span>
        <strong className="tabular-nums text-primary">{recus} / {rows.length}</strong>
      </div>
    </>
  );
}

function MobileChecklistRow({
  row,
  devise,
  editable,
  coche,
  lien,
  onSaveSuivi,
  onSaveComment,
}: {
  row: ChecklistRow;
  devise: string;
  editable: boolean;
  coche: ReactNode;
  lien: ReactNode;
  onSaveSuivi?: Props["onSaveSuivi"];
  onSaveComment: (key: string, value: string) => Promise<void>;
}) {
  return (
    <article className="px-3 py-3">
      <div className="flex items-start gap-3">
        {coche}
        <div className="min-w-0">
          <h3 className="font-serif text-base leading-snug text-primary">
            {row.etat && <CodeEtat code={row.etat} />}
            {row.pieceLabel}
          </h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Circuit du tableau · {row.circuitLabel}</p>
          {lien}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 pl-10">
        <ChampDate row={row} editable={editable} onSaveSuivi={onSaveSuivi} compact />
        <ChampTotal row={row} devise={devise} editable={editable} onSaveSuivi={onSaveSuivi} compact />
      </div>
      <div className="mt-2 border-t border-border/70 pl-10 pt-1 text-xs">
        <Comment row={row} editable={editable} onSave={(value) => onSaveComment(row.onglet, value)} />
      </div>
    </article>
  );
}

/** Sigle de l'état (CHQ, VRT, TR) qui regroupe le tableau, avant le libellé de la pièce. */
function CodeEtat({ code }: { code: string }) {
  return (
    <span className="mr-2 inline-block rounded bg-accent/15 px-1.5 py-0.5 align-middle font-sans text-[10px] font-bold tracking-wide text-accent-foreground">
      {code}
    </span>
  );
}

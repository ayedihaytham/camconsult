import { useEffect, useId, useState, type ReactNode } from "react";
import { ArrowUpRight, LoaderCircle, Pencil } from "lucide-react";
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
import { StatusDot } from "@/components/ledger/StatusDot";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import type { ChecklistRow } from "@/lib/collecte/checklist";

interface Props {
  rows: ChecklistRow[];
  devise: string;
  editable: boolean;
  onSelectTab: (key: string) => void;
  onSaveComment: (key: string, value: string) => Promise<void>;
}

function totalLabel(total: number | null, devise: string) {
  if (total == null) return "—";
  const symbol = devise === "EUR" ? "€" : devise === "USD" ? "$" : devise;
  return `${total.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol}`;
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

export function CollecteChecklist({ rows, devise, editable, onSelectTab, onSaveComment }: Props) {
  const recus = rows.filter((row) => row.recu).length;
  const name = (row: ChecklistRow) => (
    <button
      type="button"
      onClick={() => onSelectTab(row.onglet)}
      className="inline-flex min-h-9 items-center gap-1 text-left text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {row.tabLabel}<ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
    </button>
  );

  return (
    <>
      <div className="hidden lg:block">
        <table className="w-full table-fixed text-sm">
          <thead className="border-b border-border bg-secondary/65 text-[10px] font-bold uppercase tracking-[0.08em] text-primary">
            <tr>
              <th className="w-[24%] px-4 py-2.5 text-left">Pièce à transmettre</th>
              <th className="w-[21%] px-2 py-2.5 text-left">Onglet correspondant</th>
              <th className="w-[12%] px-2 py-2.5 text-left">Statut</th>
              <th className="w-[13%] px-2 py-2.5 text-left">Date de suivi</th>
              <th className="w-[13%] px-2 py-2.5 text-right">Total ({devise})</th>
              <th className="w-[17%] px-2 py-2.5 text-left">Commentaire</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.onglet} className="hover:bg-muted/20">
                <td className="px-4 py-2 font-semibold text-primary">{row.pieceLabel}</td>
                <td className="px-2 py-2">{name(row)}</td>
                <td className="px-2 py-2"><StatusDot tone={row.recu ? "success" : "warning"} label={row.statutLabel} className="text-xs" /></td>
                <td className="px-2 py-2 text-xs tabular-nums text-muted-foreground">{row.dateReception ?? "—"}</td>
                <td className="px-2 py-2 text-right text-xs font-medium tabular-nums text-foreground">{totalLabel(row.total, devise)}</td>
                <td className="px-2 py-2"><Comment row={row} editable={editable} onSave={(value) => onSaveComment(row.onglet, value)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="divide-y divide-border lg:hidden">
        {rows.map((row) => (
          <MobileChecklistRow
            key={row.onglet}
            row={row}
            devise={devise}
            editable={editable}
            name={name}
            onSaveComment={onSaveComment}
          />
        ))}
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
  name,
  onSaveComment,
}: {
  row: ChecklistRow;
  devise: string;
  editable: boolean;
  name: (row: ChecklistRow) => ReactNode;
  onSaveComment: (key: string, value: string) => Promise<void>;
}) {
  return (
    <article className="px-3 py-3">
      <h3 className="text-sm font-semibold text-primary">{row.pieceLabel}</h3>
      {name(row)}
      <div className="mt-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <StatusDot
          tone={row.recu ? "success" : "warning"}
          label={row.statutLabel}
          className="text-xs"
        />
        <span>Date de suivi · {row.dateReception ?? "—"}</span>
      </div>
      <div className="mt-2 flex min-w-0 items-center justify-between gap-3 border-t border-border/70 pt-1 text-xs">
        <Comment
          row={row}
          editable={editable}
          onSave={(value) => onSaveComment(row.onglet, value)}
        />
        <span className="shrink-0 tabular-nums text-muted-foreground">
          Total · {totalLabel(row.total, devise)}
        </span>
      </div>
    </article>
  );
}

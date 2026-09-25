import { useEffect, useState } from "react";
import { ArrowUpRight, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusDot } from "@/components/ledger/StatusDot";
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

function Comment({ row, editable, onSave }: {
  row: ChecklistRow;
  editable: boolean;
  onSave: (value: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(row.commentaire);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<"saved" | "error" | null>(null);

  useEffect(() => {
    if (!editing) setValue(row.commentaire);
  }, [row.commentaire, editing]);

  async function save() {
    if (saving) return;
    if (value === row.commentaire) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      await onSave(value);
      setFeedback("saved");
      setEditing(false);
    } catch {
      setFeedback("error");
    } finally {
      setSaving(false);
    }
  }

  if (!editable) return <span className="text-muted-foreground">{row.commentaire || "—"}</span>;

  return (
    <div className="min-w-0">
      {editing ? (
        <div className="flex min-w-0 items-center gap-1">
          <Input
            aria-label={`Commentaire pour ${row.pieceLabel}`}
            className="h-8 min-w-0 bg-background"
            value={value}
            disabled={saving}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") void save(); }}
          />
          <Button size="sm" variant="outline" disabled={saving} onClick={() => void save()}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
          <Button size="sm" variant="ghost" disabled={saving} onClick={() => { setValue(row.commentaire); setEditing(false); setFeedback(null); }}>
            Annuler
          </Button>
        </div>
      ) : (
        <button
          type="button"
          className="inline-flex min-h-9 min-w-0 items-center gap-1 text-left text-xs text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => { setFeedback(null); setEditing(true); }}
          aria-label={`${row.commentaire ? "Modifier" : "Ajouter"} le commentaire pour ${row.pieceLabel}`}
        >
          <Pencil className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{row.commentaire || "Ajouter une note"}</span>
        </button>
      )}
      {feedback && (
        <span role={feedback === "error" ? "alert" : "status"} className={feedback === "error" ? "text-xs text-destructive" : "text-xs text-success"}>
          {feedback === "error" ? "Enregistrement impossible · réessayez" : "Enregistré"}
        </span>
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
          <article key={row.onglet} className="px-3 py-3">
            <h3 className="text-sm font-semibold text-primary">{row.pieceLabel}</h3>
            {name(row)}
            <div className="mt-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <StatusDot tone={row.recu ? "success" : "warning"} label={row.statutLabel} className="text-xs" />
              <span>Date de suivi · {row.dateReception ?? "—"}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 border-t border-border/70 pt-1 text-xs">
              <Comment row={row} editable={editable} onSave={(value) => onSaveComment(row.onglet, value)} />
              <span className="shrink-0 tabular-nums text-muted-foreground">Total · {totalLabel(row.total, devise)}</span>
            </div>
          </article>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-border bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
        <span>Pièces reçues</span>
        <strong className="tabular-nums text-primary">{recus} / {rows.length}</strong>
      </div>
    </>
  );
}

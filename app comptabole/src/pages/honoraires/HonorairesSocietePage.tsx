import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { LedgerPageHeader } from "@/components/ledger/LedgerPageHeader";
import { LedgerSheet } from "@/components/ledger/LedgerSheet";
import { LedgerKpiRow } from "@/components/ledger/LedgerKpiRow";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSocieteById } from "@/store/data";
import { useHonoraires, type HonoraireLigneInput } from "@/store/honoraires";
import { HONORAIRE_TYPE_LABELS, type HonoraireLigne } from "@/types";
import { HonoraireLigneFormSheet } from "./HonoraireLigneFormSheet";

const fmt = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export function HonorairesSocietePage() {
  const { societeId = "" } = useParams();
  const navigate = useNavigate();
  const societe = useSocieteById(societeId);

  const list = useHonoraires((s) => s.list);
  const loading = useHonoraires((s) => s.loading);
  const fetchList = useHonoraires((s) => s.fetchList);
  const clear = useHonoraires((s) => s.clear);
  const create = useHonoraires((s) => s.create);
  const update = useHonoraires((s) => s.update);
  const remove = useHonoraires((s) => s.remove);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<HonoraireLigne | null>(null);
  const [toDelete, setToDelete] = useState<HonoraireLigne | null>(null);

  useEffect(() => {
    fetchList(societeId);
    return () => clear();
  }, [societeId, fetchList, clear]);

  const soldeActuel = list.length > 0 ? list[list.length - 1].solde : 0;
  const totalHonoraires = list.reduce((s, l) => s + l.honoraire, 0);
  const totalReglements = list.reduce((s, l) => s + l.reglement, 0);

  function handleSubmit(data: HonoraireLigneInput) {
    if (editing) {
      update(editing.id, data);
      toast.success("Ligne modifiée");
    } else {
      create(data);
      toast.success("Ligne ajoutée");
    }
    setEditing(null);
  }

  return (
    <div>
      <LedgerPageHeader
        breadcrumb={
          <button
            onClick={() => navigate("/honoraires")}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Toutes les sociétés
          </button>
        }
        title={`État client — ${societe?.raisonSociale ?? "Société"}`}
        description="Déclarations traitées, honoraires et règlements — le solde cumule les honoraires et montants déclarés, réduit par chaque règlement."
        actions={
          <Button
            variant="ledger"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Nouvelle ligne
          </Button>
        }
      />

      <LedgerSheet className="mt-4">
        <LedgerKpiRow
          hero
          danger={soldeActuel > 0}
          label="Solde actuel"
          value={`${fmt(soldeActuel)} TND`}
        />
        <LedgerKpiRow label="Total honoraires" value={`${fmt(totalHonoraires)} TND`} />
        <LedgerKpiRow label="Total règlements reçus" value={`${fmt(totalReglements)} TND`} />
      </LedgerSheet>

      {list.length === 0 ? (
        <LedgerSheet className="mt-3">
          <EmptyState
            icon={Receipt}
            title={loading ? "Chargement…" : "Aucune ligne"}
            description="Ajoutez une déclaration traitée pour cette société (CNSS, acompte, IS, mensuelle…)."
          />
        </LedgerSheet>
      ) : (
        <LedgerSheet className="mt-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="border-b-2 border-foreground px-2 py-2 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">Type</th>
                  <th className="border-b-2 border-foreground px-2 py-2 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">Libellé</th>
                  <th className="border-b-2 border-foreground px-2 py-2 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">CNSS</th>
                  <th className="border-b-2 border-foreground px-2 py-2 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">N° Quittance</th>
                  <th className="border-b-2 border-foreground px-2 py-2 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">Mt déclaration</th>
                  <th className="border-b-2 border-foreground px-2 py-2 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">Honoraire</th>
                  <th className="border-b-2 border-foreground px-2 py-2 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">Total</th>
                  <th className="border-b-2 border-foreground px-2 py-2 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">Règlt</th>
                  <th className="border-b-2 border-foreground px-2 py-2 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">Solde</th>
                  <th className="w-[1%] border-b-2 border-foreground px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {list.map((l, i) => {
                  const rowBorder =
                    (i + 1) % 5 === 0
                      ? "border-b-[1.5px] border-rule-strong"
                      : "border-b border-border";
                  return (
                    <tr key={l.id} className={cn(rowBorder, "hover:bg-primary/[0.03]")}>
                      <td className="px-2 py-2 text-xs text-muted-foreground">
                        {HONORAIRE_TYPE_LABELS[l.type]}
                      </td>
                      <td className="px-2 py-2 text-foreground">{l.libelle || "—"}</td>
                      <td className="px-2 py-2 text-muted-foreground">{l.cnss || "—"}</td>
                      <td className="px-2 py-2 font-mono text-xs text-muted-foreground">
                        {l.numQuittance || "—"}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {fmt(l.montantDeclaration)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{fmt(l.honoraire)}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                        {fmt(l.total)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {l.reglement ? fmt(l.reglement) : "—"}
                      </td>
                      <td
                        className={cn(
                          "px-2 py-2 text-right font-bold tabular-nums",
                          l.solde > 0 && "text-destructive",
                        )}
                      >
                        {fmt(l.solde)}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex gap-0.5">
                          <button
                            onClick={() => {
                              setEditing(l);
                              setFormOpen(true);
                            }}
                            className="flex h-[26px] w-[26px] items-center justify-center rounded-[5px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setToDelete(l)}
                            className="flex h-[26px] w-[26px] items-center justify-center rounded-[5px] text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </LedgerSheet>
      )}

      <HonoraireLigneFormSheet
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditing(null);
        }}
        societeId={societeId}
        ligne={editing}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Supprimer cette ligne ?"
        description="Cette ligne du compte honoraires sera définitivement supprimée."
        confirmLabel="Supprimer"
        onConfirm={() => {
          if (toDelete) remove(toDelete.id);
          setToDelete(null);
        }}
      />
    </div>
  );
}

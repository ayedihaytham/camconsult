import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Boxes,
  Download,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { LedgerPageHeader } from "@/components/ledger/LedgerPageHeader";
import { LedgerSheet } from "@/components/ledger/LedgerSheet";
import { LedgerKpiRow } from "@/components/ledger/LedgerKpiRow";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import { useSocieteById } from "@/store/data";
import { useStock, type StockMouvementInput } from "@/store/stock";
import type { StockMouvement } from "@/types";
import { StockMouvementFormSheet } from "./StockMouvementFormSheet";
import { DocPreviewDialog } from "./DocPreviewDialog";

const fmt = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtQ = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 3 });

export function StockSocietePage() {
  const { societeId = "" } = useParams();
  const navigate = useNavigate();
  const societe = useSocieteById(societeId);

  const list = useStock((s) => s.list);
  const loading = useStock((s) => s.loading);
  const fetchList = useStock((s) => s.fetchList);
  const clear = useStock((s) => s.clear);
  const create = useStock((s) => s.create);
  const update = useStock((s) => s.update);
  const remove = useStock((s) => s.remove);

  const [onlyAnomalies, setOnlyAnomalies] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StockMouvement | null>(null);
  const [toDelete, setToDelete] = useState<StockMouvement | null>(null);
  const [preview, setPreview] = useState<{ title: string; dataUrl: string | null } | null>(null);

  useEffect(() => {
    fetchList(societeId);
    return () => clear();
  }, [societeId, fetchList, clear]);

  const shown = onlyAnomalies ? list.filter((m) => m.ecart !== 0) : list;
  const nbAnomalies = list.filter((m) => m.ecart !== 0).length;

  const totals = useMemo(
    () =>
      list.reduce(
        (acc, m) => ({
          achatQ: acc.achatQ + m.achatQuantite,
          venteQ: acc.venteQ + m.venteQuantite,
          achatTnd: acc.achatTnd + m.achatMontantTnd,
          venteTnd: acc.venteTnd + m.venteMontantTnd,
        }),
        { achatQ: 0, venteQ: 0, achatTnd: 0, venteTnd: 0 },
      ),
    [list],
  );

  function handleSubmit(data: StockMouvementInput) {
    if (editing) {
      update(editing.id, data);
      toast.success("Mouvement modifié");
    } else {
      create(data);
      toast.success("Mouvement créé");
    }
    setEditing(null);
  }

  async function exportXlsx() {
    const XLSX = await import("xlsx");
    const header = [
      "Nature", "Écart",
      "Achat: Date", "N° Facture", "Fournisseur", "Quantité", "PU", "Montant devise", "Devise", "Cours", "Montant TND",
      "Vente: Date", "N° Facture", "Client", "Quantité", "PU", "Montant devise", "Devise", "Cours", "Montant TND",
      "Douane: N° Déclaration", "Date", "Régime", "Référence",
      "Note",
    ];
    const rows = list.map((m) => [
      m.natureMarchandise, m.ecart,
      m.achatDate ?? "", m.achatNumFacture, m.fournisseur, m.achatQuantite, m.achatPu,
      m.achatMontantDevise, m.achatDevise, m.achatCours, m.achatMontantTnd,
      m.venteDate ?? "", m.venteNumFacture, m.client, m.venteQuantite, m.ventePu,
      m.venteMontantDevise, m.venteDevise, m.venteCours, m.venteMontantTnd,
      m.douaneNumDeclaration, m.douaneDate ?? "", m.douaneRegime, m.douaneReference,
      m.note,
    ]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stock");
    XLSX.writeFile(wb, `Stock_${societe?.raisonSociale ?? societeId}.xlsx`);
  }

  return (
    <div>
      <LedgerPageHeader
        breadcrumb={
          <button
            onClick={() => navigate("/stock")}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Toutes les sociétés
          </button>
        }
        title={`Stock — ${societe?.raisonSociale ?? "Société"}`}
        description="Un mouvement = un achat et/ou une vente appariés. L'écart doit tendre vers 0."
        actions={
          <div className="flex gap-4">
            <Button variant="ledger-text" onClick={exportXlsx}>
              <Download className="h-3.5 w-3.5" />
              Excel
            </Button>
            <Button
              variant="ledger"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Nouveau mouvement
            </Button>
          </div>
        }
      />

      {/* KPI en lignes de relevé — héros = Anomalies, le signal métier le
          plus critique de cet écran (écart doit tendre vers 0), pas le 1er
          indicateur par défaut. Voir DESIGN-SYSTEM.md §1. */}
      <LedgerSheet className="mt-6">
        <LedgerKpiRow
          hero
          danger={nbAnomalies > 0}
          label="Anomalies (écart ≠ 0)"
          value={String(nbAnomalies)}
        />
        <LedgerKpiRow label="Qté achetée" value={fmtQ(totals.achatQ)} />
        <LedgerKpiRow label="Qté vendue" value={fmtQ(totals.venteQ)} />
        <LedgerKpiRow label="Montant achats (TND)" value={fmt(totals.achatTnd)} />
      </LedgerSheet>

      <label className="my-4 flex w-fit cursor-pointer items-center gap-2 text-sm text-foreground">
        <span
          onClick={() => setOnlyAnomalies((v) => !v)}
          className={cn(
            "flex h-[15px] w-[15px] items-center justify-center rounded-[3px] border-[1.5px]",
            onlyAnomalies
              ? "border-foreground bg-foreground"
              : "border-muted-foreground bg-card",
          )}
        >
          {onlyAnomalies && (
            <svg viewBox="0 0 10 10" className="h-2 w-2" fill="none">
              <path d="M1 5l2.5 2.5L9 2" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        <span onClick={() => setOnlyAnomalies((v) => !v)}>
          Anomalies seulement {nbAnomalies > 0 && `(${nbAnomalies})`}
        </span>
      </label>

      {shown.length === 0 ? (
        <LedgerSheet>
          <EmptyState
            icon={Boxes}
            title={loading ? "Chargement…" : "Aucun mouvement"}
            description="Créez un mouvement : renseignez l'achat, la vente et/ou la douane, ou importez un PDF."
          />
        </LedgerSheet>
      ) : (
        <LedgerSheet>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th rowSpan={2} className="border-b-2 border-foreground px-2 py-2 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">Nature</th>
                  <th colSpan={5} className="border-b-2 border-l-2 border-foreground px-2 py-1 text-center text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">Achat</th>
                  <th colSpan={5} className="border-b-2 border-l-2 border-foreground px-2 py-1 text-center text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">Vente</th>
                  <th rowSpan={2} className="border-b-2 border-l-2 border-foreground px-2 py-2 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">Écart</th>
                  <th rowSpan={2} className="w-[1%] border-b-2 border-foreground px-2 py-2" />
                </tr>
                <tr>
                  <th className="border-b-2 border-l-2 border-foreground px-2 py-1.5 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">Date</th>
                  <th className="border-b-2 border-foreground px-2 py-1.5 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">Fournisseur</th>
                  <th className="border-b-2 border-foreground px-2 py-1.5 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">Qté</th>
                  <th className="border-b-2 border-foreground px-2 py-1.5 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">Mt TND</th>
                  <th className="border-b-2 border-foreground px-2 py-1.5 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">N° Fact.</th>
                  <th className="border-b-2 border-l-2 border-foreground px-2 py-1.5 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">Date</th>
                  <th className="border-b-2 border-foreground px-2 py-1.5 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">Client</th>
                  <th className="border-b-2 border-foreground px-2 py-1.5 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">Qté</th>
                  <th className="border-b-2 border-foreground px-2 py-1.5 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">Mt TND</th>
                  <th className="border-b-2 border-foreground px-2 py-1.5 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">N° Fact.</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((m, i) => {
                  const rowBorder =
                    (i + 1) % 5 === 0
                      ? "border-b-[1.5px] border-rule-strong"
                      : "border-b border-border";
                  return (
                    <tr key={m.id} className={cn(rowBorder, "hover:bg-primary/[0.03]")}>
                      <td className="px-2 py-2 text-foreground">{m.natureMarchandise || "—"}</td>
                      <td className="border-l-2 border-border px-2 py-2 text-muted-foreground">
                        {m.achatDate ? formatDate(m.achatDate) : "—"}
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">{m.fournisseur || "—"}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{fmtQ(m.achatQuantite)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{fmt(m.achatMontantTnd)}</td>
                      <td className="px-2 py-2 font-mono text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          {m.achatNumFacture || "—"}
                          {m.achatDocDataUrl && (
                            <button
                              onClick={() => setPreview({ title: "Facture d'achat", dataUrl: m.achatDocDataUrl })}
                              className="text-muted-foreground hover:text-accent"
                              title="Voir la facture d'achat"
                            >
                              <Paperclip className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </span>
                      </td>
                      <td className="border-l-2 border-border px-2 py-2 text-muted-foreground">
                        {m.venteDate ? formatDate(m.venteDate) : "—"}
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">{m.client || "—"}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{fmtQ(m.venteQuantite)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{fmt(m.venteMontantTnd)}</td>
                      <td className="px-2 py-2 font-mono text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          {m.venteNumFacture || "—"}
                          {m.venteDocDataUrl && (
                            <button
                              onClick={() => setPreview({ title: "Document de vente", dataUrl: m.venteDocDataUrl })}
                              className="text-muted-foreground hover:text-accent"
                              title="Voir le document de vente"
                            >
                              <Paperclip className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </span>
                      </td>
                      {/* --destructive (≈5,8:1) est autorisé en texte — voir
                          DESIGN-SYSTEM.md §2 ; un écart à 0 reste en encre
                          neutre, pas de vert (--success échoue le contraste
                          en texte). */}
                      <td
                        className={cn(
                          "border-l-2 border-border px-2 py-2 text-right font-bold tabular-nums",
                          m.ecart !== 0 && "text-destructive",
                        )}
                      >
                        {fmtQ(m.ecart)}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex gap-0.5">
                          <button
                            onClick={() => {
                              setEditing(m);
                              setFormOpen(true);
                            }}
                            className="flex h-[26px] w-[26px] items-center justify-center rounded-[5px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setToDelete(m)}
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

      <StockMouvementFormSheet
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditing(null);
        }}
        societeId={societeId}
        mouvement={editing}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Supprimer ce mouvement ?"
        description="Cette ligne de stock sera définitivement supprimée."
        confirmLabel="Supprimer"
        onConfirm={() => {
          if (toDelete) remove(toDelete.id);
          setToDelete(null);
        }}
      />

      <DocPreviewDialog
        open={Boolean(preview)}
        onOpenChange={(o) => !o && setPreview(null)}
        title={preview?.title ?? ""}
        dataUrl={preview?.dataUrl ?? null}
      />
    </div>
  );
}

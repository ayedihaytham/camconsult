import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Boxes,
  Download,
  FolderInput,
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
import { useSocieteById, useNoeuds, useData } from "@/store/data";
import { useStock, type StockMouvementInput } from "@/store/stock";
import type { StockLigne, StockMouvement } from "@/types";
import { classerDansStructuration } from "@/lib/classement";
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

  const noeuds = useNoeuds();
  const addNoeud = useData((s) => s.addNoeud);
  const [classing, setClassing] = useState<string | null>(null);

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
          achatQ: acc.achatQ + m.achatLignes.reduce((s, l) => s + l.quantite, 0),
          venteQ: acc.venteQ + m.venteLignes.reduce((s, l) => s + l.quantite, 0),
          achatTnd: acc.achatTnd + m.achatLignes.reduce((s, l) => s + l.montantTnd, 0),
          venteTnd: acc.venteTnd + m.venteLignes.reduce((s, l) => s + l.montantTnd, 0),
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

  /** Classe la facture d'achat, de vente ou le document douanier d'un
   * mouvement dans Structuration (achat|vente|douane/année de la pièce,
   * créés à la volée si besoin) — voir classement.ts. Le mouvement de stock
   * garde son propre exemplaire du document (achatDocDataUrl/…) ; celui-ci
   * n'en est qu'une copie archivée pour le classement du cabinet. */
  async function handleClasser(m: StockMouvement, categorie: "achat" | "vente" | "douane") {
    const dataUrl =
      categorie === "achat" ? m.achatDocDataUrl
      : categorie === "vente" ? m.venteDocDataUrl
      : m.douaneDocDataUrl;
    if (!dataUrl) return;
    const key = `${m.id}-${categorie}`;
    setClassing(key);
    try {
      const { dejaClasse } = await classerDansStructuration({
        noeuds,
        addNoeud,
        societeId,
        categorie,
        date:
          (categorie === "achat" ? m.achatDate
          : categorie === "vente" ? m.venteDate
          : m.douaneDate) ?? null,
        nomBase:
          (categorie === "achat" ? m.achatNumFacture
          : categorie === "vente" ? m.venteNumFacture
          : m.douaneNumDeclaration) ||
          m.natureMarchandise ||
          "Document",
        dataUrl,
      });
      toast.success(dejaClasse ? "Déjà classé dans Structuration" : "Classé dans Structuration");
    } catch {
      // addNoeud() affiche déjà son propre toast d'erreur (voir store/data.ts).
    } finally {
      setClassing(null);
    }
  }

  async function exportXlsx() {
    const XLSX = await import("xlsx");
    const header = [
      "Nature", "Écart",
      "Achat: Date", "N° Facture", "Fournisseur", "Produits", "Quantité", "Montant devise", "Devise", "Cours", "Montant TND",
      "Vente: Date", "N° Facture", "Client", "Produits", "Quantité", "Montant devise", "Devise", "Cours", "Montant TND",
      "Douane: N° Déclaration", "Date", "Régime", "Référence",
      "Note",
    ];
    // Une facture peut lister plusieurs produits (voir StockLigne) : le
    // détail par ligne reste consultable à l'écran, l'export agrège en
    // quantité/montant totaux + une colonne "Produits" listant chaque
    // désignation, pour garder une ligne Excel = un dossier.
    const sumQ = (lignes: typeof list[number]["achatLignes"]) =>
      lignes.reduce((s, l) => s + l.quantite, 0);
    const sumTnd = (lignes: typeof list[number]["achatLignes"]) =>
      lignes.reduce((s, l) => s + l.montantTnd, 0);
    const sumDevise = (lignes: typeof list[number]["achatLignes"]) =>
      lignes.reduce((s, l) => s + l.montantDevise, 0);
    const designations = (lignes: typeof list[number]["achatLignes"]) =>
      lignes.map((l) => l.designation).filter(Boolean).join(", ");

    const rows = list.map((m) => [
      m.natureMarchandise, m.ecart,
      m.achatDate ?? "", m.achatNumFacture, m.fournisseur, designations(m.achatLignes),
      sumQ(m.achatLignes), sumDevise(m.achatLignes), m.achatDevise, m.achatCours, sumTnd(m.achatLignes),
      m.venteDate ?? "", m.venteNumFacture, m.client, designations(m.venteLignes),
      sumQ(m.venteLignes), sumDevise(m.venteLignes), m.venteDevise, m.venteCours, sumTnd(m.venteLignes),
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
          <div className="flex gap-2">
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
      <LedgerSheet className="mt-4">
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

      <label className="my-3 flex w-fit cursor-pointer items-center gap-2 text-sm text-foreground">
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
        <div className="flex flex-col gap-3">
          {shown.map((m) => {
            const hasDouane = Boolean(
              m.douaneNumDeclaration || m.douaneDate || m.douaneRegime ||
              m.douaneReference || m.douaneDocDataUrl,
            );
            return (
              <div
                key={m.id}
                className="overflow-hidden rounded-2xl border border-border bg-card shadow-card"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                  <span className="font-bold text-foreground">
                    {m.natureMarchandise || "Mouvement sans nature"}
                  </span>
                  <div className="flex items-center gap-4">
                    {/* --destructive (≈5,8:1) est autorisé en texte — voir
                        DESIGN-SYSTEM.md §2 ; un écart à 0 reste en encre
                        neutre, pas de vert (--success échoue le contraste en
                        texte). */}
                    <span className="text-sm">
                      <span className="text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                        Écart{" "}
                      </span>
                      <span
                        className={cn(
                          "font-bold tabular-nums",
                          m.ecart !== 0 ? "text-destructive" : "text-foreground",
                        )}
                      >
                        {fmtQ(m.ecart)}
                      </span>
                    </span>
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
                  </div>
                </div>

                {/* Écart détaillé par produit — seulement s'il y a plus d'une
                    désignation, sinon redondant avec l'écart total ci-dessus. */}
                {m.ecartParDesignation.length > 1 && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-border bg-secondary/20 px-4 py-2 text-xs">
                    {m.ecartParDesignation.map((e) => (
                      <span key={e.designation} className="text-muted-foreground">
                        {e.designation}{" "}
                        <span
                          className={cn(
                            "font-semibold",
                            e.ecart !== 0 ? "text-destructive" : "text-foreground",
                          )}
                        >
                          {fmtQ(e.ecart)}
                        </span>
                      </span>
                    ))}
                  </div>
                )}

                <MouvementSection
                  label="Achat"
                  fields={[
                    { label: "Date", value: m.achatDate ? formatDate(m.achatDate) : "—" },
                    { label: "Fournisseur", value: m.fournisseur || "—" },
                    { label: "N° Fact.", value: m.achatNumFacture || "—" },
                  ]}
                  lignes={m.achatLignes}
                  docDataUrl={m.achatDocDataUrl}
                  onPreview={() => setPreview({ title: "Facture d'achat", dataUrl: m.achatDocDataUrl })}
                  onClasser={() => handleClasser(m, "achat")}
                  classing={classing === `${m.id}-achat`}
                />
                <MouvementSection
                  label="Vente"
                  fields={[
                    { label: "Date", value: m.venteDate ? formatDate(m.venteDate) : "—" },
                    { label: "Client", value: m.client || "—" },
                    { label: "N° Fact.", value: m.venteNumFacture || "—" },
                  ]}
                  lignes={m.venteLignes}
                  docDataUrl={m.venteDocDataUrl}
                  onPreview={() => setPreview({ title: "Document de vente", dataUrl: m.venteDocDataUrl })}
                  onClasser={() => handleClasser(m, "vente")}
                  classing={classing === `${m.id}-vente`}
                />
                {hasDouane && (
                  <MouvementSection
                    label="Douane"
                    fields={[
                      { label: "N° Décl.", value: m.douaneNumDeclaration || "—" },
                      { label: "Date", value: m.douaneDate ? formatDate(m.douaneDate) : "—" },
                      { label: "Régime", value: m.douaneRegime || "—" },
                      { label: "Référence", value: m.douaneReference || "—" },
                    ]}
                    lignes={[]}
                    docDataUrl={m.douaneDocDataUrl}
                    onPreview={() => setPreview({ title: "Document douanier", dataUrl: m.douaneDocDataUrl })}
                    onClasser={() => handleClasser(m, "douane")}
                    classing={classing === `${m.id}-douane`}
                  />
                )}
              </div>
            );
          })}
        </div>
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

/** Un bloc (Achat/Vente/Douane) plein-largeur dans la carte d'un mouvement —
 * jamais de colonnes côte à côte qui s'écrasent quand le client/fournisseur
 * a un nom long (voir la demande de réorganisation : chaque dossier doit
 * rester lisible même avec beaucoup de mouvements). */
function MouvementSection({
  label,
  fields,
  lignes,
  docDataUrl,
  onPreview,
  onClasser,
  classing,
}: {
  label: string;
  fields: { label: string; value: string }[];
  lignes: StockLigne[];
  docDataUrl: string | null;
  onPreview: () => void;
  onClasser: () => void;
  classing: boolean;
}) {
  return (
    <div className="border-t border-border px-4 py-2.5 text-sm">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
        <span className="w-16 shrink-0 text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <div className="flex flex-1 flex-wrap items-center gap-x-5 gap-y-1">
          {fields.map((f) => (
            <span key={f.label} className="text-muted-foreground">
              <span className="text-[0.66rem] uppercase tracking-wide">{f.label} </span>
              <span className="font-medium text-foreground">{f.value}</span>
            </span>
          ))}
        </div>
        {docDataUrl && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={onPreview}
              className="text-muted-foreground hover:text-accent"
              title="Voir le document"
            >
              <Paperclip className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onClasser}
              disabled={classing}
              className="text-muted-foreground hover:text-accent disabled:opacity-50"
              title="Classer dans Structuration"
            >
              <FolderInput className={cn("h-3.5 w-3.5", classing && "animate-pulse")} />
            </button>
          </div>
        )}
      </div>
      {/* Une facture peut lister plusieurs produits (voir StockLigne) —
          jamais résumés en une seule quantité/montant. */}
      {lignes.length > 0 && (
        <div className="mt-1.5 space-y-0.5 pl-16">
          {lignes.map((l, i) => (
            <div key={l.id ?? i} className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{fmtQ(l.quantite)}</span>
              {" × "}
              {l.designation || "(sans désignation)"}
              {(l.montantDevise !== 0 || l.montantTnd !== 0) && (
                <>
                  {" — "}
                  {fmt(l.montantDevise)}
                  {l.montantTnd !== 0 && ` (${fmt(l.montantTnd)} TND)`}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

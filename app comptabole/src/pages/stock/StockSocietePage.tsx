import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Boxes,
  Download,
  FolderInput,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { SignatureLedgerBanner } from "@/components/ledger/SignatureLedgerBanner";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import { useSocieteById, useNoeuds, useData } from "@/store/data";
import { useStock, type StockMouvementInput } from "@/store/stock";
import type { StockLigne, StockMouvement } from "@/types";
import { classerDansStructuration } from "@/lib/classement";
import { StockMouvementFormSheet } from "./StockMouvementFormSheet";
import { DocPreviewDialog } from "./DocPreviewDialog";

const fmt = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const fmtQ = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 3 });

export function StockSocietePage() {
  const { societeId = "" } = useParams();
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
  const updateNoeud = useData((s) => s.updateNoeud);
  const [classing, setClassing] = useState<string | null>(null);

  const [onlyAnomalies, setOnlyAnomalies] = useState(false);
  const fetchCounts = useStock((s) => s.fetchCounts);
  // Mouvement qui vient d'être enregistré : mis en évidence et amené à l'écran.
  const [nouveauId, setNouveauId] = useState<string | null>(null);
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

  /** Attend la réponse du serveur : le formulaire reste ouvert (données intactes)
   * tant que le mouvement n'est pas réellement enregistré, et s'il échoue. */
  async function handleSubmit(data: StockMouvementInput) {
    if (editing) {
      await update(editing.id, data);
      toast.success("Mouvement modifié");
      setNouveauId(editing.id);
    } else {
      const m = await create(data);
      toast.success("Mouvement enregistré");
      setNouveauId(m.id);
    }
    // Un filtre « anomalies seulement » masquerait un mouvement sans écart.
    setOnlyAnomalies(false);
    setEditing(null);
    void fetchCounts();
  }

  useEffect(() => {
    if (!nouveauId) return;
    const carte = document.getElementById(`mouvement-${nouveauId}`);
    carte?.scrollIntoView({ behavior: "smooth", block: "center" });
    const fin = window.setTimeout(() => setNouveauId(null), 4000);
    return () => window.clearTimeout(fin);
  }, [nouveauId, list]);

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
        updateNoeud,
        societeId,
        societeLibelle: societe?.raisonSociale ?? "Société",
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

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }

  async function exportXlsx() {
    const XLSX = await import("xlsx");
    const header = [
      "Nature", "Écart",
      "Achat: Date", "N° Facture", "Fournisseur", "Produits", "Quantité", "Montant devise", "Devise", "Cours", "Montant TND",
      "Vente: Date", "N° Facture", "Client", "Produits", "Quantité", "Montant devise", "Devise", "Cours", "Montant TND",
      "Douane: N° Déclaration", "Date", "Régime", "Taux de change", "Valeur en douane (TND)", "PTFN", "Exportateur", "Importateur",
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
      m.douaneNumDeclaration, m.douaneDate ?? "", m.douaneRegime, m.douaneTauxChange, m.douaneValeurTnd, m.douanePtfn, m.douaneExportateur, m.douaneImportateur,
      m.note,
    ]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stock");
    XLSX.writeFile(wb, `Stock_${societe?.raisonSociale ?? societeId}.xlsx`);
  }

  return (
    <div>
      <div data-tour="stock-summary">
        <SignatureLedgerBanner
          icon={Boxes}
          eyebrow="Clients & travail · Stock"
          title="Gestion de stock"
          description={`${societe?.raisonSociale ?? "Société"} · ${societe?.code ?? ""}`}
          metrics={[
            { label: "Anomalies (écart ≠ 0)", value: nbAnomalies, tone: nbAnomalies > 0 ? "destructive" : "default" },
            { label: "Qté achetée", value: fmtQ(totals.achatQ) },
            { label: "Qté vendue", value: fmtQ(totals.venteQ) },
            { label: "Montant achats (TND)", value: fmt(totals.achatTnd) },
          ]}
          actions={
            <div data-tour="stock-actions" className="flex flex-wrap items-center gap-2">
              <Button variant="outline" className="signature-ledger__action" onClick={exportXlsx}>
                <Download className="h-4 w-4" />
                Excel
              </Button>
              <Button variant="ledger" onClick={openNew}>
                <Plus className="h-4 w-4" />
                Nouveau mouvement
              </Button>
            </div>
          }
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-accent/30 bg-card" data-tour="stock-register">
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <label className="flex w-fit cursor-pointer items-center gap-3 text-base text-foreground">
            <Checkbox
              checked={onlyAnomalies}
              onCheckedChange={(v) => setOnlyAnomalies(v === true)}
              className="size-5 rounded-md"
            />
            Anomalies seulement {nbAnomalies > 0 && `(${nbAnomalies})`}
          </label>
          <span className="text-sm tabular-nums text-muted-foreground">
            {shown.length} mouvement{shown.length > 1 ? "s" : ""}
          </span>
        </div>
        {shown.length === 0 && (
          <div className="border-t border-accent/25">
            <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
              <span className="grid size-[70px] place-items-center rounded-full bg-accent/15 text-primary">
                <Boxes className="size-7" aria-hidden="true" />
              </span>
              <p className="font-serif text-2xl font-medium text-primary">
                {loading ? "Chargement…" : "Aucun mouvement"}
              </p>
              <p className="max-w-md text-base text-muted-foreground">
                Créez un mouvement : renseignez l'achat, la vente et/ou la douane, ou importez un PDF.
              </p>
              <Button variant="outline" className="mt-2 h-11 rounded-lg px-5" onClick={openNew}>
                <Plus className="h-4 w-4" />
                Nouveau mouvement
              </Button>
            </div>
          </div>
        )}
      </div>

      {shown.length > 0 && (
        <div className="mt-3 flex flex-col gap-3">

          {shown.map((m) => {
            const hasDouane = Boolean(
              m.douaneNumDeclaration || m.douaneDate || m.douaneRegime ||
              m.douaneTauxChange || m.douaneValeurTnd || m.douanePtfn || m.douaneExportateur ||
              m.douaneImportateur || m.douaneDocDataUrl,
            );
            return (
              <div
                data-tour="stock-register"
                key={m.id}
                id={`mouvement-${m.id}`}
                className={cn(
                  "overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-shadow duration-700",
                  nouveauId === m.id && "border-accent shadow-[0_0_0_3px_hsl(var(--accent)/0.35)]",
                )}
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
                      { label: "Taux de change", value: m.douaneTauxChange ? String(m.douaneTauxChange) : "—" },
                      { label: "Valeur douane (TND)", value: m.douaneValeurTnd ? formatNumber(m.douaneValeurTnd) : "—" },
                      { label: "PTFN", value: m.douanePtfn ? formatNumber(m.douanePtfn) : "—" },
                      { label: "Exportateur", value: m.douaneExportateur || "—" },
                      { label: "Importateur", value: m.douaneImportateur || "—" },
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

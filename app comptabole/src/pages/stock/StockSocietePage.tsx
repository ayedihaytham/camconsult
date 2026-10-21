import { useEffect, useMemo, useState } from "react";
import { useParams,useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, Boxes, Download, Plus } from "lucide-react";
import { SignatureLedgerBanner } from "@/components/ledger/SignatureLedgerBanner";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { useSocieteById, useNoeuds, useData } from "@/store/data";
import { useStock, type StockMouvementInput } from "@/store/stock";
import type { StockMouvement } from "@/types";
import { classerDansStructuration } from "@/lib/classement";
import { doublonsStock, resumeDoublons } from "@/lib/facturesDoublons";
import { fmtQuantiteUnite, quantiteEn, recapStock, uniteCommune } from "@/lib/stockRecap";
import { StockMouvementFormSheet } from "./StockMouvementFormSheet";
import { cn } from "@/lib/utils";
import { montantCote } from "@/lib/coursStock";
import { StockRecapTable } from "./StockRecapTable";
import "./stock-page.css";
import { DocPreviewDialog } from "./DocPreviewDialog";

export function StockSocietePage() {
  const { societeId = "" } = useParams();
  const navigate=useNavigate();
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

  // Monnaie des cours et des montants du tableau : dinars (cours de la facture) ou dollars (cours par rapport au dollar).
  const [base, setBase] = useState<"TND" | "USD">("TND");
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

  // Un n° de facture utilisé deux fois fausse les suivis fournisseur et client : il est signalé partout.
  const doublons = useMemo(() => {
    const d = doublonsStock(list);
    return { vente: new Set(d.vente.keys()), achat: new Set(d.achat.keys()) };
  }, [list]);
  const resumeDoubles = useMemo(() => resumeDoublons(list), [list]);
  const estAnomalie = (m: StockMouvement) => m.ecart !== 0 || doublons.vente.has(m.id) || doublons.achat.has(m.id);

  const shown = onlyAnomalies ? list.filter(estAnomalie) : list;
  const nbAnomalies = list.filter(estAnomalie).length;

  const recap = useMemo(() => recapStock(shown), [shown]);

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
      "Nature", "N° mouvement", "Écart", "Unité de l'écart",
      "Achat: Date", "N° Facture", "Fournisseur", "Produits", "Quantité", "Unité", "Montant devise", "Devise", "Cours", "Montant TND", "Cours USD", "Montant USD",
      "Vente: Date", "N° Facture", "Client", "Produits", "Quantité", "Unité", "Montant devise", "Devise", "Cours", "Montant TND", "Cours USD", "Montant USD",
      "Douane: N° Déclaration", "Date", "Type de déclaration", "Taux de change", "Valeur en douane (TND)", "PTFN", "Exportateur", "Importateur",
      "Note",
    ];
    // Une facture peut lister plusieurs produits (voir StockLigne) : le
    // détail par ligne reste consultable à l'écran, l'export agrège en
    // quantité/montant totaux + une colonne "Produits" listant chaque
    // désignation, pour garder une ligne Excel = un dossier.
    const sumQ = (lignes: typeof list[number]["achatLignes"]) => {
      const unite = uniteCommune(lignes);
      return lignes.reduce((s, l) => s + quantiteEn(l, unite), 0);
    };
    const sumTnd = (lignes: typeof list[number]["achatLignes"]) =>
      lignes.reduce((s, l) => s + l.montantTnd, 0);
    const sumDevise = (lignes: typeof list[number]["achatLignes"]) =>
      lignes.reduce((s, l) => s + l.montantDevise, 0);
    const designations = (lignes: typeof list[number]["achatLignes"]) =>
      lignes.map((l) => l.designation).filter(Boolean).join(", ");

    const rows = list.map((m) => [
      m.natureMarchandise, m.venteNumFacture, m.ecart, m.ecartUnite,
      m.achatDate ?? "", m.achatNumFacture, m.fournisseur, designations(m.achatLignes),
      sumQ(m.achatLignes), uniteCommune(m.achatLignes), sumDevise(m.achatLignes), m.achatDevise, m.achatCours, sumTnd(m.achatLignes), m.achatCoursUsd ?? 0, montantCote(m.achatLignes, m.achatCoursUsd, "USD"),
      m.venteDate ?? "", m.venteNumFacture, m.client, designations(m.venteLignes),
      sumQ(m.venteLignes), uniteCommune(m.venteLignes), sumDevise(m.venteLignes), m.venteDevise, m.venteCours, sumTnd(m.venteLignes), m.venteCoursUsd ?? 0, montantCote(m.venteLignes, m.venteCoursUsd, "USD"),
      m.douaneNumDeclaration, m.douaneDate ?? "", m.douaneTypeDeclaration, m.douaneTauxChange, m.douaneValeurTnd, m.douanePtfn, m.douaneExportateur, m.douaneImportateur,
      m.note,
    ]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stock");
    XLSX.writeFile(wb, `Stock_${societe?.raisonSociale ?? societeId}.xlsx`);
  }

  return (
    <div className="stock-page">
      <div data-tour="stock-summary">
        <SignatureLedgerBanner
          icon={Boxes}
          eyebrow="Clients & travail · Stock"
          title="Gestion de stock"
          description={`${societe?.raisonSociale ?? "Société"} · ${societe?.code ?? ""}`}
          metrics={[
            { label: shown.length > 1 ? "Mouvements" : "Mouvement", value: recap.mouvements, loading },
            { label: "Anomalies (écart ≠ 0)", value: recap.anomalies, tone: recap.anomalies > 0 ? "destructive" : "default" },
            ...(resumeDoubles.length > 0
              ? [{ label: "N° de facture en doublon", value: resumeDoubles.length, tone: "destructive" as const }]
              : []),
            { label: "Qté achetée", value: fmtQuantiteUnite(recap.achat.quantite, recap.unite) },
            { label: "Qté vendue", value: fmtQuantiteUnite(recap.vente.quantite, recap.unite) },
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
          <label className="flex w-fit cursor-pointer items-center gap-3 text-sm font-medium text-foreground">
            <Checkbox
              checked={onlyAnomalies}
              onCheckedChange={(v) => setOnlyAnomalies(v === true)}
              className="size-5 rounded-md"
            />
            Anomalies seulement {nbAnomalies > 0 && `(${nbAnomalies})`}
          </label>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div role="group" aria-label="Monnaie des cours et des montants" className="inline-flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
              <span>Cours et montants en</span>
              <span className="inline-flex overflow-hidden rounded-md border border-border">
                {([["TND", "Dinar"], ["USD", "Dollar"]] as const).map(([code, nom]) => (
                  <button
                    key={code}
                    type="button"
                    aria-pressed={base === code}
                    onClick={() => setBase(code)}
                    className={cn("px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", base === code ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted")}
                  >
                    {nom}
                  </button>
                ))}
              </span>
            </div>
            <span className="text-[0.8125rem] tabular-nums text-muted-foreground">
              {shown.length} mouvement{shown.length > 1 ? "s" : ""}
            </span>
          </div>
        </div>
        {resumeDoubles.length > 0 && (
          <div role="alert" className="mx-5 mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <p className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
              {resumeDoubles.length > 1 ? "Numéros de facture en doublon" : "Numéro de facture en doublon"} — risque de compter deux fois la même facture
            </p>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-6">
              {resumeDoubles.map((d) => (
                <li key={`${d.type}-${d.numero}-${d.rangs.join("-")}`}>
                  Facture de {d.type === "vente" ? "vente" : "d'achat"} <span className="font-mono font-bold">{d.numero}</span> : mouvements n°{" "}
                  {d.rangs.join(", ")}
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-xs">Vérifiez le numéro, ou supprimez le mouvement saisi deux fois.</p>
          </div>
        )}
        {shown.length > 0 && (
          <StockRecapTable
            doublons={doublons}
            base={base}
            mouvements={shown}
            nouveauId={nouveauId}
            classing={classing}
            onEdit={(m) => {
              setEditing(m);
              setFormOpen(true);
            }}
            onDelete={setToDelete}
            onPreview={(title, dataUrl) => setPreview({ title, dataUrl })}
            onClasser={handleClasser}
          />
        )}
        {shown.length === 0 && (
          <div className="border-t border-border">
            <div className="flex flex-col items-center px-4 py-11 text-center">
              <h2 className="text-xl font-semibold text-primary">
                {loading ? "Chargement…" : "Aucun mouvement pour cette société"}
              </h2>
              {!loading && (
                <>
                  <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
                    Un mouvement rassemble les trois pièces d'une même marchandise. L'écart entre l'achat et la vente se calcule dès que les quantités sont renseignées.
                  </p>
                  <ul className="mb-7 mt-7 grid w-full max-w-3xl gap-3.5 text-left sm:grid-cols-3" aria-label="Pièces d'un mouvement">
                    {([
                      ["Achat", "La facture d'achat", "Date, fournisseur, devise et cours, produits et quantités.", "bg-accent/30 text-accent-foreground"],
                      ["Vente", "La facture de vente", "Date, client, devise et cours, produits et quantités.", "bg-primary/15 text-primary"],
                      ["Douane", "La déclaration douanière", "N° de déclaration, taux de change, valeur en douane et PTFN.", "bg-success/15 text-success"],
                    ] as const).map(([etiquette, titre, texte, teinte]) => (
                      <li key={etiquette} className="flex flex-col gap-1.5 rounded-[10px] border border-border bg-card p-4">
                        <span className={cn("self-start rounded-full px-2.5 py-0.5 text-xs font-semibold", teinte)}>{etiquette}</span>
                        <p className="mt-1 text-sm font-semibold text-foreground">{titre}</p>
                        <p className="text-[0.8125rem] text-muted-foreground">{texte}</p>
                      </li>
                    ))}
                  </ul>
                  <Button variant="ledger" className="h-10 gap-2 px-5" onClick={openNew}>
                    <Plus className="h-4 w-4" />
                    Nouveau mouvement
                  </Button>
                  <p className="mt-4 max-w-md text-xs text-muted-foreground">
                    Dans la fenêtre du mouvement, vous pouvez importer un PDF : les champs se pré-remplissent et le document reste affiché pour vérifier les chiffres.
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <StockMouvementFormSheet
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditing(null);
        }}
        societeId={societeId}
        mouvement={editing}
        onSubmit={handleSubmit}
        onOpenApurement={m=>{const date=m.achatDate;const period=date?`&annee=${date.slice(0,4)}&trimestre=T${Math.ceil(Number(date.slice(5,7))/3)}`:"";navigate(`/apurement/${societeId}?vue=registre&registre=factures&stockId=${m.id}${period}`);}}
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

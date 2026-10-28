import { useEffect, useMemo, useState } from "react";
import { useParams,useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, Boxes, Download, Eye, EyeOff, Layers, Plus } from "lucide-react";
import { SignatureLedgerBanner } from "@/components/ledger/SignatureLedgerBanner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { useSocieteById, useNoeuds, useData } from "@/store/data";
import { useStock, type StockMouvementInput } from "@/store/stock";
import type { StockMouvement } from "@/types";
import { classerDansStructuration } from "@/lib/classement";
import { doublonsStock, resumeDoublons } from "@/lib/facturesDoublons";
import { fmtQuantiteUnite, quantiteEn, recapStock, trierParNumero, uniteCommune } from "@/lib/stockRecap";
import { StockMouvementFormSheet } from "./StockMouvementFormSheet";
import { cn } from "@/lib/utils";
import { montantCote } from "@/lib/coursStock";
import { api } from "@/lib/api";
import { soldesFactures, type StatutFacture } from "@/lib/fournisseurs";
import type { EtatFournisseurs } from "@/types";
import { StockRecapTable } from "./StockRecapTable";
import { StockRecapSocieteTable } from "./StockRecapSocieteTable";
import { LedgerSegmented } from "@/components/ledger/LedgerSegmented";
import { feuilleRecapSociete, recapSociete } from "@/lib/stockRecapSociete";
import { appliquerFiltresRecap, FILTRES_RECAP_VIDES, sansFiltresDouane, type FiltresRecap } from "@/lib/filtresRecapSociete";
import { download } from "@/lib/export";
import { useIdentiteCabinet } from "@/pages/conversions/useIdentiteCabinet";
import { StockFiltres } from "./StockFiltres";
import { StockMouvementPanel } from "./StockMouvementPanel";
import { comptesSituation, CRITERES_VIDES, filtrerMouvements, valeursTiers, type CriteresStock } from "@/lib/stockFiltres";
import { ecrirePrefsStock, lirePrefsStock, type PrefsTableauStock } from "@/lib/stockPrefs";
import { ImportLotStockDialog } from "./ImportLotStockDialog";
import { champsVidesCote, coteRenseigne, type CoteMouvement } from "@/lib/stockLot";
import "./stock-page.css";
import { DocPreviewDialog } from "./DocPreviewDialog";

const NOMS_COTE: Record<CoteMouvement, string> = { achat: "la facture d'achat", vente: "la facture de vente", douane: "la déclaration douanière" };

/** Prévient qu'une suppression emporte les règlements déjà saisis dans Suivi fournisseur. */
function AvertissementReglements({ info }: { info?: { nb: number; montant: number; devise: string } }) {
  if (!info) return null;
  return (
    <span className="mt-2 block rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-destructive">
      Attention : cette facture d'achat a {info.nb} règlement{info.nb > 1 ? "s" : ""} enregistré{info.nb > 1 ? "s" : ""} dans Suivi fournisseur, pour{" "}
      <strong>{info.montant.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} {info.devise}</strong>. Sa part est retirée de chaque règlement ; un règlement qui ne couvre plus aucune facture est supprimé. Cette action est tracée au journal.
    </span>
  );
}

export function StockSocietePage() {
  const { societeId = "" } = useParams();
  const navigate=useNavigate();
  const societe = useSocieteById(societeId);

  const liste = useStock((s) => s.list);
  // Du plus petit au plus grand n° de mouvement (n° de la facture de vente) : le tableau, les totaux et l'export Excel suivent cet ordre.
  const list = useMemo(() => trierParNumero(liste), [liste]);
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
  const [vue, setVue] = useState<"mouvements" | "recap">("mouvements");
  // Filtres par colonne du récapitulatif : volontairement non mémorisés (remis à zéro au changement de société ou de vue).
  const [filtresRecap, setFiltresRecap] = useState<FiltresRecap>(FILTRES_RECAP_VIDES);
  useEffect(() => setFiltresRecap(FILTRES_RECAP_VIDES), [societeId, vue]);
  const { logo, cabinet } = useIdentiteCabinet();
  // Filtres (situation, client, fournisseur, recherche), préférences d'affichage du tableau et mouvement ouvert dans le panneau de droite.
  const [criteres, setCriteres] = useState<CriteresStock>(CRITERES_VIDES);
  const [prefs, setPrefs] = useState<PrefsTableauStock>(() => lirePrefsStock());
  const [ouvertId, setOuvertId] = useState<string | null>(null);
  const changerPrefs = (p: PrefsTableauStock) => {
    setPrefs(p);
    ecrirePrefsStock(p);
  };
  /** Affiche ou masque la douane (même réglage que « Affichage » des mouvements) ; masquée, ses filtres sont retirés pour ne rien cacher en silence. */
  const basculerDouane = () => {
    changerPrefs({ ...prefs, colonnes: { ...prefs.colonnes, douane: !prefs.colonnes.douane } });
  };
  useEffect(() => {
    if (!prefs.colonnes.douane) setFiltresRecap(sansFiltresDouane);
  }, [prefs.colonnes.douane]);
  const fetchCounts = useStock((s) => s.fetchCounts);
  // Mouvement qui vient d'être enregistré : mis en évidence et amené à l'écran.
  const [nouveauId, setNouveauId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [lotOpen, setLotOpen] = useState(false);
  const [editing, setEditing] = useState<StockMouvement | null>(null);
  const [toDelete, setToDelete] = useState<StockMouvement | null>(null);
  const [aRetirer, setARetirer] = useState<{ m: StockMouvement; cote: CoteMouvement } | null>(null);
  const [preview, setPreview] = useState<{ title: string; dataUrl: string | null } | null>(null);

  useEffect(() => {
    fetchList(societeId);
    return () => clear();
  }, [societeId, fetchList, clear]);

  // Statut de règlement des achats (Suivi fournisseur) : lecture seule, sans message d'erreur si l'accès n'est pas permis.
  const [reglements, setReglements] = useState<ReadonlyMap<string, StatutFacture>>(new Map());
  // Règlements déjà enregistrés par facture d'achat : sert à prévenir avant une suppression qui les emporte.
  const [reglesInfo, setReglesInfo] = useState<ReadonlyMap<string, { nb: number; montant: number; devise: string }>>(new Map());
  useEffect(() => {
    let actif = true;
    api
      .get<EtatFournisseurs>(`/fournisseurs?societeId=${societeId}`)
      .then((etat) => {
        if (!actif) return;
        const soldes = soldesFactures(etat.factures, etat.reglements);
        setReglements(new Map([...soldes].map(([id, s]) => [id, s.statut])));
        const info = new Map<string, { nb: number; montant: number; devise: string }>();
        for (const r of etat.reglements) {
          for (const a of r.affectations) {
            const f = etat.factures.find((x) => x.id === a.mouvementId);
            const courant = info.get(a.mouvementId) ?? { nb: 0, montant: 0, devise: f?.devise ?? r.devise };
            info.set(a.mouvementId, { ...courant, nb: courant.nb + 1, montant: Math.round((courant.montant + a.montant) * 1000) / 1000 });
          }
        }
        setReglesInfo(info);
      })
      .catch(() => {});
    return () => {
      actif = false;
    };
  }, [societeId, list]);

  // Un n° de facture utilisé deux fois fausse les suivis fournisseur et client : il est signalé partout.
  const doublons = useMemo(() => {
    const d = doublonsStock(list);
    return { vente: new Set(d.vente.keys()), achat: new Set(d.achat.keys()) };
  }, [list]);
  const resumeDoubles = useMemo(() => resumeDoublons(list), [list]);

  const shown = useMemo(() => filtrerMouvements(list, criteres), [list, criteres]);
  // Les pastilles de situation comptent avec les autres filtres (client, fournisseur, recherche) appliqués.
  const comptes = useMemo(() => comptesSituation(filtrerMouvements(list, { ...criteres, situation: "tous" })), [list, criteres]);
  const clients = useMemo(() => valeursTiers(list, "client"), [list]);
  const fournisseurs = useMemo(() => valeursTiers(list, "fournisseur"), [list]);
  // Filtre par client seul : les factures de vente seulement ; par fournisseur seul : les factures d'achat seulement ; les deux : les deux côtés.
  const cotes = criteres.clients.size > 0 && criteres.fournisseurs.size === 0 ? "vente" : criteres.fournisseurs.size > 0 && criteres.clients.size === 0 ? "achat" : "les-deux";
  const ouvert = ouvertId ? list.find((m) => m.id === ouvertId) ?? null : null;
  const rangOuvert = ouvert ? shown.findIndex((m) => m.id === ouvert.id) : -1;
  /** Passe au mouvement précédent ou suivant de la liste affichée (en boucle). */
  const naviguer = (delta: -1 | 1) => {
    if (shown.length === 0) return;
    const rang = rangOuvert < 0 ? (delta === 1 ? -1 : 0) : rangOuvert;
    setOuvertId(shown[(rang + delta + shown.length) % shown.length].id);
  };

  const recap = useMemo(() => recapStock(shown), [shown]);
  const recapSoc = useMemo(() => recapSociete(shown), [shown]);
  const recapAffiche = useMemo(() => appliquerFiltresRecap(recapSoc, filtresRecap), [recapSoc, filtresRecap]);

  /** Retire un type de facture (achat, vente ou douane) : si c'est la seule pièce du mouvement, c'est tout le mouvement qui est proposé à la suppression. */
  function demanderRetrait(m: StockMouvement, cote: CoteMouvement) {
    const autres = (["achat", "vente", "douane"] as const).filter((c) => c !== cote);
    if (autres.every((c) => !coteRenseigne(m, c))) setToDelete(m);
    else setARetirer({ m, cote });
  }

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
    // Un filtre actif (situation, client…) pourrait masquer le mouvement qu'on vient d'enregistrer.
    setCriteres(CRITERES_VIDES);
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

  /** Le récapitulatif tel qu'affiché (mêmes lignes filtrées, mêmes colonnes) en Excel du cabinet ou en PDF. */
  async function exporterRecap(format: "xlsx" | "pdf") {
    const base = `Recapitulatif-stock-${societe?.code || "societe"}`;
    const titre = `Récapitulatif des mouvements — ${societe?.raisonSociale ?? "Société"}`;
    const n = recapAffiche.lignes.length;
    const sousTitre = `${n} mouvement${n > 1 ? "s" : ""}${n < recapSoc.lignes.length ? ` sur ${recapSoc.lignes.length} (filtré)` : ""} · édité le ${new Date().toLocaleDateString("fr-FR")}`;
    try {
      const feuille = feuilleRecapSociete(recapAffiche, { douane: prefs.colonnes.douane });
      if (format === "xlsx") {
        const { classeurExcelModele } = await import("@/lib/modeleExcelCabinet");
        const octets = await classeurExcelModele([feuille], { titre, sousTitre, cabinet: cabinet?.nom });
        download(new Blob([octets], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${base}.xlsx`);
      } else {
        const { downloadTablesPdf } = await import("@/lib/pdfTables");
        await downloadTablesPdf({ title: titre, subtitle: sousTitre, sheets: [feuille], fileName: `${base}.pdf`, plain: true, orientation: "landscape", format: "a3", logo, cabinet });
      }
    } catch {
      toast.error(format === "xlsx" ? "Excel impossible" : "PDF impossible");
    }
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
              {vue === "recap" ? (
                <>
                  <Button variant="outline" className="signature-ledger__action" onClick={() => void exporterRecap("xlsx")}>
                    <Download className="h-4 w-4" />
                    Excel
                  </Button>
                  <Button variant="outline" className="signature-ledger__action" onClick={() => void exporterRecap("pdf")}>
                    <Download className="h-4 w-4" />
                    PDF
                  </Button>
                </>
              ) : (
                <Button variant="outline" className="signature-ledger__action" onClick={exportXlsx}>
                  <Download className="h-4 w-4" />
                  Excel
                </Button>
              )}
              <Button variant="outline" className="signature-ledger__action" onClick={() => setLotOpen(true)}>
                <Layers className="h-4 w-4" />
                Importer un lot
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
        <StockFiltres
          criteres={criteres}
          onCriteres={setCriteres}
          clients={clients}
          fournisseurs={fournisseurs}
          comptes={comptes}
          prefs={prefs}
          onPrefs={changerPrefs}
          affiches={shown.length}
          total={list.length}
          droite={
            <div role="group" aria-label="Monnaie des cours et des montants" className="inline-flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
              <span className="hidden 2xl:inline">Cours et montants en</span>
              <span className="inline-flex overflow-hidden rounded-md border border-border">
                {([["TND", "Dinar"], ["USD", "Dollar"]] as const).map(([code, nom]) => (
                  <button
                    key={code}
                    type="button"
                    aria-pressed={base === code}
                    onClick={() => setBase(code)}
                    className={cn("px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", base === code ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent/10")}
                  >
                    {nom}
                  </button>
                ))}
              </span>
            </div>
          }
        />
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
          <div className="flex items-center gap-3 px-5 pt-1">
            <div className="min-w-0 flex-1">
              <LedgerSegmented
                value={vue}
                onChange={setVue}
                ariaLabel="Présentation des mouvements"
                options={[{ value: "mouvements", label: "Mouvements" }, { value: "recap", label: "Récapitulatif" }]}
              />
            </div>
            {vue === "recap" && (
              <button
                type="button"
                aria-pressed={prefs.colonnes.douane}
                onClick={basculerDouane}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  prefs.colonnes.douane ? "border-primary bg-primary/[0.06] text-primary" : "border-border text-muted-foreground hover:bg-accent/10",
                )}
              >
                {prefs.colonnes.douane ? <Eye className="size-3.5" aria-hidden="true" /> : <EyeOff className="size-3.5" aria-hidden="true" />}
                Douane {prefs.colonnes.douane ? "affichée" : "masquée"}
              </button>
            )}
          </div>
        )}
        {shown.length > 0 && vue === "recap" && (
          <div className="mt-3 border-t border-border">
            <StockRecapSocieteTable douane={prefs.colonnes.douane} base={recapSoc} recap={recapAffiche} filtres={filtresRecap} onFiltres={setFiltresRecap} onOuvrir={(id) => { setVue("mouvements"); setOuvertId(id); }} />
          </div>
        )}
        {shown.length > 0 && vue === "mouvements" && (
          <StockRecapTable
            doublons={doublons}
            base={base}
            reglements={reglements}
            colonnes={prefs.colonnes}
            densite={prefs.densite}
            onOuvrir={(m) => setOuvertId(m.id)}
            selectionId={ouvert?.id ?? null}
            cotes={cotes}
            mouvements={shown}
            nouveauId={nouveauId}
            classing={classing}
            onEdit={(m) => {
              setEditing(m);
              setFormOpen(true);
            }}
            onDelete={setToDelete}
            onRetirerCote={demanderRetrait}
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

      <StockMouvementPanel
        mouvement={ouvert}
        position={rangOuvert + 1}
        total={shown.length}
        onNaviguer={naviguer}
        onFermer={() => setOuvertId(null)}
        onEdit={(m) => {
          setOuvertId(null);
          setEditing(m);
          setFormOpen(true);
        }}
        onDelete={setToDelete}
        onRetirerCote={demanderRetrait}
        onPreview={(title, dataUrl) => setPreview({ title, dataUrl })}
        onClasser={handleClasser}
        classing={classing}
        reglement={ouvert ? reglements.get(ouvert.id) : undefined}
      />

      <ImportLotStockDialog
        open={lotOpen}
        onOpenChange={setLotOpen}
        societeId={societeId}
        onCrees={(faits) => setNouveauId(faits[faits.length - 1]?.id ?? null)}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Supprimer ce mouvement ?"
        description={
          <>
            <span className="block">Cette ligne de stock sera définitivement supprimée.</span>
            {toDelete && <AvertissementReglements info={reglesInfo.get(toDelete.id)} />}
          </>
        }
        confirmLabel={toDelete && reglesInfo.has(toDelete.id) ? "Supprimer avec les règlements" : "Supprimer"}
        destructive
        onConfirm={() => {
          if (toDelete) void remove(toDelete.id, { supprimerReglements: reglesInfo.has(toDelete.id) }).catch(() => undefined);
          setToDelete(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(aRetirer)}
        onOpenChange={(o) => !o && setARetirer(null)}
        title={aRetirer ? `Supprimer ${NOMS_COTE[aRetirer.cote]} ?` : ""}
        description={
          <>
            <span className="block">Le mouvement est conservé avec ses autres pièces. Les informations de cette pièce, ses produits et son document joint sont effacés.</span>
            {aRetirer?.cote === "achat" && <AvertissementReglements info={reglesInfo.get(aRetirer.m.id)} />}
          </>
        }
        confirmLabel={aRetirer?.cote === "achat" && reglesInfo.has(aRetirer.m.id) ? "Supprimer avec les règlements" : "Supprimer"}
        destructive
        onConfirm={() => {
          if (aRetirer) {
            const avecReglements = aRetirer.cote === "achat" && reglesInfo.has(aRetirer.m.id);
            void update(aRetirer.m.id, { ...champsVidesCote(aRetirer.cote), apurementRevision: aRetirer.m.apurementRevision, ...(avecReglements ? { supprimerReglements: true } : {}) }).catch(() => undefined);
          }
          setARetirer(null);
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

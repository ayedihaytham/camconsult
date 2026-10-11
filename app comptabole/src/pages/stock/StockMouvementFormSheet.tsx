import { cloneElement, isValidElement, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import {
  AlertTriangle,
  File as FileIcon,
  FileUp,
  Layers,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { CoursSuggere } from "@/components/common/CoursSuggere";
import { coursDuMois, coursParUnite } from "@/lib/coursChange";
import { useCoursChange } from "@/store/coursChange";
import { Button } from "@/components/ui/button";
import { AmountInput } from "@/components/common/AmountInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { readFileAsDataUrl } from "@/lib/file";
import { alleger, poidsMo } from "@/lib/image";
import { cn } from "@/lib/utils";
import { ecartDevise, fmtMontant, totauxCote } from "@/lib/stockRecap";
import { useStock, type StockMouvementInput } from "@/store/stock";
import { mouvementsAvecNumero } from "@/lib/facturesDoublons";
import { useSocieteById } from "@/store/data";
import type { StockChamps, StockDocType, StockExtractPage, StockLigne, StockMouvement } from "@/types";
import { DocPreviewDialog } from "./DocPreviewDialog";
import { VisionneuseDocument } from "./VisionneuseDocument";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  societeId: string;
  mouvement?: StockMouvement | null;
  /** Doit se terminer une fois le mouvement enregistré, et échouer sinon : la
   * fenêtre reste alors ouverte avec toutes les données saisies. */
  onSubmit: (data: StockMouvementInput) => Promise<void> | void;
}

const empty = (societeId: string): StockMouvementInput => ({
  societeId,
  natureMarchandise: "",
  achatDate: null,
  achatNumFacture: "",
  achatDocType: "",
  fournisseur: "",
  achatDevise: "EUR",
  achatCours: 0,
  achatLignes: [],
  venteDate: null,
  venteNumFacture: "",
  venteDocType: "",
  client: "",
  venteDevise: "EUR",
  venteCours: 0,
  venteLignes: [],
  douaneNumDeclaration: "",
  douaneDate: null,
  douaneRegime: "",
  douaneTypeDeclaration: "",
  douaneReference: "",
  douaneTauxChange: 0,
  douaneValeurTnd: 0,
  douanePtfn: 0,
  douaneExportateur: "",
  douaneImportateur: "",
  achatDocDataUrl: null,
  venteDocDataUrl: null,
  douaneDocDataUrl: null,
  note: "",
});

/** Montant en dinars d'une ligne = montant en devise × cours (arrondi au millime). */
const montantTnd = (montantDevise: number, cours: number) =>
  Math.round((montantDevise || 0) * (cours || 0) * 1000) / 1000;

/** Recalcule le montant en dinars de toutes les lignes avec le cours donné. */
const avecMontantsTnd = (lignes: StockLigne[], cours: number): StockLigne[] =>
  lignes.map((l) => ({ ...l, montantTnd: montantTnd(l.montantDevise, cours) }));

/** Facture d'achat ou de vente en devise : son cours devient le cours moyen du mois de sa date pour sa devise (page « Cours de change »),
 * dès que la date ou la devise change — sans effet pour le dinar ni quand aucun cours n'est enregistré pour ce mois. Le cours reste
 * modifiable à la main ensuite ; ouvrir une facture déjà enregistrée ne le change pas. */
function avecCoursMoyen(prev: StockMouvementInput, type: "achat" | "vente"): StockMouvementInput {
  const { cours, devises } = useCoursChange.getState();
  const date = type === "achat" ? prev.achatDate : prev.venteDate;
  const devise = (type === "achat" ? prev.achatDevise : prev.venteDevise).trim().toUpperCase();
  if (!devise || devise === "TND") return prev;
  const trouve = coursDuMois(cours, devise, date);
  if (!trouve) return prev;
  const n = coursParUnite(trouve, devises);
  return type === "achat"
    ? { ...prev, achatCours: n, achatLignes: avecMontantsTnd(prev.achatLignes, n) }
    : { ...prev, venteCours: n, venteLignes: avecMontantsTnd(prev.venteLignes, n) };
}

/** Le taux de change de la douane s'applique aux cours de l'achat et de la vente
 * (et donc aux montants en dinars), sauf si l'un d'eux a été saisi à la main avec
 * une autre valeur : un cours vide, ou qui suivait déjà l'ancien taux de la douane,
 * est mis à jour. */
export function avecTauxDouane(prev: StockMouvementInput, taux: number): StockMouvementInput {
  if (!taux) return { ...prev, douaneTauxChange: taux };
  const suit = (cours: number) => !cours || cours === prev.douaneTauxChange;
  const achatCours = suit(prev.achatCours) ? taux : prev.achatCours;
  const venteCours = suit(prev.venteCours) ? taux : prev.venteCours;
  return {
    ...prev,
    douaneTauxChange: taux,
    achatCours,
    achatLignes: avecMontantsTnd(prev.achatLignes, achatCours),
    venteCours,
    venteLignes: avecMontantsTnd(prev.venteLignes, venteCours),
  };
}

const ligneVide = (): StockLigne => ({
  designation: "",
  quantite: 0,
  prixUnitaire: 0,
  montantDevise: 0,
  montantTnd: 0,
  unite: "",
});

const DOC_FIELD: Record<StockDocType, "achatDocDataUrl" | "venteDocDataUrl" | "douaneDocDataUrl"> = {
  achat: "achatDocDataUrl",
  vente: "venteDocDataUrl",
  douane: "douaneDocDataUrl",
};

const DOC_TITRES: Record<StockDocType, string> = {
  achat: "Facture d'achat",
  vente: "Facture de vente",
  douane: "Document douanier",
};

const DOC_TYPE_LABELS: Record<StockDocType, string> = {
  achat: "Achat",
  vente: "Vente",
  douane: "Douane",
};

/** "ignorer" : l'utilisateur choisit de ne pas utiliser cette page (type
 * mal deviné et non pertinent, page vierge, etc.). */
type BatchAssignment = StockDocType | "ignorer";

export function StockMouvementFormSheet({
  open,
  onOpenChange,
  societeId,
  mouvement,
  onSubmit,
}: Props) {
  const isEdit = Boolean(mouvement);
  const societe = useSocieteById(societeId);
  const extract = useStock((s) => s.extract);
  const mouvements = useStock((s) => s.list);
  const extractPages = useStock((s) => s.extractPages);
  const [v, setV] = useState<StockMouvementInput>(empty(societeId));
  const [importing, setImporting] = useState<StockDocType | null>(null);
  const [onglet, setOnglet] = useState<StockDocType>("achat");
  // Document agrandi (plein écran) et largeur du volet du document.
  const [apercuGrand, setApercuGrand] = useState<{ titre: string; dataUrl: string } | null>(null);
  const [documentLarge, setDocumentLarge] = useState(false);
  // Champs lus dans le document : clé du champ -> valeur lue. Un champ reste surligné tant qu'on n'a pas changé sa valeur.
  const [lus, setLus] = useState<Record<string, string>>({});
  const estLu = (cle: string, courant: unknown) => lus[cle] !== undefined && lus[cle] === String(courant ?? "");
  const signatureLignes = (lignes: StockLigne[]) => JSON.stringify(lignes.map((l) => [l.designation, l.quantite, l.prixUnitaire, l.montantDevise]));
  const lignesLues = (type: "achat" | "vente", lignes: StockLigne[]) => lus[`${type}.lignes`] !== undefined && lus[`${type}.lignes`] === signatureLignes(lignes);
  const marquerLus = (valeurs: Record<string, unknown>) =>
    setLus((prev) => {
      const suite = { ...prev };
      for (const [cle, valeur] of Object.entries(valeurs)) if (valeur !== undefined && valeur !== null && valeur !== "" && valeur !== 0) suite[cle] = String(valeur);
      return suite;
    });
  const fileInputs = {
    achat: useRef<HTMLInputElement>(null),
    vente: useRef<HTMLInputElement>(null),
    douane: useRef<HTMLInputElement>(null),
  };

  // Import "document complet" : un seul fichier (ex. PDF de plusieurs
  // pages), une page par pièce (achat/vente/douane) — analysée séparément,
  // type deviné, toujours à confirmer avant application (voir panneau plus
  // bas et le point discuté avec l'utilisateur : jamais 100% automatique).
  const batchInputRef = useRef<HTMLInputElement>(null);
  const [batchImporting, setBatchImporting] = useState(false);
  const [batchPages, setBatchPages] = useState<StockExtractPage[] | null>(null);
  const [batchAssignments, setBatchAssignments] = useState<
    Record<number, BatchAssignment>
  >({});
  const [batchApplying, setBatchApplying] = useState(false);
  // Vérification avant application : lecture en grand d'une page du
  // document complet, avant même de choisir son type — jamais d'application
  // à l'aveugle sur la seule foi de la petite vignette (voir demande de
  // l'utilisateur : "prévisualiser vérifier avant importer").
  const [batchPreview, setBatchPreview] = useState<StockExtractPage | null>(null);

  // Protection des données saisies et importées : la fenêtre ne se ferme ni par
  // un clic à côté, ni par Échap, ni pendant une lecture ou un enregistrement.
  const [saving, setSaving] = useState(false);
  const [envoiMo, setEnvoiMo] = useState(0);
  const [confirmClose, setConfirmClose] = useState(false);
  const initialJson = useRef("");
  const busy = saving || importing !== null || batchImporting || batchApplying;
  const busyRef = useRef(false);
  busyRef.current = busy;
  // Comparaison faite à la demande seulement : les documents joints pèsent plusieurs Mo.
  const isDirty = () => JSON.stringify(v) !== initialJson.current;
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  function demanderFermeture() {
    if (busy) {
      toast.info(
        saving
          ? "Enregistrement en cours : patientez quelques secondes."
          : "Lecture du document en cours : patientez la fin avant de fermer.",
      );
      return;
    }
    if (isDirty()) setConfirmClose(true);
    else onOpenChange(false);
  }

  // N° de facture déjà saisi dans un autre mouvement de cette société : alerte, puis confirmation à l'enregistrement.
  const exceptId = mouvement?.id ?? null;
  const doublonAchat = mouvementsAvecNumero(mouvements, "achat", v.achatNumFacture, v.fournisseur, exceptId);
  const doublonVente = mouvementsAvecNumero(mouvements, "vente", v.venteNumFacture, "", exceptId);
  const rang = (id: string) => mouvements.findIndex((x) => x.id === id) + 1;
  const [confirmDoublon, setConfirmDoublon] = useState(false);

  async function enregistrer(force = false) {
    if (busy) return;
    if (!force && (doublonAchat.length > 0 || doublonVente.length > 0)) {
      setConfirmDoublon(true);
      return;
    }
    setEnvoiMo(poidsMo(JSON.stringify(v)));
    setSaving(true);
    try {
      await onSubmit(v);
      initialJson.current = JSON.stringify(v);
      onOpenChange(false);
    } catch {
      // Le store a déjà affiché l'erreur : la fenêtre reste ouverte, rien n'est perdu.
    } finally {
      setSaving(false);
    }
  }

  // Fermeture ou rechargement de l'onglet pendant une opération ou avec une saisie non enregistrée.
  useEffect(() => {
    if (!open) return;
    const avertir = (e: BeforeUnloadEvent) => {
      if (busyRef.current || isDirtyRef.current()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", avertir);
    return () => window.removeEventListener("beforeunload", avertir);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const depart = mouvement ? { ...mouvement } : empty(societeId);
    setV(depart);
    initialJson.current = JSON.stringify(depart);
    setConfirmClose(false);
    setOnglet("achat");
    setLus({});
    setApercuGrand(null);
    setBatchPages(null);
    setBatchAssignments({});
  }, [open, mouvement, societeId]);

  function set<K extends keyof StockMouvementInput>(
    key: K,
    value: StockMouvementInput[K],
  ) {
    setV((s) => ({ ...s, [key]: value }));
  }

  async function handleImport(type: StockDocType, file: File) {
    setImporting(type);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      // On garde le document joint pour pouvoir vérifier les chiffres avant
      // d'enregistrer (et le retrouver plus tard).
      // Le document joint est allégé (JPEG) ; la lecture automatique reçoit l'original, plus net.
      set(DOC_FIELD[type], await alleger(dataUrl));
      setOnglet(type);
      const { champs, source } = await extract(type, dataUrl, societeId);
      applyChamps(type, champs);
      toast.success(
        source === "ruspina"
          ? "Champs extraits par le moteur RUSPINA — comparez avec le document ci-dessous avant d'enregistrer"
          : "Champs extraits par l'IA — comparez avec le document ci-dessous avant d'enregistrer",
      );
    } catch {
      /* le store affiche déjà l'erreur */
    } finally {
      setImporting(null);
    }
  }

  function applyChamps(type: StockDocType, champs: StockChamps) {
    if (type === "achat") {
      marquerLus({
        achatDate: champs.date,
        achatNumFacture: champs.numFacture,
        fournisseur: champs.fournisseur,
        achatDevise: champs.devise,
        "achat.lignes": champs.lignes && champs.lignes.length > 0 ? signatureLignes(champs.lignes) : undefined,
      });
    } else if (type === "vente") {
      marquerLus({
        venteDate: champs.date,
        venteNumFacture: champs.numFacture,
        client: champs.client,
        venteDevise: champs.devise,
        "vente.lignes": champs.lignes && champs.lignes.length > 0 ? signatureLignes(champs.lignes) : undefined,
      });
    } else {
      marquerLus({
        douaneNumDeclaration: champs.numDeclaration,
        douaneDate: champs.date,
        douaneTypeDeclaration: champs.typeDeclaration,
        douaneTauxChange: champs.tauxChange,
        douaneValeurTnd: champs.valeurTnd,
        douanePtfn: champs.ptfn,
        douaneExportateur: champs.exportateur,
        douaneImportateur: champs.importateur,
      });
    }
    if (type === "achat") {
      setV((prev) => avecCoursMoyen({
        ...prev,
        achatDate: champs.date || prev.achatDate,
        achatNumFacture: champs.numFacture || prev.achatNumFacture,
        fournisseur: champs.fournisseur || prev.fournisseur,
        // Dossier auto-rempli depuis le 1er produit détecté, seulement s'il
        // est encore vide — l'utilisateur peut toujours le personnaliser
        // ensuite (facture à plusieurs produits, ex. « Ciment + Sacs »).
        natureMarchandise: prev.natureMarchandise || champs.lignes?.[0]?.designation || "",
        achatDevise: champs.devise || prev.achatDevise,
        achatLignes:
          champs.lignes && champs.lignes.length > 0
            ? avecMontantsTnd(champs.lignes, prev.achatCours)
            : prev.achatLignes,
      }, "achat"));
    } else if (type === "vente") {
      setV((prev) => avecCoursMoyen({
        ...prev,
        venteDate: champs.date || prev.venteDate,
        venteNumFacture: champs.numFacture || prev.venteNumFacture,
        client: champs.client || prev.client,
        natureMarchandise: prev.natureMarchandise || champs.lignes?.[0]?.designation || "",
        venteDevise: champs.devise || prev.venteDevise,
        venteLignes:
          champs.lignes && champs.lignes.length > 0
            ? avecMontantsTnd(champs.lignes, prev.venteCours)
            : prev.venteLignes,
      }, "vente"));
    } else {
      setV((prev) => avecTauxDouane({
        ...prev,
        douaneNumDeclaration: champs.numDeclaration || prev.douaneNumDeclaration,
        douaneDate: champs.date || prev.douaneDate,
        douaneTypeDeclaration: champs.typeDeclaration || prev.douaneTypeDeclaration,
        douaneReference: champs.reference || prev.douaneReference,
        douaneValeurTnd: champs.valeurTnd || prev.douaneValeurTnd,
        douanePtfn: champs.ptfn || prev.douanePtfn,
        douaneExportateur: champs.exportateur || prev.douaneExportateur,
        douaneImportateur: champs.importateur || prev.douaneImportateur,
      }, champs.tauxChange || prev.douaneTauxChange));
    }
  }

  async function handleBatchImport(file: File) {
    setBatchImporting(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const pages = await extractPages(societeId, dataUrl);
      setBatchPages(pages);
      setBatchAssignments(
        Object.fromEntries(
          pages.map((p) => [p.index, (p.guessedType ?? "ignorer") as BatchAssignment]),
        ),
      );
    } catch {
      /* le store affiche déjà l'erreur */
    } finally {
      setBatchImporting(false);
    }
  }

  async function applyBatch() {
    if (!batchPages) return;
    setBatchApplying(true);
    try {
      for (const page of batchPages) {
        const assignment = batchAssignments[page.index];
        if (!assignment || assignment === "ignorer") continue;
        // Déjà calculés pour les 3 types à l'extraction (voir ocr.js) : pas
        // besoin de relancer quoi que ce soit même si l'utilisateur corrige
        // le type deviné.
        applyChamps(assignment, page.champsByType[assignment]);
        if (page.imageDataUrl) set(DOC_FIELD[assignment], await alleger(page.imageDataUrl));
        setOnglet(assignment);
      }
      toast.success(
        "Champs appliqués depuis le document complet — comparez chaque section avec sa page avant d'enregistrer.",
      );
      setBatchPages(null);
      setBatchAssignments({});
    } finally {
      setBatchApplying(false);
    }
  }

  function ImportButton({ type }: { type: StockDocType }) {
    const ref = fileInputs[type];
    return (
      <>
        <input
          ref={ref}
          type="file"
          accept="application/pdf,image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImport(type, f);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={importing !== null}
          onClick={() => ref.current?.click()}
        >
          {importing === type ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileUp className="h-3.5 w-3.5" />
          )}
          {v[DOC_FIELD[type]] ? "Remplacer le PDF" : "Importer un PDF"}
        </Button>
      </>
    );
  }

  function DocPreview({ type }: { type: StockDocType }) {
    const dataUrl = v[DOC_FIELD[type]];
    if (!dataUrl) {
      return (
        <div className="flex min-h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card px-6 py-10 text-center">
          <FileUp className="size-6 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">Aucun document pour cette section</p>
          <p className="text-xs text-muted-foreground">Importez un PDF ou une image : les champs se pré-remplissent et le document reste affiché ici.</p>
        </div>
      );
    }
    return (
      <div className="space-y-1.5 rounded-lg border border-border bg-card p-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-medium text-foreground">Document importé</p>
          <button type="button" onClick={() => set(DOC_FIELD[type], null)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive">
            <X className="h-3 w-3" />
            Retirer
          </button>
        </div>
        <VisionneuseDocument dataUrl={dataUrl} titre={DOC_TITRES[type]} className="h-[calc(94vh-22rem)] min-h-72" onAgrandir={() => setApercuGrand({ titre: DOC_TITRES[type], dataUrl })} />
      </div>
    );
  }

  /** Une section est complète quand elle porte l'essentiel : facture et tiers avec au moins un produit, ou n° de déclaration. */
  function sectionComplete(type: StockDocType): boolean {
    const plein = (texte?: string | null) => (texte ?? "").trim() !== "";
    if (type === "douane") return plein(v.douaneNumDeclaration);
    return type === "achat"
      ? plein(v.achatNumFacture) && plein(v.fournisseur) && (v.achatLignes?.length ?? 0) > 0
      : plein(v.venteNumFacture) && plein(v.client) && (v.venteLignes?.length ?? 0) > 0;
  }

  const quantiteAchat = v.achatLignes.reduce((total, l) => total + (l.quantite || 0), 0);
  const quantiteVente = v.venteLignes.reduce((total, l) => total + (l.quantite || 0), 0);
  const ecartConnu = quantiteAchat > 0 && quantiteVente > 0;
  const ecart = Math.round((quantiteAchat - quantiteVente) * 1000) / 1000;
  const ecartDeviseSaisie = ecartDevise(v);
  const margeConnue = v.achatLignes.length > 0 && v.venteLignes.length > 0;
  const marge = Math.round((totauxCote(v.venteLignes).montantTnd - totauxCote(v.achatLignes).montantTnd) * 1000) / 1000;

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : demanderFermeture())}>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          demanderFermeture();
        }}
        className="flex h-[94vh] max-h-[94vh] w-[96vw] max-w-[1600px] flex-col gap-0 overflow-hidden rounded-2xl border-accent/30 p-0">
        <div className="shrink-0 border-b border-border px-6 pb-3 pt-5 sm:px-8">
          <DialogTitle className="pr-8 font-serif text-2xl font-medium text-primary">
            {isEdit ? "Modifier le mouvement" : "Nouveau mouvement de stock"}
          </DialogTitle>
          <DialogDescription className="mt-0.5 text-sm text-muted-foreground">
            Importez un PDF par section pour pré-remplir les champs : le document reste affiché à droite pour vérifier les chiffres avant d'enregistrer.
          </DialogDescription>
        </div>

        {/* ── Nature de la marchandise + import du document complet ──────── */}
        <div className="shrink-0 border-b border-border bg-secondary/40 px-6 py-3 sm:px-8">
          <input
            ref={batchInputRef}
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleBatchImport(f);
              e.target.value = "";
            }}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Label htmlFor="mouvement-nature" className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">Nature de la marchandise</Label>
            <Input
              id="mouvement-nature"
              value={v.natureMarchandise}
              onChange={(e) => set("natureMarchandise", e.target.value)}
              placeholder="Ex. HOT WASHED PET FLAKES"
              className="min-w-56 flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={batchImporting}
              onClick={() => batchInputRef.current?.click()}
              className="shrink-0 border-dashed"
              title="Un seul fichier regroupant plusieurs pièces : chaque page est analysée et son type deviné, à confirmer avant application"
            >
              {batchImporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Layers className="h-3.5 w-3.5" />}
              Importer un document complet
            </Button>
          </div>

          {batchPages && (
            <div className="mt-3 space-y-3 rounded-md border border-border bg-card p-3">
              <p className="text-xs font-medium text-foreground">
                {batchPages.length} page{batchPages.length > 1 ? "s" : ""} détectée{batchPages.length > 1 ? "s" : ""} — cliquez sur une page
                pour la lire en grand, vérifiez son type avant d'appliquer.
              </p>
              <p className="text-[11px] text-muted-foreground">
                Le type Achat/Vente est déterminé d'après l'émetteur (en-tête de la facture) et le client : « Achat » si «{" "}
                {societe?.raisonSociale || "…"} » est le client, « Vente » si elle est l'émetteur. Si aucun des deux ne correspond, choisissez le
                type vous-même ci-dessous.
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {batchPages.map((page) => {
                  const undetected = !page.guessedType;
                  return (
                    <div key={page.index} className={cn("space-y-1.5 rounded-md border p-2", undetected ? "border-warning/40 bg-warning/[0.06]" : "border-border")}>
                      {page.imageDataUrl ? (
                        <button type="button" onClick={() => setBatchPreview(page)} className="block w-full" title="Voir la page en grand">
                          <img src={page.imageDataUrl} alt={`Page ${page.index + 1}`} className="h-36 w-full cursor-zoom-in rounded border border-border bg-white object-cover object-top transition-opacity hover:opacity-80" />
                        </button>
                      ) : (
                        <div className="flex h-24 w-full items-center justify-center rounded border border-border bg-secondary/40">
                          <FileIcon className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <p className="text-[11px] font-medium text-muted-foreground">
                        Page {page.index + 1}
                        {page.guessedType ? (
                          <>
                            {" "}· deviné : {DOC_TYPE_LABELS[page.guessedType]}
                            {page.confidence === "faible" && " (incertain)"}
                          </>
                        ) : (
                          <span className="text-warning"> · type non détecté</span>
                        )}
                      </p>
                      <Select
                        value={batchAssignments[page.index] ?? "ignorer"}
                        onValueChange={(val) => setBatchAssignments((prev) => ({ ...prev, [page.index]: val as BatchAssignment }))}
                      >
                        <SelectTrigger className={cn("h-8 text-xs", undetected && batchAssignments[page.index] === "ignorer" && "border-warning/60")}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="achat">Achat</SelectItem>
                          <SelectItem value="vente">Vente</SelectItem>
                          <SelectItem value="douane">Douane</SelectItem>
                          <SelectItem value="ignorer">Ignorer cette page</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => { setBatchPages(null); setBatchAssignments({}); }}>
                  Annuler
                </Button>
                <Button type="button" variant="ledger" size="sm" disabled={batchApplying} onClick={applyBatch}>
                  {batchApplying && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Appliquer aux sections
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ── Onglets Achat / Vente / Douane ──────── */}
        <div role="tablist" aria-label="Sections du mouvement" className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-4 sm:px-6">
          {(["achat", "vente", "douane"] as const).map((type) => {
            const ok = sectionComplete(type);
            return (
              <button
                key={type}
                type="button"
                role="tab"
                id={`onglet-${type}`}
                aria-selected={onglet === type}
                aria-controls={`panneau-${type}`}
                onClick={() => setOnglet(type)}
                className={cn(
                  "-mb-px flex min-h-11 shrink-0 items-center gap-2 border-b-[3px] px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  onglet === type ? "border-accent text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <span aria-hidden="true" className={cn("grid size-[1.15rem] place-items-center rounded-full text-[0.65rem] font-extrabold", ok ? "bg-success text-white" : "bg-muted text-muted-foreground")}>{ok ? "✓" : "·"}</span>
                {DOC_TYPE_LABELS[type]}
                {ok && <span className="sr-only"> (complète)</span>}
              </button>
            );
          })}
        </div>

        <div className={cn("grid min-h-0 flex-1 overflow-hidden", documentLarge ? "lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]" : "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]")}>
          <div className="min-h-0 space-y-4 overflow-y-auto px-6 py-5 sm:px-8">
            {Object.keys(lus).length > 0 && (
              <p className="flex items-center gap-2 rounded-md bg-accent/15 px-3 py-2 text-xs text-foreground">
                <span aria-hidden="true" className="size-2.5 shrink-0 rounded-sm bg-accent" />
                Les champs surlignés ont été lus dans le document. Comparez-les avec le document, puis corrigez : le surlignage disparaît dès que vous modifiez un champ.
              </p>
            )}
            {/* ── Achat ─────────────────────────── */}
            <section id="panneau-achat" role="tabpanel" aria-labelledby="onglet-achat" hidden={onglet !== "achat"} className="space-y-4">
              {doublonAchat.length > 0 && (
                <p role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    N° de facture d'achat déjà utilisé dans le mouvement n° {doublonAchat.map((x) => rang(x.id)).join(", ")}. Une même facture comptée deux fois fausse les suivis : vérifiez le numéro.
                  </span>
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <Field label="Date" lu={estLu("achatDate", v.achatDate)}>
                  <Input type="date" value={v.achatDate ?? ""} onChange={(e) => setV((prev) => avecCoursMoyen({ ...prev, achatDate: e.target.value || null }, "achat"))} />
                </Field>
                <Field label="N° Facture" lu={estLu("achatNumFacture", v.achatNumFacture)}>
                  <Input value={v.achatNumFacture} onChange={(e) => set("achatNumFacture", e.target.value)} />
                </Field>
                <Field label="Fournisseur" lu={estLu("fournisseur", v.fournisseur)}>
                  <Input value={v.fournisseur} onChange={(e) => set("fournisseur", e.target.value)} />
                </Field>
                <Field label="Devise" lu={estLu("achatDevise", v.achatDevise)}>
                  <Input value={v.achatDevise} onChange={(e) => setV((prev) => avecCoursMoyen({ ...prev, achatDevise: e.target.value }, "achat"))} />
                </Field>
                <Field
                  label="Cours (taux de change)"
                  aide={
                    <CoursSuggere
                      devise={v.achatDevise}
                      date={v.achatDate}
                      courant={v.achatCours}
                      onAppliquer={(n) => setV((prev) => ({ ...prev, achatCours: n, achatLignes: avecMontantsTnd(prev.achatLignes, n) }))}
                    />
                  }
                >
                  <AmountInput value={v.achatCours} decimals={4} onValueChange={(n) => setV((prev) => ({ ...prev, achatCours: n, achatLignes: avecMontantsTnd(prev.achatLignes, n) }))} />
                </Field>
              </div>
              <LignesEditor lues={lignesLues("achat", v.achatLignes)} lignes={v.achatLignes} cours={v.achatCours} devise={v.achatDevise} onChange={(lignes) => set("achatLignes", lignes)} />
            </section>

            {/* ── Vente ─────────────────────────── */}
            <section id="panneau-vente" role="tabpanel" aria-labelledby="onglet-vente" hidden={onglet !== "vente"} className="space-y-4">
              {doublonVente.length > 0 && (
                <p role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    N° de facture de vente déjà utilisé dans le mouvement n° {doublonVente.map((x) => rang(x.id)).join(", ")}. Une même facture comptée deux fois fausse les suivis : vérifiez le numéro.
                  </span>
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <Field label="Date" lu={estLu("venteDate", v.venteDate)}>
                  <Input type="date" value={v.venteDate ?? ""} onChange={(e) => setV((prev) => avecCoursMoyen({ ...prev, venteDate: e.target.value || null }, "vente"))} />
                </Field>
                <Field label="N° Facture" lu={estLu("venteNumFacture", v.venteNumFacture)}>
                  <Input value={v.venteNumFacture} onChange={(e) => set("venteNumFacture", e.target.value)} />
                </Field>
                <Field label="Client" lu={estLu("client", v.client)}>
                  <Input value={v.client} onChange={(e) => set("client", e.target.value)} />
                </Field>
                <Field label="Devise" lu={estLu("venteDevise", v.venteDevise)}>
                  <Input value={v.venteDevise} onChange={(e) => setV((prev) => avecCoursMoyen({ ...prev, venteDevise: e.target.value }, "vente"))} />
                </Field>
                <Field
                  label="Cours (taux de change)"
                  aide={
                    <CoursSuggere
                      devise={v.venteDevise}
                      date={v.venteDate}
                      courant={v.venteCours}
                      onAppliquer={(n) => setV((prev) => ({ ...prev, venteCours: n, venteLignes: avecMontantsTnd(prev.venteLignes, n) }))}
                    />
                  }
                >
                  <AmountInput value={v.venteCours} decimals={4} onValueChange={(n) => setV((prev) => ({ ...prev, venteCours: n, venteLignes: avecMontantsTnd(prev.venteLignes, n) }))} />
                </Field>
              </div>
              <LignesEditor lues={lignesLues("vente", v.venteLignes)} lignes={v.venteLignes} cours={v.venteCours} devise={v.venteDevise} onChange={(lignes) => set("venteLignes", lignes)} />
            </section>

            {/* ── Douane ────────────────────────── */}
            <section id="panneau-douane" role="tabpanel" aria-labelledby="onglet-douane" hidden={onglet !== "douane"} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <Field label="N° Déclaration" lu={estLu("douaneNumDeclaration", v.douaneNumDeclaration)}>
                  <Input value={v.douaneNumDeclaration} onChange={(e) => set("douaneNumDeclaration", e.target.value)} />
                </Field>
                <Field label="Date" lu={estLu("douaneDate", v.douaneDate)}>
                  <Input type="date" value={v.douaneDate ?? ""} onChange={(e) => set("douaneDate", e.target.value || null)} />
                </Field>
                <Field label="Type de déclaration" lu={estLu("douaneTypeDeclaration", v.douaneTypeDeclaration)}>
                  <Input value={v.douaneTypeDeclaration} onChange={(e) => set("douaneTypeDeclaration", e.target.value)} placeholder="E" />
                </Field>
                <Field label="Taux de change (TND)" lu={estLu("douaneTauxChange", v.douaneTauxChange)}>
                  <AmountInput value={v.douaneTauxChange} onValueChange={(n) => setV((prev) => avecTauxDouane(prev, n))} decimals={4} />
                </Field>
                <Field label="Valeur en douane (TND)" lu={estLu("douaneValeurTnd", v.douaneValeurTnd)}>
                  <AmountInput value={v.douaneValeurTnd} onValueChange={(n) => set("douaneValeurTnd", n)} />
                </Field>
                <Field label="PTFN" lu={estLu("douanePtfn", v.douanePtfn)}>
                  <AmountInput value={v.douanePtfn} onValueChange={(n) => set("douanePtfn", n)} />
                </Field>
                <div className="sm:col-span-2 xl:col-span-1">
                  <Field label="Exportateur" lu={estLu("douaneExportateur", v.douaneExportateur)}>
                    <Input value={v.douaneExportateur} onChange={(e) => set("douaneExportateur", e.target.value)} />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Importateur" lu={estLu("douaneImportateur", v.douaneImportateur)}>
                    <Input value={v.douaneImportateur} onChange={(e) => set("douaneImportateur", e.target.value)} />
                  </Field>
                </div>
              </div>
            </section>

            <Field label="Note">
              <Textarea rows={2} value={v.note} onChange={(e) => set("note", e.target.value)} />
            </Field>
          </div>

          {/* ── Document de la section affichée, à côté de la saisie ──────── */}
          <aside aria-label="Document de la section" className="min-h-0 overflow-y-auto border-t border-border bg-secondary/40 px-5 py-5 lg:border-l lg:border-t-0">
            {(["achat", "vente", "douane"] as const).map((type) => (
              <div key={type} hidden={onglet !== type} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">{DOC_TITRES[type]}</h3>
                  <span className="flex flex-wrap items-center gap-2">
                    <ImportButton type={type} />
                    <Button type="button" variant="outline" size="sm" className="hidden lg:inline-flex" aria-pressed={documentLarge} onClick={() => setDocumentLarge((x) => !x)}>
                      {documentLarge ? "Réduire le document" : "Élargir le document"}
                    </Button>
                  </span>
                </div>
                <DocPreview type={type} />
                {v[DOC_FIELD[type]] && <p className="text-xs text-muted-foreground">Comparez les chiffres du document avec ceux de la saisie, et corrigez à gauche si besoin.</p>}
              </div>
            ))}
          </aside>
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t border-border px-6 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <span
                className={cn("size-2 shrink-0 rounded-[2px]", ecartConnu && ecart !== 0 ? "bg-destructive" : "bg-muted-foreground/50")}
                aria-hidden="true"
              />
              {ecartConnu
                ? <>Écart achat − vente : <b className={cn("tabular-nums", ecart !== 0 ? "text-destructive" : "text-success")}>{ecart.toLocaleString("fr-FR", { maximumFractionDigits: 3 })}</b></>
                : "Renseignez au moins deux quantités pour contrôler l'écart."}
            </span>
            {ecartDeviseSaisie && (
              <span>Vente − achat : <b className="tabular-nums text-foreground">{fmtMontant(ecartDeviseSaisie.valeur)} {ecartDeviseSaisie.devise}</b></span>
            )}
            {margeConnue && (
              <span>Marge TND : <b className={cn("tabular-nums", marge >= 0 ? "text-success" : "text-destructive")}>{fmtMontant(marge)}</b></span>
            )}
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" className="h-11 rounded-lg px-6" onClick={demanderFermeture}>
              Annuler
            </Button>
            <Button
              type="button"
              variant="ledger"
              className="h-11 rounded-lg px-6 text-sm uppercase tracking-[0.14em]"
              disabled={busy}
              onClick={() => void enregistrer()}
            >
              {saving ? `Enregistrement…${envoiMo >= 0.5 ? ` (${envoiMo.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo)` : ""}` : isEdit ? "Enregistrer" : "Enregistrer le mouvement"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <ConfirmDialog
      open={confirmDoublon}
      onOpenChange={setConfirmDoublon}
      title="Numéro de facture déjà utilisé"
      description={
        <>
          {doublonAchat.length > 0 && (
            <span className="block">
              La facture d'achat <strong>{v.achatNumFacture}</strong> existe déjà dans le mouvement n° {doublonAchat.map((x) => rang(x.id)).join(", ")}.
            </span>
          )}
          {doublonVente.length > 0 && (
            <span className="block">
              La facture de vente <strong>{v.venteNumFacture}</strong> existe déjà dans le mouvement n° {doublonVente.map((x) => rang(x.id)).join(", ")}.
            </span>
          )}
          <span className="mt-2 block">L'enregistrer quand même comptera deux fois la même facture dans les suivis.</span>
        </>
      }
      confirmLabel="Enregistrer quand même"
      cancelLabel="Corriger le numéro"
      destructive
      onConfirm={() => {
        setConfirmDoublon(false);
        void enregistrer(true);
      }}
    />

    <ConfirmDialog
      open={confirmClose}
      onOpenChange={setConfirmClose}
      title="Abandonner ce mouvement ?"
      description="Les informations saisies et les documents importés seront perdus."
      confirmLabel="Abandonner"
      cancelLabel="Continuer la saisie"
      onConfirm={() => {
        setConfirmClose(false);
        onOpenChange(false);
      }}
    />

    <DocPreviewDialog
      open={Boolean(apercuGrand)}
      onOpenChange={(o) => !o && setApercuGrand(null)}
      title={apercuGrand?.titre ?? ""}
      dataUrl={apercuGrand?.dataUrl ?? null}
    />

    <DocPreviewDialog
      open={Boolean(batchPreview)}
      onOpenChange={(o) => !o && setBatchPreview(null)}
      title={batchPreview ? `Page ${batchPreview.index + 1} — à vérifier avant d'appliquer` : ""}
      dataUrl={batchPreview?.imageDataUrl ?? null}
    />
    </>
  );
}

function Field({ label, children, aide, lu = false }: { label: string; children: React.ReactNode; /** Texte ou bouton d'aide sous le champ (ex. cours moyen du mois). */ aide?: React.ReactNode; /** Valeur lue dans le document et pas encore modifiée : champ surligné. */ lu?: boolean }) {
  const generated = useId();
  const child =
    isValidElement<{ id?: string; className?: string }>(children) && (children.type === Input || children.type === Textarea || children.type === AmountInput)
      ? cloneElement(children, { id: children.props.id ?? generated, className: cn(children.props.className, lu && "border-accent bg-accent/15 ring-1 ring-accent/60") })
      : children;
  const id = isValidElement<{ id?: string }>(child) && child.props.id ? child.props.id : generated;
  return (
    <div className="min-w-0 space-y-1">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id} className="text-[0.66rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</Label>
        {lu && <span className="rounded bg-accent/30 px-1 text-[0.58rem] text-accent-foreground">lu dans le document</span>}
      </div>
      {child}
      {aide}
    </div>
  );
}

/** Une facture peut lister plusieurs marchandises à des quantités
 * différentes, pas une seule — une ligne par produit, ajoutée/supprimée
 * librement (voir aussi ligneVide() et le schéma serveur stock_lignes). */
function LignesEditor({
  lignes,
  cours,
  devise,
  lues = false,
  onChange,
}: {
  /** Produits lus dans le document et pas encore modifiés. */
  lues?: boolean;
  lignes: StockLigne[];
  /** Cours (taux de change) de la section : le montant en dinars en découle. */
  cours: number;
  devise: string;
  onChange: (lignes: StockLigne[]) => void;
}) {
  function update(i: number, patch: Partial<StockLigne>) {
    onChange(
      lignes.map((l, idx) => {
        if (idx !== i) return l;
        const next = { ...l, ...patch };
        // Le montant en dinars suit le montant en devise (il reste modifiable à la main ensuite).
        if ("montantDevise" in patch) next.montantTnd = montantTnd(next.montantDevise, cours);
        return next;
      }),
    );
  }
  function remove(i: number) {
    onChange(lignes.filter((_, idx) => idx !== i));
  }
  const total = totauxCote(lignes);
  const colonnes = "grid grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_2.25rem] items-center gap-2";
  const entete = "text-[0.62rem] font-bold uppercase tracking-[0.08em] text-muted-foreground";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Label className="text-[0.66rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">Produits</Label>
          {lues && <span className="rounded bg-accent/30 px-1 text-[0.58rem] text-accent-foreground">lus dans le document</span>}
        </div>
      </div>
      {lignes.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">Aucune ligne de produit.</p>
      ) : (
        <div className={cn("space-y-1.5", lues && "rounded-lg border border-accent bg-accent/10 p-2 ring-1 ring-accent/60")}>
          <div className={cn(colonnes, "px-0.5")} aria-hidden="true">
            <span className={entete}>Désignation</span>
            <span className={cn(entete, "text-right")}>Qté</span>
            <span className={entete}>Unité</span>
            <span className={cn(entete, "text-right")}>P.U.</span>
            <span className={cn(entete, "text-right")}>Mt devise</span>
            <span className={cn(entete, "text-right")}>Mt TND</span>
            <span />
          </div>
          {lignes.map((l, i) => (
            <div key={i} className={colonnes}>
              <Input value={l.designation} onChange={(e) => update(i, { designation: e.target.value })} placeholder="Désignation" aria-label="Désignation" />
              <AmountInput value={l.quantite} onValueChange={(n) => update(i, { quantite: n })} aria-label="Qté" className="text-right" />
              <select
                value={l.unite ?? ""}
                onChange={(e) => update(i, { unite: e.target.value })}
                aria-label="Unité de la quantité"
                className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
              >
                <option value="">—</option>
                <option value="T">T</option>
                <option value="KG">KG</option>
              </select>
              <AmountInput value={l.prixUnitaire} onValueChange={(n) => update(i, { prixUnitaire: n })} aria-label="Prix unit." className="text-right" />
              <AmountInput value={l.montantDevise} onValueChange={(n) => update(i, { montantDevise: n })} aria-label="Mt devise" className="text-right" />
              <AmountInput value={l.montantTnd ?? 0} onValueChange={(n) => update(i, { montantTnd: n })} aria-label="Mt TND" className="text-right" />
              <button
                type="button"
                onClick={() => remove(i)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                title="Supprimer cette ligne"
                aria-label="Supprimer cette ligne"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" className="border-dashed" onClick={() => onChange([...lignes, ligneVide()])}>
          <Plus className="h-3.5 w-3.5" />
          Ajouter un produit
        </Button>
        {lignes.length > 0 && (
          <p className="flex flex-wrap gap-x-5 text-sm text-muted-foreground">
            <span>Total devise <b className="tabular-nums text-foreground">{fmtMontant(total.montantDevise)} {devise}</b></span>
            <span>Total TND <b className="tabular-nums text-foreground">{fmtMontant(total.montantTnd)}</b></span>
          </p>
        )}
      </div>
    </div>
  );
}

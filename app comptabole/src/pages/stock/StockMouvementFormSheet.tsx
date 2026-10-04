import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Eye,
  EyeOff,
  File as FileIcon,
  FileUp,
  Layers,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { cn } from "@/lib/utils";
import { useStock, type StockMouvementInput } from "@/store/stock";
import { useSocieteById } from "@/store/data";
import type { StockChamps, StockDocType, StockExtractPage, StockLigne, StockMouvement } from "@/types";
import { DocPreviewDialog } from "./DocPreviewDialog";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  societeId: string;
  mouvement?: StockMouvement | null;
  onSubmit: (data: StockMouvementInput) => void;
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

const ligneVide = (): StockLigne => ({
  designation: "",
  quantite: 0,
  prixUnitaire: 0,
  montantDevise: 0,
  montantTnd: 0,
});

const DOC_FIELD: Record<StockDocType, "achatDocDataUrl" | "venteDocDataUrl" | "douaneDocDataUrl"> = {
  achat: "achatDocDataUrl",
  vente: "venteDocDataUrl",
  douane: "douaneDocDataUrl",
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
  const extractPages = useStock((s) => s.extractPages);
  const [v, setV] = useState<StockMouvementInput>(empty(societeId));
  const [importing, setImporting] = useState<StockDocType | null>(null);
  const [previewOpen, setPreviewOpen] = useState<Record<StockDocType, boolean>>({
    achat: false,
    vente: false,
    douane: false,
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

  useEffect(() => {
    if (!open) return;
    setV(mouvement ? { ...mouvement } : empty(societeId));
    setPreviewOpen({ achat: false, vente: false, douane: false });
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
      set(DOC_FIELD[type], dataUrl);
      setPreviewOpen((p) => ({ ...p, [type]: true }));
      const { champs, source } = await extract(type, dataUrl, societeId);
      applyChamps(type, champs);
      toast.success(
        source === "ruspina"
          ? "Champs extraits par le moteur RUSPINA — comparez avec le document ci-dessous avant d'enregistrer"
          : source === "ocr"
            ? "Champs extraits par OCR — comparez avec le document ci-dessous avant d'enregistrer"
            : "Champs extraits du PDF — comparez avec le document ci-dessous avant d'enregistrer",
      );
    } catch {
      /* le store affiche déjà l'erreur */
    } finally {
      setImporting(null);
    }
  }

  function applyChamps(type: StockDocType, champs: StockChamps) {
    if (type === "achat") {
      setV((prev) => ({
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
      }));
    } else if (type === "vente") {
      setV((prev) => ({
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
      }));
    } else {
      setV((prev) => ({
        ...prev,
        douaneNumDeclaration: champs.numDeclaration || prev.douaneNumDeclaration,
        douaneDate: champs.date || prev.douaneDate,
        douaneRegime: champs.regime || prev.douaneRegime,
        douaneReference: champs.reference || prev.douaneReference,
        douaneTauxChange: champs.tauxChange || prev.douaneTauxChange,
        douaneValeurTnd: champs.valeurTnd || prev.douaneValeurTnd,
        douanePtfn: champs.ptfn || prev.douanePtfn,
        douaneExportateur: champs.exportateur || prev.douaneExportateur,
        douaneImportateur: champs.importateur || prev.douaneImportateur,
      }));
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
        if (page.imageDataUrl) set(DOC_FIELD[assignment], page.imageDataUrl);
        setPreviewOpen((p) => ({ ...p, [assignment]: true }));
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
        {v[DOC_FIELD[type]] && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPreviewOpen((p) => ({ ...p, [type]: !p[type] }))}
          >
            {previewOpen[type] ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
            {previewOpen[type] ? "Masquer" : "Voir"} le document
          </Button>
        )}
      </>
    );
  }

  function DocPreview({ type }: { type: StockDocType }) {
    const dataUrl = v[DOC_FIELD[type]];
    if (!dataUrl || !previewOpen[type]) return null;
    const isImage = dataUrl.startsWith("data:image/");
    return (
      // sticky en colonne large : le document reste visible pendant qu'on
      // défile/corrige les champs à côté, pour comparer sans va-et-vient.
      <div className="space-y-1.5 rounded-md border border-accent/30 bg-accent/5 p-2 lg:sticky lg:top-0 lg:self-start">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-medium text-foreground">
            Document importé — comparez les chiffres à gauche
          </p>
          <button
            type="button"
            onClick={() => set(DOC_FIELD[type], null)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
          >
            <X className="h-3 w-3" />
            Retirer
          </button>
        </div>
        {isImage ? (
          <img
            src={dataUrl}
            alt="Document importé"
            className="mx-auto max-h-[80vh] w-full rounded border border-border object-contain"
          />
        ) : (
          <iframe
            title="Document importé"
            src={dataUrl}
            className="h-[80vh] w-full rounded border border-border bg-white"
          />
        )}
      </div>
    );
  }

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-2xl lg:max-w-4xl xl:max-w-5xl">
        <SheetHeader>
          <SheetTitle>
            {isEdit ? "Modifier le mouvement" : "Nouveau mouvement de stock"}
          </SheetTitle>
          <SheetDescription>
            Importez un PDF par section, ou un seul document combinant
            plusieurs pièces (voir ci-dessous), pour pré-remplir les champs
            (OCR local) — le document reste affiché pour vérifier les
            chiffres avant d'enregistrer.
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="space-y-6">
          {/* ── Import "document complet" ──────── */}
          <div className="space-y-3 rounded-lg border border-dashed border-accent/40 bg-accent/[0.04] p-4">
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
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Document complet (plusieurs pages)
                </p>
                <p className="text-xs text-muted-foreground">
                  Un seul fichier regroupant plusieurs pièces (ex. facture
                  d'achat + facture de vente + déclaration douanière
                  scannées ensemble) — chaque page est analysée et son type
                  deviné, à confirmer ci-dessous avant application.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={batchImporting}
                onClick={() => batchInputRef.current?.click()}
                className="shrink-0"
              >
                {batchImporting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Layers className="h-3.5 w-3.5" />
                )}
                Importer le document complet
              </Button>
            </div>

            {batchPages && (
              <div className="space-y-3 rounded-md border border-border bg-card p-3">
                <p className="text-xs font-medium text-foreground">
                  {batchPages.length} page{batchPages.length > 1 ? "s" : ""}{" "}
                  détectée{batchPages.length > 1 ? "s" : ""} — cliquez sur une
                  page pour la lire en grand, vérifiez son type avant
                  d'appliquer.
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Le type Achat/Vente est deviné en recherchant le nom «{" "}
                  {societe?.raisonSociale || "…"} » dans la page (acheteur ou
                  vendeur selon sa position). S'il n'apparaît pas — document
                  sans lien avec cette société, ou lecture OCR imparfaite —
                  choisissez le type vous-même ci-dessous.
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {batchPages.map((page) => {
                    const undetected = !page.guessedType;
                    return (
                      <div
                        key={page.index}
                        className={cn(
                          "space-y-1.5 rounded-md border p-2",
                          undetected ? "border-warning/40 bg-warning/[0.06]" : "border-border",
                        )}
                      >
                        {page.imageDataUrl ? (
                          <button
                            type="button"
                            onClick={() => setBatchPreview(page)}
                            className="block w-full"
                            title="Voir la page en grand"
                          >
                            <img
                              src={page.imageDataUrl}
                              alt={`Page ${page.index + 1}`}
                              className="h-28 w-full cursor-zoom-in rounded border border-border object-cover transition-opacity hover:opacity-80"
                            />
                          </button>
                        ) : (
                          <div className="flex h-28 w-full items-center justify-center rounded border border-border bg-secondary/40">
                            <FileIcon className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <p className="text-[11px] font-medium text-muted-foreground">
                          Page {page.index + 1}
                          {page.guessedType ? (
                            <>
                              {" "}
                              · deviné : {DOC_TYPE_LABELS[page.guessedType]}
                              {page.confidence === "faible" && " (incertain)"}
                            </>
                          ) : (
                            <span className="text-warning"> · type non détecté</span>
                          )}
                        </p>
                        <Select
                          value={batchAssignments[page.index] ?? "ignorer"}
                          onValueChange={(val) =>
                            setBatchAssignments((prev) => ({
                              ...prev,
                              [page.index]: val as BatchAssignment,
                            }))
                          }
                        >
                          <SelectTrigger
                            className={cn(
                              "h-8 text-xs",
                              undetected &&
                                batchAssignments[page.index] === "ignorer" &&
                                "border-warning/60",
                            )}
                          >
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
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setBatchPages(null);
                      setBatchAssignments({});
                    }}
                  >
                    Annuler
                  </Button>
                  <Button
                    type="button"
                    variant="ledger"
                    size="sm"
                    disabled={batchApplying}
                    onClick={applyBatch}
                  >
                    {batchApplying && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Appliquer aux sections
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Nature de la marchandise</Label>
            <Input
              value={v.natureMarchandise}
              onChange={(e) => set("natureMarchandise", e.target.value)}
              placeholder="HOT WASHED PET FLAKES"
            />
          </div>

          {/* ── Achat ─────────────────────────── */}
          <section className="space-y-3 rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Achat</h3>
              <ImportButton type="achat" />
            </div>
            <div
              className={cn(
                "grid gap-4",
                v.achatDocDataUrl && previewOpen.achat && "lg:grid-cols-[2fr_3fr]",
              )}
            >
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Date">
                    <Input
                      type="date"
                      value={v.achatDate ?? ""}
                      onChange={(e) => set("achatDate", e.target.value || null)}
                    />
                  </Field>
                  <Field label="N° Facture">
                    <Input
                      value={v.achatNumFacture}
                      onChange={(e) => set("achatNumFacture", e.target.value)}
                    />
                  </Field>
                  <Field label="Fournisseur">
                    <Input
                      value={v.fournisseur}
                      onChange={(e) => set("fournisseur", e.target.value)}
                    />
                  </Field>
                  <Field label="Devise">
                    <Input
                      value={v.achatDevise}
                      onChange={(e) => set("achatDevise", e.target.value)}
                    />
                  </Field>
                  <Field label="Cours (taux de change)">
                    <AmountInput
                      value={v.achatCours}
                      decimals={4}
                      onValueChange={(n) =>
                        setV((prev) => ({ ...prev, achatCours: n, achatLignes: avecMontantsTnd(prev.achatLignes, n) }))
                      }
                    />
                  </Field>
                </div>
                <LignesEditor
                  lignes={v.achatLignes}
                  cours={v.achatCours}
                  onChange={(lignes) => set("achatLignes", lignes)}
                />
              </div>
              <DocPreview type="achat" />
            </div>
          </section>

          {/* ── Vente ─────────────────────────── */}
          <section className="space-y-3 rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Vente</h3>
              <ImportButton type="vente" />
            </div>
            <div
              className={cn(
                "grid gap-4",
                v.venteDocDataUrl && previewOpen.vente && "lg:grid-cols-[2fr_3fr]",
              )}
            >
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Date">
                    <Input
                      type="date"
                      value={v.venteDate ?? ""}
                      onChange={(e) => set("venteDate", e.target.value || null)}
                    />
                  </Field>
                  <Field label="N° Facture">
                    <Input
                      value={v.venteNumFacture}
                      onChange={(e) => set("venteNumFacture", e.target.value)}
                    />
                  </Field>
                  <Field label="Client">
                    <Input value={v.client} onChange={(e) => set("client", e.target.value)} />
                  </Field>
                  <Field label="Devise">
                    <Input
                      value={v.venteDevise}
                      onChange={(e) => set("venteDevise", e.target.value)}
                    />
                  </Field>
                  <Field label="Cours (taux de change)">
                    <AmountInput
                      value={v.venteCours}
                      decimals={4}
                      onValueChange={(n) =>
                        setV((prev) => ({ ...prev, venteCours: n, venteLignes: avecMontantsTnd(prev.venteLignes, n) }))
                      }
                    />
                  </Field>
                </div>
                <LignesEditor
                  lignes={v.venteLignes}
                  cours={v.venteCours}
                  onChange={(lignes) => set("venteLignes", lignes)}
                />
              </div>
              <DocPreview type="vente" />
            </div>
          </section>

          {/* ── Douane ────────────────────────── */}
          <section className="space-y-3 rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Douane</h3>
              <ImportButton type="douane" />
            </div>
            <div
              className={cn(
                "grid gap-4",
                v.douaneDocDataUrl && previewOpen.douane && "lg:grid-cols-[2fr_3fr]",
              )}
            >
              <div className="grid grid-cols-2 gap-3">
                <Field label="N° Déclaration">
                  <Input
                    value={v.douaneNumDeclaration}
                    onChange={(e) => set("douaneNumDeclaration", e.target.value)}
                  />
                </Field>
                <Field label="Date">
                  <Input
                    type="date"
                    value={v.douaneDate ?? ""}
                    onChange={(e) => set("douaneDate", e.target.value || null)}
                  />
                </Field>
                <Field label="Régime">
                  <Input
                    value={v.douaneRegime}
                    onChange={(e) => set("douaneRegime", e.target.value)}
                    placeholder="RS, IM4, EX1…"
                  />
                </Field>
                <Field label="Taux de change (TND)">
                  <AmountInput
                    value={v.douaneTauxChange}
                    onValueChange={(n) => set("douaneTauxChange", n)}
                    decimals={4}
                  />
                </Field>
                <Field label="Valeur en douane (TND)">
                  <AmountInput
                    value={v.douaneValeurTnd}
                    onValueChange={(n) => set("douaneValeurTnd", n)}
                  />
                </Field>
                <Field label="PTFN">
                  <AmountInput
                    value={v.douanePtfn}
                    onValueChange={(n) => set("douanePtfn", n)}
                  />
                </Field>
                <div className="col-span-2">
                  <Field label="Exportateur">
                    <Input
                      value={v.douaneExportateur}
                      onChange={(e) => set("douaneExportateur", e.target.value)}
                    />
                  </Field>
                </div>
                <div className="col-span-2">
                  <Field label="Importateur">
                    <Input
                      value={v.douaneImportateur}
                      onChange={(e) => set("douaneImportateur", e.target.value)}
                    />
                  </Field>
                </div>
              </div>
              <DocPreview type="douane" />
            </div>
          </section>

          <div className="space-y-1.5">
            <Label>Note</Label>
            <Textarea
              rows={2}
              value={v.note}
              onChange={(e) => set("note", e.target.value)}
            />
          </div>
        </SheetBody>

        <SheetFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            type="button"
            variant="ledger"
            onClick={() => {
              onSubmit(v);
              onOpenChange(false);
            }}
          >
            {isEdit ? "Enregistrer" : "Créer le mouvement"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>

    <DocPreviewDialog
      open={Boolean(batchPreview)}
      onOpenChange={(o) => !o && setBatchPreview(null)}
      title={batchPreview ? `Page ${batchPreview.index + 1} — à vérifier avant d'appliquer` : ""}
      dataUrl={batchPreview?.imageDataUrl ?? null}
    />
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

/** Une facture peut lister plusieurs marchandises à des quantités
 * différentes, pas une seule — une ligne par produit, ajoutée/supprimée
 * librement (voir aussi ligneVide() et le schéma serveur stock_lignes). */
function LignesEditor({
  lignes,
  cours,
  onChange,
}: {
  lignes: StockLigne[];
  /** Cours (taux de change) de la section : le montant en dinars en découle. */
  cours: number;
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

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Produits</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...lignes, ligneVide()])}
        >
          <Plus className="h-3.5 w-3.5" />
          Ajouter une ligne
        </Button>
      </div>
      {lignes.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
          Aucune ligne de produit.
        </p>
      ) : (
        <div className="space-y-2">
          {lignes.map((l, i) => (
            <div key={i} className="space-y-1.5 rounded-md border border-border p-2">
              <div className="flex items-center gap-2">
                <Input
                  value={l.designation}
                  onChange={(e) => update(i, { designation: e.target.value })}
                  placeholder="Désignation"
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  title="Supprimer cette ligne"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <Field label="Qté">
                  <AmountInput
                      value={l.quantite}
                      onValueChange={(n) => update(i, { quantite: n })}
                    />
                </Field>
                <Field label="Prix unit.">
                  <AmountInput
                      value={l.prixUnitaire}
                      onValueChange={(n) => update(i, { prixUnitaire: n })}
                    />
                </Field>
                <Field label="Mt devise">
                  <AmountInput
                      value={l.montantDevise}
                      onValueChange={(n) => update(i, { montantDevise: n })}
                    />
                </Field>
                <Field label="Mt TND">
                  <AmountInput
                      value={l.montantTnd ?? 0}
                      onValueChange={(n) => update(i, { montantTnd: n })}
                    />
                </Field>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

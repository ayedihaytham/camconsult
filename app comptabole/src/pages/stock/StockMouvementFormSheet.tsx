import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, FileUp, Loader2, X } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { readFileAsDataUrl } from "@/lib/file";
import { useStock, type StockMouvementInput } from "@/store/stock";
import type { StockDocType, StockMouvement } from "@/types";

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
  achatQuantite: 0,
  achatPu: 0,
  achatMontantDevise: 0,
  achatDevise: "EUR",
  achatCours: 0,
  achatMontantTnd: 0,
  venteDate: null,
  venteNumFacture: "",
  venteDocType: "",
  client: "",
  venteQuantite: 0,
  ventePu: 0,
  venteMontantDevise: 0,
  venteDevise: "EUR",
  venteCours: 0,
  venteMontantTnd: 0,
  douaneNumDeclaration: "",
  douaneDate: null,
  douaneRegime: "",
  douaneReference: "",
  achatDocDataUrl: null,
  venteDocDataUrl: null,
  douaneDocDataUrl: null,
  note: "",
});

const DOC_FIELD: Record<StockDocType, "achatDocDataUrl" | "venteDocDataUrl" | "douaneDocDataUrl"> = {
  achat: "achatDocDataUrl",
  vente: "venteDocDataUrl",
  douane: "douaneDocDataUrl",
};

export function StockMouvementFormSheet({
  open,
  onOpenChange,
  societeId,
  mouvement,
  onSubmit,
}: Props) {
  const isEdit = Boolean(mouvement);
  const extract = useStock((s) => s.extract);
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

  useEffect(() => {
    if (!open) return;
    setV(mouvement ? { ...mouvement } : empty(societeId));
    setPreviewOpen({ achat: false, vente: false, douane: false });
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
      const { champs, source } = await extract(type, dataUrl);
      applyChamps(type, champs);
      toast.success(
        source === "ocr"
          ? "Champs extraits par OCR — comparez avec le document ci-dessous avant d'enregistrer"
          : "Champs extraits du PDF — comparez avec le document ci-dessous avant d'enregistrer",
      );
    } catch {
      /* le store affiche déjà l'erreur */
    } finally {
      setImporting(null);
    }
  }

  function applyChamps(type: StockDocType, champs: Record<string, string | number>) {
    const s = (k: string) => (champs[k] != null ? String(champs[k]) : "");
    const n = (k: string) => (champs[k] !== "" && champs[k] != null ? Number(champs[k]) : 0);
    if (type === "achat") {
      setV((prev) => ({
        ...prev,
        achatDate: s("date") || prev.achatDate,
        achatNumFacture: s("numFacture") || prev.achatNumFacture,
        fournisseur: s("fournisseur") || prev.fournisseur,
        natureMarchandise: s("natureMarchandise") || prev.natureMarchandise,
        achatQuantite: n("quantite") || prev.achatQuantite,
        achatPu: n("prixUnitaire") || prev.achatPu,
        achatMontantDevise: n("montantDevise") || prev.achatMontantDevise,
        achatDevise: s("devise") || prev.achatDevise,
      }));
    } else if (type === "vente") {
      setV((prev) => ({
        ...prev,
        venteDate: s("date") || prev.venteDate,
        venteNumFacture: s("numFacture") || prev.venteNumFacture,
        client: s("client") || prev.client,
        natureMarchandise: s("natureMarchandise") || prev.natureMarchandise,
        venteQuantite: n("quantite") || prev.venteQuantite,
        ventePu: n("prixUnitaire") || prev.ventePu,
        venteMontantDevise: n("montantDevise") || prev.venteMontantDevise,
        venteDevise: s("devise") || prev.venteDevise,
      }));
    } else {
      setV((prev) => ({
        ...prev,
        douaneNumDeclaration: s("numDeclaration") || prev.douaneNumDeclaration,
        douaneDate: s("date") || prev.douaneDate,
        douaneRegime: s("regime") || prev.douaneRegime,
        douaneReference: s("reference") || prev.douaneReference,
      }));
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
      <div className="space-y-1.5 rounded-md border border-accent/30 bg-accent/5 p-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-medium text-foreground">
            Document importé — comparez les chiffres ci-dessus
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
            className="mx-auto max-h-96 rounded border border-border object-contain"
          />
        ) : (
          <iframe
            title="Document importé"
            src={dataUrl}
            className="h-96 w-full rounded border border-border bg-white"
          />
        )}
      </div>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>
            {isEdit ? "Modifier le mouvement" : "Nouveau mouvement de stock"}
          </SheetTitle>
          <SheetDescription>
            Importez un PDF par section pour pré-remplir les champs (OCR local) —
            le document reste affiché pour vérifier les chiffres avant
            d'enregistrer.
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="space-y-6">
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
              <Field label="Type pièce">
                <Input
                  value={v.achatDocType}
                  onChange={(e) => set("achatDocType", e.target.value)}
                  placeholder="Facture, avoir…"
                />
              </Field>
              <Field label="Quantité">
                <Input
                  type="number"
                  value={v.achatQuantite}
                  onChange={(e) => set("achatQuantite", Number(e.target.value) || 0)}
                />
              </Field>
              <Field label="Prix unitaire">
                <Input
                  type="number"
                  value={v.achatPu}
                  onChange={(e) => set("achatPu", Number(e.target.value) || 0)}
                />
              </Field>
              <Field label="Montant devise">
                <Input
                  type="number"
                  value={v.achatMontantDevise}
                  onChange={(e) =>
                    set("achatMontantDevise", Number(e.target.value) || 0)
                  }
                />
              </Field>
              <Field label="Devise">
                <Input
                  value={v.achatDevise}
                  onChange={(e) => set("achatDevise", e.target.value)}
                />
              </Field>
              <Field label="Cours (taux de change)">
                <Input
                  type="number"
                  value={v.achatCours}
                  onChange={(e) => set("achatCours", Number(e.target.value) || 0)}
                />
              </Field>
              <Field label="Montant TND">
                <Input
                  type="number"
                  value={v.achatMontantTnd}
                  onChange={(e) =>
                    set("achatMontantTnd", Number(e.target.value) || 0)
                  }
                />
              </Field>
            </div>
            <DocPreview type="achat" />
          </section>

          {/* ── Vente ─────────────────────────── */}
          <section className="space-y-3 rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Vente</h3>
              <ImportButton type="vente" />
            </div>
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
              <Field label="Type pièce">
                <Input
                  value={v.venteDocType}
                  onChange={(e) => set("venteDocType", e.target.value)}
                  placeholder="Facture, avoir (CN)…"
                />
              </Field>
              <Field label="Quantité">
                <Input
                  type="number"
                  value={v.venteQuantite}
                  onChange={(e) => set("venteQuantite", Number(e.target.value) || 0)}
                />
              </Field>
              <Field label="Prix unitaire">
                <Input
                  type="number"
                  value={v.ventePu}
                  onChange={(e) => set("ventePu", Number(e.target.value) || 0)}
                />
              </Field>
              <Field label="Montant devise">
                <Input
                  type="number"
                  value={v.venteMontantDevise}
                  onChange={(e) =>
                    set("venteMontantDevise", Number(e.target.value) || 0)
                  }
                />
              </Field>
              <Field label="Devise">
                <Input
                  value={v.venteDevise}
                  onChange={(e) => set("venteDevise", e.target.value)}
                />
              </Field>
              <Field label="Cours (taux de change)">
                <Input
                  type="number"
                  value={v.venteCours}
                  onChange={(e) => set("venteCours", Number(e.target.value) || 0)}
                />
              </Field>
              <Field label="Montant TND">
                <Input
                  type="number"
                  value={v.venteMontantTnd}
                  onChange={(e) =>
                    set("venteMontantTnd", Number(e.target.value) || 0)
                  }
                />
              </Field>
            </div>
            <DocPreview type="vente" />
          </section>

          {/* ── Douane ────────────────────────── */}
          <section className="space-y-3 rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Douane</h3>
              <ImportButton type="douane" />
            </div>
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
              <Field label="Référence">
                <Input
                  value={v.douaneReference}
                  onChange={(e) => set("douaneReference", e.target.value)}
                />
              </Field>
            </div>
            <DocPreview type="douane" />
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

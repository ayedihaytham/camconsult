import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, Paperclip, Trash2, Upload } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AmountInput } from "@/components/common/AmountInput";
import { round3 } from "@/lib/amount";
import { downloadDataUrl, fileExtension, formatFileSize, readFileAsDataUrl } from "@/lib/file";
import { suggestLibelle } from "@/lib/honoraires/labels";
import { useHonoraires, type HonoraireLigneInput } from "@/store/honoraires";
import { HONORAIRE_TYPE_LABELS, type HonoraireLigne, type HonoraireType } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  societeId: string;
  ligne?: HonoraireLigne | null;
  onSubmit: (data: HonoraireLigneInput) => void;
}

/** Limite de la pièce jointe (base64 ≈ ×1,37 côté serveur, plafonné à ~8 Mo de fichier). */
const MAX_PIECE_BYTES = 8 * 1024 * 1024;

const empty = (societeId: string): HonoraireLigneInput => ({
  societeId,
  type: "mensuelle",
  nature: "",
  periode: "",
  libelle: "",
  cnss: "",
  numQuittance: "",
  montantDeclaration: 0,
  honoraire: 0,
  reglement: 0,
  note: "",
});

export function HonoraireLigneFormSheet({
  open,
  onOpenChange,
  societeId,
  ligne,
  onSubmit,
}: Props) {
  const isEdit = Boolean(ligne);
  const fetchPiece = useHonoraires((st) => st.fetchPiece);
  const [v, setV] = useState<HonoraireLigneInput>(empty(societeId));
  // Le libellé se re-suggère tant que l'utilisateur ne l'a pas retouché à
  // la main — dès qu'il tape dedans, on arrête de l'écraser automatiquement.
  const [libelleTouched, setLibelleTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setV(ligne ?? empty(societeId));
    setLibelleTouched(Boolean(ligne?.libelle));
  }, [open, ligne, societeId]);

  // Pièce jointe actuelle : nouveau fichier choisi > retrait demandé (null) >
  // pièce déjà enregistrée sur la ligne (contenu chargé à la demande).
  const pieceNom =
    v.pieceDataUrl === null
      ? ""
      : v.pieceDataUrl
        ? (v.pieceNom ?? "")
        : ligne?.aPiece
          ? ligne.pieceNom || "Pièce jointe"
          : "";
  const pieceTaille = v.pieceDataUrl ? (v.pieceTaille ?? "") : ligne?.aPiece && v.pieceDataUrl !== null ? ligne.pieceTaille : "";

  async function pickPiece(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_PIECE_BYTES) {
      toast.error("Fichier trop volumineux (8 Mo maximum).");
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setV((s) => ({
        ...s,
        pieceDataUrl: dataUrl,
        pieceNom: file.name,
        pieceFormat: fileExtension(file.name),
        pieceTaille: formatFileSize(file.size),
      }));
    } catch {
      toast.error("Fichier illisible.");
    }
  }

  async function openPiece() {
    if (v.pieceDataUrl) {
      downloadDataUrl(v.pieceDataUrl, v.pieceNom || "piece");
      return;
    }
    if (!ligne) return;
    const { nom, dataUrl } = await fetchPiece(ligne.id);
    downloadDataUrl(dataUrl, nom || "piece");
  }

  function set<K extends keyof HonoraireLigneInput>(
    key: K,
    value: HonoraireLigneInput[K],
  ) {
    setV((s) => {
      const next = { ...s, [key]: value };
      if (!libelleTouched && (key === "type" || key === "nature" || key === "periode")) {
        next.libelle = suggestLibelle(next.type, next.nature, next.periode);
      }
      return next;
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Modifier la ligne" : "Nouvelle ligne"}</SheetTitle>
          <SheetDescription>
            Une déclaration traitée pour cette société — le libellé se
            suggère automatiquement, mais reste modifiable.
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={v.type}
                onValueChange={(val) => set("type", val as HonoraireType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(HONORAIRE_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Période</Label>
              <Input
                value={v.periode}
                onChange={(e) => set("periode", e.target.value)}
                placeholder="Ex. Avril 2026, T1 2026, 2025…"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Nature (optionnel)</Label>
            <Input
              value={v.nature}
              onChange={(e) => set("nature", e.target.value)}
              placeholder="Ex. CNSS, IS, TVA…"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Libellé affiché</Label>
            <Input
              value={v.libelle}
              onChange={(e) => {
                setLibelleTouched(true);
                set("libelle", e.target.value);
              }}
              placeholder="Ex. AP 01-2025"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Réf. CNSS</Label>
              <Input value={v.cnss} onChange={(e) => set("cnss", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>N° Quittance</Label>
              <Input
                value={v.numQuittance}
                onChange={(e) => set("numQuittance", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Montant déclaration</Label>
              <AmountInput
                value={v.montantDeclaration}
                onValueChange={(n) => set("montantDeclaration", n)}
                className="text-right tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Honoraire</Label>
              <AmountInput
                value={v.honoraire}
                onValueChange={(n) => set("honoraire", n)}
                className="text-right tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Règlement reçu</Label>
              <AmountInput
                value={v.reglement}
                onValueChange={(n) => set("reglement", n)}
                className="text-right tabular-nums"
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Total de la ligne (déclaration + honoraire)</span>
            <span className="font-semibold tabular-nums">
              {round3(v.montantDeclaration + v.honoraire).toLocaleString("fr-FR", {
                minimumFractionDigits: 3,
                maximumFractionDigits: 3,
              })}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Reste sur cette ligne (total − règlement)</span>
            <span className="font-semibold tabular-nums">
              {round3(v.montantDeclaration + v.honoraire - v.reglement).toLocaleString("fr-FR", {
                minimumFractionDigits: 3,
                maximumFractionDigits: 3,
              })}
            </span>
          </div>

          <div className="space-y-1.5">
            <Label>Note</Label>
            <Textarea
              rows={2}
              value={v.note}
              onChange={(e) => set("note", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Pièce jointe (facultatif)</Label>
            {pieceNom ? (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{pieceNom}</p>
                  {pieceTaille && <p className="text-xs text-muted-foreground">{pieceTaille}</p>}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={openPiece}>
                  <Download className="h-3.5 w-3.5" />
                  Ouvrir
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label="Retirer la pièce jointe"
                  onClick={() => setV((s) => ({ ...s, pieceDataUrl: null, pieceNom: "", pieceFormat: "", pieceTaille: "" }))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-input px-3 py-3 text-sm text-muted-foreground transition-colors hover:border-accent/50 hover:bg-secondary/40">
                <Upload className="h-4 w-4" />
                Choisir un fichier depuis l'ordinateur (PDF, image, Excel… 8 Mo max)
                <input type="file" className="hidden" onChange={pickPiece} />
              </label>
            )}
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
            {isEdit ? "Enregistrer" : "Ajouter la ligne"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

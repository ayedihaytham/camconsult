import { useEffect, useState } from "react";
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
import { suggestLibelle } from "@/lib/honoraires/labels";
import type { HonoraireLigneInput } from "@/store/honoraires";
import { HONORAIRE_TYPE_LABELS, type HonoraireLigne, type HonoraireType } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  societeId: string;
  ligne?: HonoraireLigne | null;
  onSubmit: (data: HonoraireLigneInput) => void;
}

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
  const [v, setV] = useState<HonoraireLigneInput>(empty(societeId));
  // Le libellé se re-suggère tant que l'utilisateur ne l'a pas retouché à
  // la main — dès qu'il tape dedans, on arrête de l'écraser automatiquement.
  const [libelleTouched, setLibelleTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setV(ligne ?? empty(societeId));
    setLibelleTouched(Boolean(ligne?.libelle));
  }, [open, ligne, societeId]);

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
              <Input
                type="number"
                value={v.montantDeclaration}
                onChange={(e) => set("montantDeclaration", Number(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Honoraire</Label>
              <Input
                type="number"
                value={v.honoraire}
                onChange={(e) => set("honoraire", Number(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Règlement reçu</Label>
              <Input
                type="number"
                value={v.reglement}
                onChange={(e) => set("reglement", Number(e.target.value) || 0)}
              />
            </div>
          </div>

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
            {isEdit ? "Enregistrer" : "Ajouter la ligne"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

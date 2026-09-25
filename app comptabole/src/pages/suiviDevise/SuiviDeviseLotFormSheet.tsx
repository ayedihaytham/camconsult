import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LotInput } from "@/store/suiviDevise";
import type { SuiviDeviseLot, SuiviDeviseLotType } from "@/types";

const LOT_TYPE_LABELS: Record<SuiviDeviseLotType, string> = {
  aucun: "Aucun (EX WORK)",
  charges_trans_av: "Charges trans+av",
  avoir: "Avoir",
};

const schema = z.object({
  libelle: z.string(),
  quantiteTonnes: z.coerce.number(),
  prixRendu: z.coerce.number(),
  rabais: z.coerce.number(),
  incoterm: z.string(),
  type: z.enum(["aucun", "charges_trans_av", "avoir"]),
  valeurReference: z.coerce.number(),
});

type FormValues = z.infer<typeof schema>;

const empty: FormValues = {
  libelle: "",
  quantiteTonnes: 0,
  prixRendu: 0,
  rabais: 0,
  incoterm: "",
  type: "aucun",
  valeurReference: 0,
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lot?: SuiviDeviseLot | null;
  onSubmit: (values: LotInput) => void;
}

export function SuiviDeviseLotFormSheet({ open, onOpenChange, lot, onSubmit }: Props) {
  const isEdit = Boolean(lot);
  const { register, handleSubmit, reset, watch, setValue } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: empty,
  });
  const type = watch("type");

  useEffect(() => {
    if (!open) return;
    reset(
      lot
        ? {
            libelle: lot.libelle,
            quantiteTonnes: lot.quantiteTonnes,
            prixRendu: lot.prixRendu,
            rabais: lot.rabais,
            incoterm: lot.incoterm,
            type: lot.type,
            valeurReference: lot.valeurReference,
          }
        : empty,
    );
  }, [open, lot, reset]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Modifier le lot" : "Nouveau lot LC"}</SheetTitle>
          <SheetDescription>Lettre de crédit : quantité, prix rendu, rabais, incoterm.</SheetDescription>
        </SheetHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={handleSubmit((v) => {
            onSubmit({
              libelle: v.libelle.trim(),
              quantiteTonnes: v.quantiteTonnes,
              prixRendu: v.prixRendu,
              rabais: v.rabais,
              incoterm: v.incoterm.trim(),
              type: v.type,
              valeurReference: v.valeurReference,
            });
            onOpenChange(false);
          })}
        >
          <SheetBody className="space-y-5">
            <div className="space-y-1.5">
              <Label>Libellé</Label>
              <Input {...register("libelle")} placeholder="LC 4000T" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Quantité (T)</Label>
                <Input type="number" step="any" {...register("quantiteTonnes")} className="text-right tabular-nums" />
              </div>
              <div className="space-y-1.5">
                <Label>Incoterm</Label>
                <Input {...register("incoterm")} placeholder="EX WORK, CIF, FOB…" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Prix rendu</Label>
                <Input type="number" step="any" {...register("prixRendu")} className="text-right tabular-nums" />
              </div>
              <div className="space-y-1.5">
                <Label>Rabais</Label>
                <Input type="number" step="any" {...register("rabais")} className="text-right tabular-nums" />
              </div>
            </div>

            <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 p-3">
              <Label>Régime (calcul automatique du solde)</Label>
              <Select
                value={type}
                onValueChange={(v) => setValue("type", v as SuiviDeviseLotType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(LOT_TYPE_LABELS) as SuiviDeviseLotType[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {LOT_TYPE_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {type !== "aucun" && (
                <div className="space-y-1.5 pt-2">
                  <Label>
                    {type === "charges_trans_av"
                      ? "Prix de référence par tonne"
                      : "Total forfaitaire de référence du lot"}
                  </Label>
                  <Input
                    type="number"
                    step="any"
                    {...register("valeurReference")}
                    className="text-right tabular-nums"
                  />
                  <p className="text-xs text-muted-foreground">
                    {type === "charges_trans_av"
                      ? "Écart par facture = quantité × (prix facturé − ce prix de référence)."
                      : "Écart par facture = montant facturé − ce total de référence."}
                  </p>
                </div>
              )}
            </div>
          </SheetBody>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" variant="ledger">
              {isEdit ? "Enregistrer" : "Ajouter le lot"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

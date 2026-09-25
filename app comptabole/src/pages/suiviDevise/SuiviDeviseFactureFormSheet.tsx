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
import type { FactureInput } from "@/store/suiviDevise";
import type { SuiviDeviseFacture, SuiviDeviseLot } from "@/types";

const NONE = "__aucun__";

const schema = z.object({
  lotId: z.string(),
  nFacture: z.string(),
  nSecondaire: z.string(),
  dateFacture: z.string(),
  modePaiement: z.string(),
  designationProduit: z.string(),
  fournisseur: z.string(),
  qteTonnes: z.coerce.number(),
  pu: z.coerce.number(),
  montantTotal: z.coerce.number(),
  avoirMontant: z.string(),
  avoirDate: z.string(),
});

type FormValues = z.infer<typeof schema>;

const empty: FormValues = {
  lotId: NONE,
  nFacture: "",
  nSecondaire: "",
  dateFacture: "",
  modePaiement: "",
  designationProduit: "",
  fournisseur: "",
  qteTonnes: 0,
  pu: 0,
  montantTotal: 0,
  avoirMontant: "",
  avoirDate: "",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facture?: SuiviDeviseFacture | null;
  lots: SuiviDeviseLot[];
  onSubmit: (values: FactureInput) => void;
}

export function SuiviDeviseFactureFormSheet({ open, onOpenChange, facture, lots, onSubmit }: Props) {
  const isEdit = Boolean(facture);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: empty });

  useEffect(() => {
    if (!open) return;
    reset(
      facture
        ? {
            lotId: facture.lotId ?? NONE,
            nFacture: facture.nFacture,
            nSecondaire: facture.nSecondaire,
            dateFacture: facture.dateFacture ?? "",
            modePaiement: facture.modePaiement,
            designationProduit: facture.designationProduit,
            fournisseur: facture.fournisseur,
            qteTonnes: facture.qteTonnes,
            pu: facture.pu,
            montantTotal: facture.montantTotal,
            avoirMontant: facture.avoirMontant == null ? "" : String(facture.avoirMontant),
            avoirDate: facture.avoirDate ?? "",
          }
        : empty,
    );
  }, [open, facture, reset]);

  const lotId = watch("lotId");
  const qte = watch("qteTonnes");
  const pu = watch("pu");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Modifier la facture" : "Nouvelle facture"}</SheetTitle>
          <SheetDescription>Ligne de vente export.</SheetDescription>
        </SheetHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={handleSubmit((v) => {
            onSubmit({
              lotId: v.lotId === NONE ? null : v.lotId,
              nFacture: v.nFacture.trim(),
              nSecondaire: v.nSecondaire.trim(),
              dateFacture: v.dateFacture || null,
              modePaiement: v.modePaiement.trim(),
              designationProduit: v.designationProduit.trim(),
              fournisseur: v.fournisseur.trim(),
              qteTonnes: v.qteTonnes,
              pu: v.pu,
              montantTotal: v.montantTotal,
              avoirMontant: v.avoirMontant === "" ? null : Number(v.avoirMontant),
              avoirDate: v.avoirDate || null,
            });
            onOpenChange(false);
          })}
        >
          <SheetBody className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>N° facture</Label>
                <Input {...register("nFacture")} placeholder="01-2023" />
              </div>
              <div className="space-y-1.5">
                <Label>N° secondaire</Label>
                <Input {...register("nSecondaire")} placeholder="202300315" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Date facture</Label>
                <Input type="date" {...register("dateFacture")} />
              </div>
              <div className="space-y-1.5">
                <Label>Mode de paiement</Label>
                <Input {...register("modePaiement")} placeholder="BANK TRANSFER" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Lot LC</Label>
              <Select value={lotId} onValueChange={(v) => setValue("lotId", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Aucun lot</SelectItem>
                  {lots.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.libelle || "Lot sans nom"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Désignation produit</Label>
                <Input {...register("designationProduit")} placeholder="CEM I 42,5 N" />
              </div>
              <div className="space-y-1.5">
                <Label>Fournisseur</Label>
                <Input {...register("fournisseur")} placeholder="ENFIDHA" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Qté (T)</Label>
                <Input type="number" step="any" {...register("qteTonnes")} className="text-right tabular-nums" />
              </div>
              <div className="space-y-1.5">
                <Label>PU</Label>
                <Input type="number" step="any" {...register("pu")} className="text-right tabular-nums" />
              </div>
              <div className="space-y-1.5">
                <Label>Montant total</Label>
                <Input
                  type="number"
                  step="any"
                  {...register("montantTotal")}
                  className="text-right font-semibold tabular-nums"
                />
              </div>
            </div>
            {qte > 0 && pu > 0 && (
              <button
                type="button"
                className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => setValue("montantTotal", Math.round(qte * pu * 100) / 100)}
              >
                Reprendre Qté × PU ({(qte * pu).toLocaleString("fr-FR", { minimumFractionDigits: 2 })})
              </button>
            )}

            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Avoir (facultatif)
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Montant avoir</Label>
                  <Input type="number" step="any" {...register("avoirMontant")} className="text-right tabular-nums" />
                </div>
                <div className="space-y-1.5">
                  <Label>Date avoir</Label>
                  <Input type="date" {...register("avoirDate")} />
                </div>
              </div>
            </div>
            {errors.qteTonnes?.message && (
              <p className="text-xs text-destructive">{errors.qteTonnes.message}</p>
            )}
          </SheetBody>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" variant="ledger">
              {isEdit ? "Enregistrer" : "Ajouter la facture"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

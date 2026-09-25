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
import type { MouvementInput } from "@/store/suiviDevise";
import type { SuiviDeviseLot, SuiviDeviseMouvement, SuiviDeviseMouvementType } from "@/types";

const NONE = "__aucun__";

const TYPE_LABELS: Record<SuiviDeviseMouvementType, string> = {
  charge_transport: "Charge de transport",
  avoir: "Avoir",
  reglement: "Règlement",
};

const schema = z.object({
  type: z.enum(["charge_transport", "avoir", "reglement"]),
  lotId: z.string(),
  libelle: z.string(),
  date: z.string(),
  montant: z.coerce.number(),
});

type FormValues = z.infer<typeof schema>;

const empty: FormValues = { type: "reglement", lotId: NONE, libelle: "", date: "", montant: 0 };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mouvement?: SuiviDeviseMouvement | null;
  lots: SuiviDeviseLot[];
  onSubmit: (values: MouvementInput) => void;
}

export function SuiviDeviseMouvementFormSheet({ open, onOpenChange, mouvement, lots, onSubmit }: Props) {
  const isEdit = Boolean(mouvement);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: empty });

  useEffect(() => {
    if (!open) return;
    reset(
      mouvement
        ? {
            type: mouvement.type,
            lotId: mouvement.lotId ?? NONE,
            libelle: mouvement.libelle,
            date: mouvement.date ?? "",
            montant: mouvement.montant,
          }
        : empty,
    );
  }, [open, mouvement, reset]);

  const type = watch("type");
  const lotId = watch("lotId");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Modifier le mouvement" : "Nouveau mouvement"}</SheetTitle>
          <SheetDescription>Charge de transport, avoir ou règlement — s'ajoute au solde.</SheetDescription>
        </SheetHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={handleSubmit((v) => {
            onSubmit({
              type: v.type,
              lotId: v.lotId === NONE ? null : v.lotId,
              libelle: v.libelle.trim(),
              date: v.date || null,
              montant: v.montant,
            });
            onOpenChange(false);
          })}
        >
          <SheetBody className="space-y-5">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setValue("type", v as SuiviDeviseMouvementType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_LABELS) as SuiviDeviseMouvementType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Lot LC (facultatif)</Label>
              <Select value={lotId} onValueChange={(v) => setValue("lotId", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Aucun lot — global</SelectItem>
                  {lots.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.libelle || "Lot sans nom"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Libellé</Label>
              <Input {...register("libelle")} placeholder="Ex. DU F N°202300015" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" {...register("date")} />
              </div>
              <div className="space-y-1.5">
                <Label>Montant</Label>
                <Input type="number" step="any" {...register("montant")} className="text-right tabular-nums" />
              </div>
            </div>
          </SheetBody>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" variant="ledger">
              {isEdit ? "Enregistrer" : "Ajouter le mouvement"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

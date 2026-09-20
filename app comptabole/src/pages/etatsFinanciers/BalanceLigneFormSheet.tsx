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
import { Checkbox } from "@/components/ui/checkbox";
import { useBalances, type BalanceLigneInput } from "@/store/balances";
import type { BalanceLigne } from "@/types";

const schema = z.object({
  compte: z.string().min(1, "N° de compte requis"),
  libelle: z.string(),
  debit: z.coerce.number(),
  credit: z.coerce.number(),
  affectat: z.string(),
  scopeSociete: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ligne?: BalanceLigne | null;
  onSubmit: (values: BalanceLigneInput) => void;
}

export function BalanceLigneFormSheet({ open, onOpenChange, ligne, onSubmit }: Props) {
  const isEdit = Boolean(ligne);
  const grilleCodes = useBalances((s) => s.grilleCodes);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { compte: "", libelle: "", debit: 0, credit: 0, affectat: "", scopeSociete: false },
  });

  useEffect(() => {
    if (!open) return;
    reset(
      ligne
        ? {
            compte: ligne.compte,
            libelle: ligne.libelle,
            debit: ligne.debit,
            credit: ligne.credit,
            affectat: ligne.affectat,
            scopeSociete: false,
          }
        : { compte: "", libelle: "", debit: 0, credit: 0, affectat: "", scopeSociete: false },
    );
  }, [open, ligne, reset]);

  const debit = watch("debit");
  const credit = watch("credit");
  const scopeSociete = watch("scopeSociete");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Modifier la ligne" : "Nouvelle ligne"}</SheetTitle>
          <SheetDescription>
            Compte, montants et code de reclassement (AFFECTAT).
          </SheetDescription>
        </SheetHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={handleSubmit((v) => {
            onSubmit({
              compte: v.compte.trim(),
              libelle: v.libelle.trim(),
              debit: v.debit,
              credit: v.credit,
              affectat: v.affectat.trim(),
              scopeSociete: v.scopeSociete,
            });
            onOpenChange(false);
          })}
        >
          <SheetBody className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>N° de compte</Label>
                <Input {...register("compte")} placeholder="411000" className="font-mono" />
                {errors.compte?.message && (
                  <p className="text-xs text-destructive">{errors.compte.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Code AFFECTAT</Label>
                <Input
                  {...register("affectat")}
                  placeholder="AC10"
                  list="affectat-codes-datalist"
                  className="font-mono uppercase"
                />
                <datalist id="affectat-codes-datalist">
                  {grilleCodes.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.libelle}
                    </option>
                  ))}
                </datalist>
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-2.5 rounded-sm border border-border bg-muted px-3 py-2.5 text-sm">
              <Checkbox
                checked={scopeSociete}
                onCheckedChange={(v) => setValue("scopeSociete", Boolean(v))}
                className="mt-0.5"
              />
              <span className="text-muted-foreground">
                Limiter ce code AFFECTAT à ce dossier uniquement — ne change pas le
                classement de ce compte pour les autres sociétés
              </span>
            </label>

            <div className="space-y-1.5">
              <Label>Libellé</Label>
              <Input {...register("libelle")} placeholder="CLIENTS COMPTES RATTACHES" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Débit</Label>
                <Input
                  type="number"
                  step="any"
                  {...register("debit")}
                  className="text-right tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Crédit</Label>
                <Input
                  type="number"
                  step="any"
                  {...register("credit")}
                  className="text-right tabular-nums"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-sm border border-border bg-muted px-3 py-2 text-sm">
              <span className="text-muted-foreground">Solde (débit − crédit)</span>
              <span className="font-bold tabular-nums text-foreground">
                {(Number(debit || 0) - Number(credit || 0)).toLocaleString("fr-FR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          </SheetBody>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" variant="ledger">
              {isEdit ? "Enregistrer" : "Ajouter la ligne"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

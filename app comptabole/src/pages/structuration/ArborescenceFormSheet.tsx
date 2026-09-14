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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSocietes } from "@/store/data";
import type { Noeud } from "@/types";

const schema = z.object({
  libelle: z.string().min(2, "Libellé requis"),
  description: z.string().optional().default(""),
  societeId: z.string(),
});

export type ArboFormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noeud?: Noeud | null;
  defaultSocieteId?: string | null;
  onSubmit: (values: ArboFormValues) => void;
}

export function ArborescenceFormSheet({
  open,
  onOpenChange,
  noeud,
  defaultSocieteId,
  onSubmit,
}: Props) {
  const isEdit = Boolean(noeud);
  const societes = useSocietes();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ArboFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { libelle: "", description: "", societeId: "none" },
  });

  useEffect(() => {
    if (!open) return;
    reset(
      noeud
        ? {
            libelle: noeud.libelle,
            description: noeud.description,
            societeId: noeud.societeId ?? "none",
          }
        : {
            libelle: "",
            description: "",
            societeId: defaultSocieteId ?? "none",
          },
    );
  }, [open, noeud, defaultSocieteId, reset]);

  const societeId = watch("societeId");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {isEdit ? "Modifier l'arborescence" : "Ajouter une arborescence"}
          </SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Mettez à jour le dossier racine."
              : "Créez un dossier racine rattaché à une société."}
          </SheetDescription>
        </SheetHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={handleSubmit((v) => {
            onSubmit(v);
            onOpenChange(false);
          })}
        >
          <SheetBody className="space-y-5">
            <div className="space-y-1.5">
              <Label>Libellé</Label>
              <Input
                {...register("libelle")}
                placeholder="Ex. Comptabilité générale — 2026"
              />
              {errors.libelle?.message && (
                <p className="text-xs text-destructive">
                  {errors.libelle.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                {...register("description")}
                placeholder="Contenu et usage de ce dossier…"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Société rattachée</Label>
              <Select
                value={societeId}
                onValueChange={(v) => setValue("societeId", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Modèle générique</SelectItem>
                  {societes.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.raisonSociale}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </SheetBody>

          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button type="submit" variant="ledger">
              {isEdit ? "Enregistrer" : "Créer"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

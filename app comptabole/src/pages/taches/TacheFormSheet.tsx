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
import { useCollaborateurs, useSocietes } from "@/store/data";
import type { Tache } from "@/types";

const NONE = "__none__";

const schema = z.object({
  titre: z.string().min(2, "Titre requis"),
  description: z.string(),
  societeId: z.string().uuid("Société requise"),
  assigneId: z.string(),
});

export type TacheFormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tache?: Tache | null;
  defaultSocieteId?: string | null;
  onSubmit: (values: {
    titre: string;
    description: string;
    societeId: string;
    assigneId: string | null;
  }) => void;
}

export function TacheFormSheet({
  open,
  onOpenChange,
  tache,
  defaultSocieteId,
  onSubmit,
}: Props) {
  const isEdit = Boolean(tache);
  const societes = useSocietes();
  const collaborateurs = useCollaborateurs();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TacheFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { titre: "", description: "", societeId: "", assigneId: NONE },
  });

  useEffect(() => {
    if (!open) return;
    reset(
      tache
        ? {
            titre: tache.titre,
            description: tache.description ?? "",
            societeId: tache.societeId,
            assigneId: tache.assigneId ?? NONE,
          }
        : {
            titre: "",
            description: "",
            societeId: defaultSocieteId ?? "",
            assigneId: NONE,
          },
    );
  }, [open, tache, defaultSocieteId, reset]);

  const societeId = watch("societeId");
  const assigneId = watch("assigneId");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Modifier la tâche" : "Nouvelle tâche"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Mettez à jour le contenu, la société ou l'assignation."
              : "Décrivez le travail à faire et assignez-le à un collaborateur."}
          </SheetDescription>
        </SheetHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={handleSubmit((v) => {
            onSubmit({
              titre: v.titre.trim(),
              description: v.description.trim(),
              societeId: v.societeId,
              assigneId: v.assigneId === NONE ? null : v.assigneId,
            });
            onOpenChange(false);
          })}
        >
          <SheetBody className="space-y-5">
            <div className="space-y-1.5">
              <Label>Titre</Label>
              <Input {...register("titre")} placeholder="Déclaration TVA mensuelle" />
              {errors.titre?.message && (
                <p className="text-xs text-destructive">{errors.titre.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                {...register("description")}
                rows={4}
                placeholder="Précisions, échéance, pièces à récupérer…"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Société cliente</Label>
              <Select
                value={societeId}
                onValueChange={(v) =>
                  setValue("societeId", v, { shouldValidate: true })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une société" />
                </SelectTrigger>
                <SelectContent>
                  {societes.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.raisonSociale}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.societeId?.message && (
                <p className="text-xs text-destructive">
                  {errors.societeId.message}
                </p>
              )}
              {societes.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Ajoutez d'abord une société.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Assigné à</Label>
              <Select
                value={assigneId}
                onValueChange={(v) => setValue("assigneId", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Non assignée</SelectItem>
                  {collaborateurs.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.prenom} {c.nom}
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
              {isEdit ? "Enregistrer" : "Créer la tâche"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

import { useEffect, useState } from "react";
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
import { TACHE_MODULE_LABELS } from "@/types";
import type { Employe, Tache, TacheModule } from "@/types";

const NONE = "__none__";

export const tacheFormSchema = z.object({
  titre: z.string().trim().min(2, "Titre requis"),
  description: z.string(),
  societeId: z.string().uuid("Société requise"),
  assigneId: z.string(),
});

export type TacheFormValues = z.infer<typeof tacheFormSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tache?: Tache | null;
  defaultSocieteId?: string | null;
  /** Personnes proposées dans « Assigné à » (défaut : équipe du cabinet). */
  assignees?: Employe[];
  /** Société imposée (responsable de société) : le sélecteur est masqué. */
  lockedSocieteId?: string | null;
  onSubmit: (values: {
    titre: string;
    description: string;
    societeId: string;
    assigneId: string | null;
    module: TacheModule | null;
  }) => Promise<void>;
}

export function TacheFormSheet({
  open,
  onOpenChange,
  tache,
  defaultSocieteId,
  assignees,
  lockedSocieteId,
  onSubmit,
}: Props) {
  const isEdit = Boolean(tache);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [module, setModule] = useState<string>(NONE);
  const societes = useSocietes();
  const cabinetTeam = useCollaborateurs();
  const collaborateurs = assignees ?? cabinetTeam;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TacheFormValues>({
    resolver: zodResolver(tacheFormSchema),
    defaultValues: { titre: "", description: "", societeId: "", assigneId: NONE },
  });

  useEffect(() => {
    if (!open) return;
    setSubmitError(null);
    setModule(tache?.module ?? NONE);
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
            societeId: lockedSocieteId ?? defaultSocieteId ?? "",
            assigneId: NONE,
          },
    );
  }, [open, tache, defaultSocieteId, lockedSocieteId, reset]);

  const societeId = watch("societeId");
  const assigneId = watch("assigneId");

  return (
    <Sheet open={open} onOpenChange={(next) => {
      if (!next && isSubmitting) return;
      onOpenChange(next);
    }}>
      <SheetContent side="right" className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Modifier la tâche" : "Nouvelle tâche"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Mettez à jour le contenu, la société ou l'assignation."
              : lockedSocieteId
                ? "Décrivez le travail à faire et confiez-le à un délégué."
                : "Décrivez le travail à faire et assignez-le à un collaborateur."}
          </SheetDescription>
        </SheetHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={handleSubmit(async (v) => {
            setSubmitError(null);
            try {
              await onSubmit({
                titre: v.titre,
                description: v.description.trim(),
                societeId: v.societeId,
                assigneId: v.assigneId === NONE ? null : v.assigneId,
                module: module === NONE ? null : (module as TacheModule),
              });
              onOpenChange(false);
            } catch (error) {
              setSubmitError(error instanceof Error ? error.message : "Enregistrement impossible. Réessayez.");
            }
          })}
        >
          <SheetBody className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="tache-titre">Titre</Label>
              <Input
                id="tache-titre"
                {...register("titre")}
                disabled={isSubmitting}
                aria-invalid={Boolean(errors.titre)}
                aria-describedby={errors.titre ? "tache-titre-error" : undefined}
                placeholder="Déclaration TVA mensuelle"
              />
              {errors.titre?.message && (
                <p id="tache-titre-error" role="alert" className="text-xs text-destructive">{errors.titre.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tache-description">Description</Label>
              <Textarea
                id="tache-description"
                {...register("description")}
                disabled={isSubmitting}
                rows={4}
                placeholder="Décrivez le travail à réaliser…"
              />
            </div>

            <div className={lockedSocieteId ? "hidden" : "space-y-1.5"}>
              <Label htmlFor="tache-societe">Société cliente</Label>
              <Select
                value={societeId}
                disabled={isSubmitting}
                onValueChange={(v) =>
                  setValue("societeId", v, { shouldValidate: true })
                }
              >
                <SelectTrigger id="tache-societe" aria-invalid={Boolean(errors.societeId)} aria-describedby={errors.societeId ? "tache-societe-error" : undefined}>
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
                <p id="tache-societe-error" role="alert" className="text-xs text-destructive">
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
              <Label htmlFor="tache-assigne">Assigné à</Label>
              <Select
                value={assigneId}
                disabled={isSubmitting}
                onValueChange={(v) => setValue("assigneId", v)}
              >
                <SelectTrigger id="tache-assigne">
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
              {lockedSocieteId && collaborateurs.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Aucun délégué pour votre société — le cabinet peut en ajouter
                  depuis la fiche société.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tache-module">Module concerné (facultatif)</Label>
              <Select value={module} disabled={isSubmitting} onValueChange={setModule}>
                <SelectTrigger id="tache-module">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Aucun</SelectItem>
                  {(Object.keys(TACHE_MODULE_LABELS) as TacheModule[]).map((m) => (
                    <SelectItem key={m} value={m}>
                      {TACHE_MODULE_LABELS[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </SheetBody>

          <SheetFooter>
            {submitError && <p role="alert" className="w-full text-xs text-destructive">{submitError}</p>}
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button type="submit" variant="ledger" disabled={isSubmitting}>
              {isSubmitting ? "Enregistrement…" : isEdit ? "Enregistrer" : "Créer la tâche"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

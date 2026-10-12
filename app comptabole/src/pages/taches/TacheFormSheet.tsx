import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";
import { TACHE_MODULE_LABELS } from "@/types";
import type { Employe, Tache, TacheModule } from "@/types";
import { taskPlanningError } from "../../../shared/taskPlanning.js";

const NONE = "__none__";
const TITRE_MAX = 80;

/** AAAA-MM-JJ en heure locale (le champ date du navigateur). */
const jourLocal = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const RACCOURCIS_DATES = [
  { label: "Aujourd'hui → 7 j", jours: 7 },
  { label: "2 semaines", jours: 14 },
  { label: "1 mois", jours: 30 },
];

export const tacheFormSchema = z.object({
  titre: z.string().trim().min(2, "Titre requis"),
  description: z.string(),
  societeId: z.string().uuid("Société requise"),
  assigneId: z.string(),
  debutPrevu: z.string().default(""),
  finPrevue: z.string().default(""),
}).superRefine((values, context) => {
  const message = taskPlanningError(values.debutPrevu, values.finPrevue);
  if (message) context.addIssue({ code: z.ZodIssueCode.custom, path: [!values.debutPrevu && values.finPrevue ? "debutPrevu" : "finPrevue"], message });
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
    debutPrevu: string | null;
    finPrevue: string | null;
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
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<TacheFormValues>({
    resolver: zodResolver(tacheFormSchema),
    defaultValues: { titre: "", description: "", societeId: "", assigneId: NONE, debutPrevu: "", finPrevue: "" },
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
            debutPrevu: tache.debutPrevu ?? "",
            finPrevue: tache.finPrevue ?? "",
          }
        : {
            titre: "",
            description: "",
            societeId: lockedSocieteId ?? defaultSocieteId ?? "",
            assigneId: NONE,
            debutPrevu: "",
            finPrevue: "",
          },
    );
  }, [open, tache, defaultSocieteId, lockedSocieteId, reset]);

  const societeId = watch("societeId");
  const assigneId = watch("assigneId");
  const titre = watch("titre") ?? "";
  const debutPrevu = watch("debutPrevu") ?? "";
  const finPrevue = watch("finPrevue") ?? "";

  const planningError = taskPlanningError(debutPrevu, finPrevue);
  const formulaireValide = titre.trim().length >= 2 && Boolean(societeId) && !planningError;
  const aideBouton = formulaireValide
    ? "Prête à être enregistrée"
    : titre.trim().length < 2 && !societeId
      ? "Titre et société requis"
      : titre.trim().length < 2
        ? "Titre requis"
        : !societeId
          ? "Société requise"
          : "Corrigez les dates";

  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (!next && isSubmitting) return;
      onOpenChange(next);
    }}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-1.5rem)] max-w-[480px] flex-col gap-0 overflow-hidden rounded-md p-0">
        <DialogHeader className="space-y-0 px-4 pb-2.5 pt-3.5 pr-12">
          <DialogTitle className="font-serif text-[17px] font-semibold text-primary">{isEdit ? "Modifier la tâche" : "Nouvelle tâche"}</DialogTitle>
          <DialogDescription className="text-xs">
            {isEdit
              ? "Mettez à jour le contenu, la société ou l'assignation."
              : lockedSocieteId
                ? "Dans la colonne « À faire » · confiée à un délégué"
                : "Dans la colonne « À faire »"}
          </DialogDescription>
        </DialogHeader>

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
                debutPrevu: v.debutPrevu || null,
                finPrevue: v.finPrevue || null,
              });
              onOpenChange(false);
            } catch (error) {
              setSubmitError(error instanceof Error ? error.message : "Enregistrement impossible. Réessayez.");
            }
          })}
        >
          <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 pb-3.5 pt-0.5">
            <div className="space-y-1">
              <Label htmlFor="tache-titre" className="sr-only">Titre</Label>
              <Input
                id="tache-titre"
                {...register("titre")}
                disabled={isSubmitting}
                maxLength={TITRE_MAX}
                autoComplete="off"
                autoFocus
                aria-invalid={Boolean(errors.titre)}
                aria-describedby={errors.titre ? "tache-titre-error" : undefined}
                placeholder="Que faut-il faire ?  ex. Déclaration TVA mensuelle"
                className="h-10 font-semibold text-primary placeholder:font-semibold"
              />
              {errors.titre?.message && (
                <p id="tache-titre-error" role="alert" className="text-xs text-destructive">{errors.titre.message}</p>
              )}
            </div>

            <div className={cn("grid gap-2", !lockedSocieteId && "sm:grid-cols-2")}>
              <div className={lockedSocieteId ? "hidden" : "space-y-1"}>
                <Label htmlFor="tache-societe" className="text-[11px] font-semibold text-muted-foreground">Société <span className="text-destructive" aria-hidden="true">*</span></Label>
                <Select
                  value={societeId}
                  disabled={isSubmitting}
                  onValueChange={(v) =>
                    setValue("societeId", v, { shouldValidate: true })
                  }
                >
                  <SelectTrigger id="tache-societe" aria-label="Société cliente" aria-invalid={Boolean(errors.societeId)} aria-describedby={errors.societeId ? "tache-societe-error" : undefined}>
                    <SelectValue placeholder="Choisir…" />
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

              <div className="space-y-1">
                <Label htmlFor="tache-assigne" className="text-[11px] font-semibold text-muted-foreground">Assigné à</Label>
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
            </div>

            <div className="space-y-2.5 border-t border-dashed border-border pt-2.5">
              <div className="space-y-1">
                <Label htmlFor="tache-description" className="text-[11px] font-semibold text-muted-foreground">Description</Label>
                <Textarea
                  id="tache-description"
                  {...register("description")}
                  disabled={isSubmitting}
                  rows={1}
                  className="min-h-10 resize-y"
                  placeholder="Décrivez le travail à réaliser…"
                />
              </div>

              <div className="space-y-1">
                <p className="text-[11px] font-semibold leading-none text-muted-foreground">Module concerné</p>
                <div role="group" aria-label="Module concerné" className="flex flex-wrap gap-1.5 pt-1">
                  {[NONE, ...(Object.keys(TACHE_MODULE_LABELS) as TacheModule[])].map((m) => (
                    <button
                      key={m}
                      type="button"
                      disabled={isSubmitting}
                      aria-pressed={module === m}
                      onClick={() => setModule(m)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors disabled:opacity-50",
                        module === m
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-card text-muted-foreground hover:border-accent hover:text-foreground",
                      )}
                    >
                      {m === NONE ? "Aucun" : TACHE_MODULE_LABELS[m as TacheModule]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5" role="group" aria-labelledby="tache-planning-title">
                <div className="flex items-baseline justify-between">
                  <p id="tache-planning-title" className="text-[11px] font-semibold leading-none text-muted-foreground">Planification</p>
                  {(debutPrevu || finPrevue) && (
                    <button
                      type="button"
                      disabled={isSubmitting}
                      className="text-[11px] font-semibold text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-50"
                      onClick={() => { setValue("debutPrevu", "", { shouldDirty: true }); setValue("finPrevue", "", { shouldDirty: true }); clearErrors(["debutPrevu", "finPrevue"]); }}
                    >
                      Effacer les dates
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5" aria-label="Raccourcis de dates">
                  {RACCOURCIS_DATES.map((r) => (
                    <button
                      key={r.label}
                      type="button"
                      disabled={isSubmitting}
                      className="rounded-full border border-dashed border-primary/40 bg-card px-2.5 py-1 text-[11.5px] font-semibold text-primary transition-colors hover:border-accent hover:bg-accent/15 disabled:opacity-50"
                      onClick={() => {
                        const debut = new Date();
                        const fin = new Date();
                        fin.setDate(debut.getDate() + r.jours);
                        setValue("debutPrevu", jourLocal(debut), { shouldDirty: true });
                        setValue("finPrevue", jourLocal(fin), { shouldDirty: true });
                        clearErrors(["debutPrevu", "finPrevue"]);
                      }}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input id="tache-debut" type="date" aria-label="Début prévu" className="h-10" {...register("debutPrevu")} disabled={isSubmitting} aria-invalid={Boolean(errors.debutPrevu)} aria-describedby={errors.debutPrevu || errors.finPrevue ? "tache-planning-error" : undefined} />
                  <Input id="tache-fin" type="date" aria-label="Fin prévue" className="h-10" {...register("finPrevue")} disabled={isSubmitting} aria-invalid={Boolean(errors.finPrevue)} aria-describedby={errors.debutPrevu || errors.finPrevue ? "tache-planning-error" : undefined} />
                </div>
                {(errors.debutPrevu?.message || errors.finPrevue?.message) && <p id="tache-planning-error" role="alert" className="text-xs text-destructive">{errors.debutPrevu?.message || errors.finPrevue?.message}</p>}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-muted/40 px-4 py-2.5">
            {submitError && <p role="alert" className="w-full text-xs text-destructive">{submitError}</p>}
            <span className="mr-auto text-[11.5px] text-muted-foreground">{aideBouton}</span>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button type="submit" variant="ledger" disabled={isSubmitting || !formulaireValide}>
              {isSubmitting ? "Enregistrement…" : isEdit ? "Enregistrer" : "Créer la tâche"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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
import { getTaskPlanning, societeInitiales } from "@/components/tasks/taskTypes";
import { cn } from "@/lib/utils";
import { TACHE_MODULE_LABELS, TACHE_STATUT_LABELS } from "@/types";
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

const TRAIT_COLONNE = {
  a_faire: "border-l-primary/35",
  en_cours: "border-l-accent",
  termine: "border-l-success",
} as const;

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground after:h-px after:flex-1 after:bg-border">{titre}</h3>
      {children}
    </section>
  );
}

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
  const description = watch("description") ?? "";
  const debutPrevu = watch("debutPrevu") ?? "";
  const finPrevue = watch("finPrevue") ?? "";

  // Aperçu de la carte telle qu'elle apparaîtra dans le tableau.
  const statutApercu = tache?.statut ?? "a_faire";
  const nomSociete = societes.find((x) => x.id === societeId)?.raisonSociale ?? "";
  const assigne = collaborateurs.find((c) => c.id === assigneId);
  const nomAssigne = assigne ? `${assigne.prenom} ${assigne.nom}` : "";
  const planningError = taskPlanningError(debutPrevu, finPrevue);
  const planning = debutPrevu && finPrevue
    ? getTaskPlanning({ statut: statutApercu, debutPrevu, finPrevue, termineLe: tache?.termineLe ?? null } as Tache)
    : null;
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
    <Sheet open={open} onOpenChange={(next) => {
      if (!next && isSubmitting) return;
      onOpenChange(next);
    }}>
      <SheetContent side="right" className="sm:max-w-xl">
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
                debutPrevu: v.debutPrevu || null,
                finPrevue: v.finPrevue || null,
              });
              onOpenChange(false);
            } catch (error) {
              setSubmitError(error instanceof Error ? error.message : "Enregistrement impossible. Réessayez.");
            }
          })}
        >
          <SheetBody className="space-y-6">
            <Section titre="L'essentiel">
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <Label htmlFor="tache-titre">Titre <span className="text-destructive" aria-hidden="true">*</span></Label>
                  <span className="text-xs tabular-nums text-muted-foreground">{titre.length} / {TITRE_MAX}</span>
                </div>
                <Input
                  id="tache-titre"
                  {...register("titre")}
                  disabled={isSubmitting}
                  maxLength={TITRE_MAX}
                  autoComplete="off"
                  aria-invalid={Boolean(errors.titre)}
                  aria-describedby={errors.titre ? "tache-titre-error" : undefined}
                  placeholder="Déclaration TVA mensuelle"
                />
                {errors.titre?.message && (
                  <p id="tache-titre-error" role="alert" className="text-xs text-destructive">{errors.titre.message}</p>
                )}
              </div>

              <div className={cn("grid gap-3", !lockedSocieteId && "sm:grid-cols-2")}>
                <div className={lockedSocieteId ? "hidden" : "space-y-1.5"}>
                  <Label htmlFor="tache-societe">Société cliente <span className="text-destructive" aria-hidden="true">*</span></Label>
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
              </div>
            </Section>

            <Section titre="Détails">
              <div className="space-y-1.5">
                <Label htmlFor="tache-description">Description</Label>
                <Textarea
                  id="tache-description"
                  {...register("description")}
                  disabled={isSubmitting}
                  rows={3}
                  placeholder="Décrivez le travail à réaliser…"
                />
              </div>

              <div className="space-y-1.5">
                <p className="text-sm font-medium leading-none">Module concerné <span className="font-normal text-muted-foreground">(facultatif)</span></p>
                <div role="group" aria-label="Module concerné" className="flex flex-wrap gap-1.5 pt-1">
                  {[NONE, ...(Object.keys(TACHE_MODULE_LABELS) as TacheModule[])].map((m) => (
                    <button
                      key={m}
                      type="button"
                      disabled={isSubmitting}
                      aria-pressed={module === m}
                      onClick={() => setModule(m)}
                      className={cn(
                        "min-h-9 rounded-full border px-3 text-xs font-semibold transition-colors disabled:opacity-50",
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

              <div className="space-y-3 rounded-sm border border-border bg-muted/30 p-3" role="group" aria-labelledby="tache-planning-title">
                <p id="tache-planning-title" className="text-sm"><span className="font-semibold text-primary">Planification</span> <span className="text-xs text-muted-foreground">· facultative · place la tâche dans la vue Gantt</span></p>
                <div className="flex flex-wrap gap-1.5" aria-label="Raccourcis de dates">
                  {RACCOURCIS_DATES.map((r) => (
                    <button
                      key={r.label}
                      type="button"
                      disabled={isSubmitting}
                      className="min-h-9 rounded-full border border-dashed border-primary/40 bg-card px-3 text-xs font-semibold text-primary transition-colors hover:border-accent hover:bg-accent/15 disabled:opacity-50"
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
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label htmlFor="tache-debut">Début prévu</Label><Input id="tache-debut" type="date" className="h-11 sm:h-9" {...register("debutPrevu")} disabled={isSubmitting} aria-invalid={Boolean(errors.debutPrevu)} aria-describedby={errors.debutPrevu || errors.finPrevue ? "tache-planning-error" : undefined} /></div>
                  <div className="space-y-1.5"><Label htmlFor="tache-fin">Fin prévue</Label><Input id="tache-fin" type="date" className="h-11 sm:h-9" {...register("finPrevue")} disabled={isSubmitting} aria-invalid={Boolean(errors.finPrevue)} aria-describedby={errors.debutPrevu || errors.finPrevue ? "tache-planning-error" : undefined} /></div>
                </div>
                {(errors.debutPrevu?.message || errors.finPrevue?.message) && <p id="tache-planning-error" role="alert" className="text-xs text-destructive">{errors.debutPrevu?.message || errors.finPrevue?.message}</p>}
                <Button type="button" variant="ghost" size="sm" className="px-0 text-xs" disabled={isSubmitting || (!debutPrevu && !finPrevue)} onClick={() => { setValue("debutPrevu", "", { shouldDirty: true }); setValue("finPrevue", "", { shouldDirty: true }); clearErrors(["debutPrevu", "finPrevue"]); }}>Effacer les dates</Button>
              </div>
            </Section>

            <div className="rounded-sm border border-dashed border-primary/30 bg-primary/5 p-3" aria-live="polite">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Aperçu dans la colonne « {TACHE_STATUT_LABELS[statutApercu]} »</p>
              <article className={cn("grid gap-2.5 rounded-md border border-border border-l-4 bg-card p-3", TRAIT_COLONNE[statutApercu])}>
                <div className="flex items-center gap-2">
                  <span className="grid size-[22px] shrink-0 place-items-center rounded-[5px] bg-accent/20 text-[10px] font-extrabold text-primary" aria-hidden="true">{nomSociete ? societeInitiales(nomSociete) : "?"}</span>
                  <span className="min-w-0 truncate text-xs font-semibold text-muted-foreground">{nomSociete || "Société à choisir"}</span>
                </div>
                <div className="space-y-1">
                  <p className={cn("break-words text-sm font-semibold", titre.trim() ? "text-primary" : "text-muted-foreground/70")}>{titre.trim() || "Titre de la tâche"}</p>
                  {description.trim() && <p className="line-clamp-2 text-xs text-muted-foreground">{description.trim()}</p>}
                </div>
                {module !== NONE && <span className="w-fit rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">{TACHE_MODULE_LABELS[module as TacheModule]}</span>}
                {planning && !planningError ? (
                  <div className="grid gap-1.5">
                    <div className="flex items-baseline justify-between gap-2 text-xs tabular-nums">
                      <span className="font-semibold text-foreground">{planning.plage}</span>
                      <span className={cn("font-bold", planning.tone === "bad" && "text-destructive", planning.tone === "warn" && "text-warning", planning.tone === "muted" && "font-medium text-muted-foreground")}>{planning.label}</span>
                    </div>
                    <div className="h-[5px] overflow-hidden rounded-full bg-border"><div className={cn("h-full rounded-full", planning.tone === "bad" ? "bg-destructive" : "bg-accent")} style={{ width: `${planning.progress}%` }} /></div>
                  </div>
                ) : (
                  <p className="rounded border border-dashed border-input px-2 py-1 text-xs text-muted-foreground">Non planifiée</p>
                )}
                <div className="flex items-center gap-2 border-t border-border pt-2.5 text-xs font-semibold text-primary">
                  <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-extrabold", nomAssigne ? "bg-primary text-accent" : "border border-dashed border-input text-muted-foreground")} aria-hidden="true">{nomAssigne ? societeInitiales(nomAssigne) : "?"}</span>
                  <span className={cn("truncate", !nomAssigne && "font-medium text-muted-foreground")}>{nomAssigne || "Non assignée"}</span>
                </div>
              </article>
            </div>
          </SheetBody>

          <SheetFooter>
            {submitError && <p role="alert" className="w-full text-xs text-destructive">{submitError}</p>}
            <span className="mr-auto text-xs text-muted-foreground">{aideBouton}</span>
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
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  Hash,
  Layers,
  Mail,
  MapPin,
  PauseCircle,
  Phone,
  Plus,
  Save,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Societe, SocieteTheme, Statut } from "@/types";

const THEMES: SocieteTheme[] = [
  "PME",
  "Grande entreprise",
  "Association",
  "Profession libérale",
  "Auto-entrepreneur",
];

const schema = z.object({
  raisonSociale: z.string().min(2, "Raison sociale requise"),
  rne: z.string().min(3, "RNE requis"),
  tva: z.string().min(4, "Numéro de TVA requis"),
  theme: z.enum([
    "PME",
    "Grande entreprise",
    "Association",
    "Profession libérale",
    "Auto-entrepreneur",
  ]),
  code: z.string().min(2, "Code requis"),
  statut: z.enum(["actif", "inactif", "en_attente"]),
  // Numéro tunisien : 8 chiffres, jamais 0 ou 1 en tête (indicatif +216
  // optionnel, espaces tolérés — saisis puis retirés pour la validation).
  telephone: z
    .string()
    .refine(
      (v) => !v || /^[2-9]\d{7}$/.test(v.replace(/\D/g, "").replace(/^216/, "")),
      "Numéro tunisien invalide : 8 chiffres, sans 0 ni 1 en premier",
    )
    .optional()
    .default(""),
  email: z.string().email("Email invalide").or(z.literal("")).default(""),
  adresse: z.string().optional().default(""),
});

export type SocieteFormValues = z.infer<typeof schema>;

/** Initiales de l'aperçu : deux premières lettres des deux premiers mots, « ·· » tant que vide. */
function previewInitials(name: string) {
  const order = name.trim().match(/^\d{1,3}/);
  if (order) return order[0];
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "··";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

const STATUTS: { valeur: Statut; libelle: string; icone: typeof CheckCircle2; actif: string }[] = [
  { valeur: "actif", libelle: "Actif", icone: CheckCircle2, actif: "bg-success/10 text-success" },
  { valeur: "en_attente", libelle: "En attente", icone: Clock, actif: "bg-warning/10 text-warning" },
  { valeur: "inactif", libelle: "Inactif", icone: PauseCircle, actif: "bg-muted text-foreground" },
];

/** Section de la carte : titre en capitales avec son icône. */
function Rubrique({ icone: Icone, titre, children }: { icone: typeof FileText; titre: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-primary">
        <Icone className="size-4 text-accent" aria-hidden="true" />
        {titre}
      </h3>
      {children}
    </section>
  );
}

/** Champ avec libellé, icône dans la case et message d'erreur dessous. */
function Champ({
  id,
  label,
  requis,
  icone: Icone,
  erreur,
  lien,
  children,
}: {
  id: string;
  label: string;
  requis?: boolean;
  icone?: typeof FileText;
  erreur?: string;
  lien?: React.ReactNode;
  children: (classe: string) => React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id} className="text-[11.5px] font-semibold text-muted-foreground">
          {label}
          {requis && <span className="ml-0.5 text-destructive" aria-hidden="true">*</span>}
        </Label>
        {lien}
      </div>
      <div className="relative">
        {Icone && <Icone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />}
        {children(cn("h-10 text-[13.5px]", Icone && "pl-9", erreur && "border-destructive bg-destructive/5"))}
      </div>
      {erreur && (
        <p id={`${id}-error`} role="alert" className="flex items-center gap-1.5 text-[11.5px] text-destructive">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
          {erreur}
        </p>
      )}
    </div>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** undefined = création */
  societe?: Societe | null;
  nextCode: string;
  onSubmit: (values: SocieteFormValues) => Promise<void>;
}

export function SocieteFormSheet({
  open,
  onOpenChange,
  societe,
  nextCode,
  onSubmit,
}: Props) {
  const isEdit = Boolean(societe);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    clearErrors,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<SocieteFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      raisonSociale: "",
      rne: "",
      tva: "",
      theme: "PME",
      code: nextCode,
      statut: "actif",
      telephone: "",
      email: "",
      adresse: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    if (societe) {
      reset({ ...societe });
    } else {
      reset({
        raisonSociale: "",
        rne: "",
        tva: "",
        theme: "PME",
        code: nextCode,
        statut: "actif",
        telephone: "",
        email: "",
        adresse: "",
      });
    }
  }, [open, societe, nextCode, reset]);

  const theme = watch("theme");
  const statut = watch("statut");
  const email = watch("email");
  const raisonSociale = watch("raisonSociale");
  const code = watch("code");
  const rne = watch("rne");
  const tva = watch("tva");

  const aideBouton = isEdit
    ? isDirty
      ? "Modifications non enregistrées"
      : "Aucune modification en attente"
    : !raisonSociale.trim() || !rne.trim() || !tva.trim()
      ? "Raison sociale, RNE et TVA requis"
      : "Prête à être créée";

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isSubmitting) onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-1.5rem)] max-w-[560px] flex-col gap-0 overflow-hidden rounded-lg p-0">
        <div className="flex shrink-0 items-center gap-3.5 border-b border-border px-[18px] py-4 pr-14">
          <span
            aria-hidden="true"
            className={cn(
              "grid size-12 shrink-0 place-items-center rounded-[10px] border text-[15px] font-extrabold",
              raisonSociale.trim() ? "border-border bg-accent/15 text-primary" : "border-dashed border-input bg-muted/60 text-muted-foreground/70",
            )}
          >
            {previewInitials(raisonSociale)}
          </span>
          <div className="min-w-0 flex-1">
            <DialogTitle className="font-serif text-[22px] font-semibold leading-tight text-primary">
              {isEdit ? "Modifier la société" : "Ajouter une société"}
            </DialogTitle>
            <DialogDescription className="truncate text-[12.5px] text-muted-foreground">
              {isEdit
                ? `${societe?.raisonSociale ?? ""} · ${societe?.code ?? code}`
                : `Code ${code || nextCode} attribué automatiquement`}
            </DialogDescription>
          </div>
        </div>

        <form
          id="societe-form"
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={handleSubmit(async (values) => {
            clearErrors("root");
            try {
              await onSubmit(values);
              onOpenChange(false);
            } catch (error) {
              setError("root", {
                message:
                  error instanceof Error
                    ? `${error.message} Vérifiez les informations puis réessayez.`
                    : "Enregistrement impossible. Vérifiez les informations puis réessayez.",
              });
            }
          })}
        >
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-[18px] py-3.5">
            <Rubrique icone={FileText} titre="Identité">
              <Champ id="societe-raison-sociale" label="Raison sociale" requis erreur={errors.raisonSociale?.message}>
                {(classe) => (
                  <Input
                    id="societe-raison-sociale"
                    {...register("raisonSociale")}
                    placeholder="Ex. CAMCONSULT"
                    className={cn(classe, "h-11 font-serif text-[17px] font-semibold text-primary")}
                    aria-invalid={Boolean(errors.raisonSociale)}
                    aria-describedby={errors.raisonSociale ? "societe-raison-sociale-error" : undefined}
                  />
                )}
              </Champ>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <Champ id="societe-rne" label="RNE" requis icone={FileText} erreur={errors.rne?.message}>
                  {(classe) => (
                    <Input
                      id="societe-rne"
                      {...register("rne")}
                      placeholder="1234567A"
                      className={classe}
                      aria-invalid={Boolean(errors.rne)}
                      aria-describedby={errors.rne ? "societe-rne-error" : undefined}
                    />
                  )}
                </Champ>
                <Champ id="societe-tva" label="N° TVA" requis icone={FileText} erreur={errors.tva?.message}>
                  {(classe) => (
                    <Input
                      id="societe-tva"
                      {...register("tva")}
                      placeholder="1234567A/A/M/000"
                      className={classe}
                      aria-invalid={Boolean(errors.tva)}
                      aria-describedby={errors.tva ? "societe-tva-error" : undefined}
                    />
                  )}
                </Champ>
              </div>
            </Rubrique>

            <Rubrique icone={Layers} titre="Classification">
              <div className="space-y-1">
                <p id="societe-theme-label" className="text-[11.5px] font-semibold text-muted-foreground">Type de structure</p>
                <div role="radiogroup" aria-labelledby="societe-theme-label" className="flex flex-wrap gap-1.5">
                  {THEMES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      role="radio"
                      aria-checked={theme === t}
                      disabled={isSubmitting}
                      onClick={() => setValue("theme", t, { shouldDirty: true })}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] font-semibold transition-colors disabled:opacity-50",
                        theme === t
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-card text-muted-foreground hover:border-accent hover:text-foreground",
                      )}
                    >
                      {theme === t && <Building2 className="size-3.5" aria-hidden="true" />}
                      {t}
                    </button>
                  ))}
                </div>
                {errors.theme?.message && <p role="alert" className="text-[11.5px] text-destructive">{errors.theme.message}</p>}
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div className="space-y-1">
                  <p id="societe-statut-label" className="text-[11.5px] font-semibold text-muted-foreground">Statut</p>
                  <div role="radiogroup" aria-labelledby="societe-statut-label" className="flex overflow-hidden rounded-md border border-input">
                    {STATUTS.map(({ valeur, libelle, icone: Icone, actif }) => (
                      <button
                        key={valeur}
                        type="button"
                        role="radio"
                        aria-checked={statut === valeur}
                        disabled={isSubmitting}
                        onClick={() => setValue("statut", valeur, { shouldDirty: true })}
                        className={cn(
                          "inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 border-r border-input bg-card text-[12.5px] font-semibold text-muted-foreground transition-colors last:border-r-0 disabled:opacity-50",
                          statut === valeur && actif,
                        )}
                      >
                        <Icone className="size-3.5" aria-hidden="true" />
                        {libelle}
                      </button>
                    ))}
                  </div>
                </div>
                <Champ id="societe-code" label="Code interne" icone={Hash} erreur={errors.code?.message}>
                  {(classe) => (
                    <Input
                      id="societe-code"
                      {...register("code")}
                      className={classe}
                      aria-invalid={Boolean(errors.code)}
                      aria-describedby={errors.code ? "societe-code-error" : undefined}
                    />
                  )}
                </Champ>
              </div>
            </Rubrique>

            <Rubrique icone={Phone} titre="Coordonnées">
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <Champ id="societe-telephone" label="Téléphone" icone={Phone} erreur={errors.telephone?.message}>
                  {(classe) => (
                    <Input
                      id="societe-telephone"
                      {...register("telephone")}
                      type="tel"
                      placeholder="+216 00 00 00 00"
                      className={classe}
                      aria-invalid={Boolean(errors.telephone)}
                      aria-describedby={errors.telephone ? "societe-telephone-error" : undefined}
                    />
                  )}
                </Champ>
                <Champ
                  id="societe-email"
                  label="Email"
                  icone={Mail}
                  erreur={errors.email?.message}
                  lien={
                    email && !errors.email ? (
                      <a
                        href={`mailto:${email}`}
                        aria-label={`Envoyer un email à ${email}`}
                        className="text-[11.5px] font-bold text-primary underline underline-offset-2"
                      >
                        Envoyer un email
                      </a>
                    ) : undefined
                  }
                >
                  {(classe) => (
                    <Input
                      id="societe-email"
                      {...register("email")}
                      type="email"
                      placeholder="contact@societe.tn"
                      className={classe}
                      aria-invalid={Boolean(errors.email)}
                      aria-describedby={errors.email ? "societe-email-error" : undefined}
                    />
                  )}
                </Champ>
              </div>
              <Champ id="societe-adresse" label="Adresse" icone={MapPin} erreur={errors.adresse?.message}>
                {(classe) => (
                  <Input
                    id="societe-adresse"
                    {...register("adresse")}
                    placeholder="N°, rue, code postal, ville"
                    className={classe}
                    aria-invalid={Boolean(errors.adresse)}
                    aria-describedby={errors.adresse ? "societe-adresse-error" : undefined}
                  />
                )}
              </Champ>
            </Rubrique>

            {errors.root?.message && (
              <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errors.root.message}
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border bg-muted/40 px-[18px] py-3">
            <span className={cn("mr-auto text-xs", (isEdit ? isDirty : false) ? "font-bold text-warning" : "text-muted-foreground")}>{aideBouton}</span>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="ledger"
              className="gap-2"
              disabled={isSubmitting || (isEdit && !isDirty)}
            >
              {isEdit ? <Save className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
              {isSubmitting
                ? isEdit
                  ? "Enregistrement…"
                  : "Création…"
                : isEdit
                  ? "Enregistrer"
                  : "Créer la société"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

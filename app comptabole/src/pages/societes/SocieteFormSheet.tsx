import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CARD_FIELD_INPUT, CardField, CardSectionTitle } from "@/components/common/CardField";
import { StatutDot } from "@/components/ledger/StatusDot";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const SELECT_TRIGGER =
  "mt-1 h-auto w-full border-0 bg-transparent p-0 text-base text-foreground shadow-none focus:ring-0 focus:ring-offset-0 [&>svg]:size-4 [&>svg]:text-muted-foreground";

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
    formState: { errors, isSubmitting },
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
  const rne = watch("rne");
  const code = watch("code");

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isSubmitting) onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="flex max-h-[92vh] max-w-3xl flex-col gap-0 overflow-hidden rounded-2xl border-accent/30 p-0">
        <div className="shrink-0 border-b border-accent/30 px-6 pb-5 pt-6 sm:px-8">
          <DialogTitle className="font-serif text-3xl font-medium text-primary">
            {isEdit ? "Modifier la société" : "Ajouter une société"}
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            {isEdit
              ? "Mettez à jour les informations de la fiche société."
              : "Renseignez les informations de la nouvelle société cliente."}
          </DialogDescription>
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
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6 sm:px-8">
            <div className="rounded-xl border border-accent/30 bg-secondary/60 p-5" aria-live="polite">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Aperçu dans le registre
              </p>
              <div className="mt-3 flex items-center gap-4">
                <span
                  aria-hidden="true"
                  className={`grid size-14 shrink-0 place-items-center rounded-xl border text-sm font-bold tracking-wide ${raisonSociale.trim() ? "border-accent/40 bg-accent/15 text-primary" : "border-border bg-muted text-muted-foreground"}`}
                >
                  {previewInitials(raisonSociale)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`truncate font-serif text-2xl leading-tight ${raisonSociale.trim() ? "text-primary" : "text-muted-foreground/60"}`}>
                    {raisonSociale.trim() || "Nom de la société"}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {theme} · {rne.trim() || "RNE"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-xs text-muted-foreground">{code || "—"}</p>
                  <div className="mt-1 flex justify-end text-sm">
                    <StatutDot statut={statut} />
                  </div>
                </div>
              </div>
            </div>

            <CardSectionTitle>Identité</CardSectionTitle>
            <CardField id="societe-raison-sociale" label="Raison sociale" error={errors.raisonSociale?.message}>
              <input
                id="societe-raison-sociale"
                {...register("raisonSociale")}
                placeholder="Ex. CAMCONSULT"
                className={CARD_FIELD_INPUT}
                aria-invalid={Boolean(errors.raisonSociale)}
                aria-describedby={errors.raisonSociale ? "societe-raison-sociale-error" : undefined}
              />
            </CardField>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <CardField id="societe-rne" label="RNE" error={errors.rne?.message}>
                <input
                  id="societe-rne"
                  {...register("rne")}
                  placeholder="1234567A"
                  className={CARD_FIELD_INPUT}
                  aria-invalid={Boolean(errors.rne)}
                  aria-describedby={errors.rne ? "societe-rne-error" : undefined}
                />
              </CardField>
              <CardField id="societe-tva" label="N° TVA" error={errors.tva?.message}>
                <input
                  id="societe-tva"
                  {...register("tva")}
                  placeholder="1234567A/A/M/000"
                  className={CARD_FIELD_INPUT}
                  aria-invalid={Boolean(errors.tva)}
                  aria-describedby={errors.tva ? "societe-tva-error" : undefined}
                />
              </CardField>
            </div>

            <CardSectionTitle>Classification</CardSectionTitle>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <CardField id="societe-theme" label="Type de structure" error={errors.theme?.message}>
                <Select
                  value={theme}
                  onValueChange={(v) => setValue("theme", v as SocieteTheme)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger
                    id="societe-theme"
                    className={SELECT_TRIGGER}
                    aria-invalid={Boolean(errors.theme)}
                    aria-describedby={errors.theme ? "societe-theme-error" : undefined}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {THEMES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardField>
              <CardField id="societe-statut" label="Statut" error={errors.statut?.message}>
                <Select
                  value={statut}
                  onValueChange={(v) => setValue("statut", v as Statut)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger
                    id="societe-statut"
                    className={SELECT_TRIGGER}
                    aria-invalid={Boolean(errors.statut)}
                    aria-describedby={errors.statut ? "societe-statut-error" : undefined}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="actif">Actif</SelectItem>
                    <SelectItem value="inactif">Inactif</SelectItem>
                    <SelectItem value="en_attente">En attente</SelectItem>
                  </SelectContent>
                </Select>
              </CardField>
            </div>
            <CardField
              id="societe-code"
              label="Code interne"
              error={errors.code?.message}
              hint={isEdit ? undefined : "Généré automatiquement, modifiable"}
            >
              <input
                id="societe-code"
                {...register("code")}
                className={CARD_FIELD_INPUT}
                aria-invalid={Boolean(errors.code)}
                aria-describedby={errors.code ? "societe-code-error" : !isEdit ? "societe-code-hint" : undefined}
              />
            </CardField>

            <CardSectionTitle>Contact</CardSectionTitle>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <CardField id="societe-telephone" label="Téléphone" error={errors.telephone?.message}>
                <input
                  id="societe-telephone"
                  {...register("telephone")}
                  type="tel"
                  placeholder="+216 00 00 00 00"
                  className={CARD_FIELD_INPUT}
                  aria-invalid={Boolean(errors.telephone)}
                  aria-describedby={errors.telephone ? "societe-telephone-error" : undefined}
                />
              </CardField>
              <CardField id="societe-email" label="Email" error={errors.email?.message}>
                <div className="relative">
                  <input
                    id="societe-email"
                    {...register("email")}
                    type="email"
                    placeholder="contact@societe.tn"
                    className={`${CARD_FIELD_INPUT} ${email && !errors.email ? "pr-8" : ""}`}
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? "societe-email-error" : undefined}
                  />
                  {email && !errors.email && (
                    <a
                      href={`mailto:${email}`}
                      title="Envoyer un email à cette adresse"
                      aria-label={`Envoyer un email à ${email}`}
                      className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-accent"
                    >
                      <Mail className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </CardField>
            </div>
            <CardField id="societe-adresse" label="Adresse" error={errors.adresse?.message}>
              <input
                id="societe-adresse"
                {...register("adresse")}
                placeholder="N°, rue, code postal, ville"
                className={CARD_FIELD_INPUT}
                aria-invalid={Boolean(errors.adresse)}
                aria-describedby={errors.adresse ? "societe-adresse-error" : undefined}
              />
            </CardField>

            {errors.root?.message && (
              <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errors.root.message}
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-accent/30 px-6 py-4 sm:flex-row sm:justify-end sm:px-8">
            <Button
              type="button"
              variant="outline"
              className="h-12 rounded-lg px-6"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="ledger"
              className="h-12 rounded-lg px-8 text-sm uppercase tracking-[0.16em]"
              disabled={isSubmitting}
            >
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

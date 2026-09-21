import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail } from "lucide-react";
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

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isSubmitting) onOpenChange(nextOpen);
      }}
    >
      <SheetContent side="right" className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {isEdit ? "Modifier la société" : "Ajouter une société"}
          </SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Mettez à jour les informations de la fiche société."
              : "Renseignez les informations de la nouvelle société cliente."}
          </SheetDescription>
        </SheetHeader>

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
          <SheetBody className="space-y-5">
            <Field id="societe-raison-sociale" label="Raison sociale" error={errors.raisonSociale?.message}>
              <Input
                id="societe-raison-sociale"
                {...register("raisonSociale")}
                placeholder="Ex. CAMCONSULT"
                aria-invalid={Boolean(errors.raisonSociale)}
                aria-describedby={errors.raisonSociale ? "societe-raison-sociale-error" : undefined}
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="societe-rne" label="RNE" error={errors.rne?.message}>
                <Input
                  id="societe-rne"
                  {...register("rne")}
                  placeholder="1234567A"
                  aria-invalid={Boolean(errors.rne)}
                  aria-describedby={errors.rne ? "societe-rne-error" : undefined}
                />
              </Field>
              <Field id="societe-tva" label="N° TVA" error={errors.tva?.message}>
                <Input
                  id="societe-tva"
                  {...register("tva")}
                  placeholder="1234567A/A/M/000"
                  aria-invalid={Boolean(errors.tva)}
                  aria-describedby={errors.tva ? "societe-tva-error" : undefined}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="societe-theme" label="Type de structure" error={errors.theme?.message}>
                <Select
                  value={theme}
                  onValueChange={(v) => setValue("theme", v as SocieteTheme)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger
                    id="societe-theme"
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
              </Field>
              <Field id="societe-statut" label="Statut" error={errors.statut?.message}>
                <Select
                  value={statut}
                  onValueChange={(v) => setValue("statut", v as Statut)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger
                    id="societe-statut"
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
              </Field>
            </div>

            <Field
              id="societe-code"
              label="Code interne"
              error={errors.code?.message}
              hint={isEdit ? undefined : "Généré automatiquement, modifiable"}
            >
              <Input
                id="societe-code"
                {...register("code")}
                aria-invalid={Boolean(errors.code)}
                aria-describedby={errors.code ? "societe-code-error" : !isEdit ? "societe-code-hint" : undefined}
              />
            </Field>

            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Contact
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field id="societe-telephone" label="Téléphone" error={errors.telephone?.message}>
                  <Input
                    id="societe-telephone"
                    {...register("telephone")}
                    type="tel"
                    placeholder="+216 00 00 00 00"
                    aria-invalid={Boolean(errors.telephone)}
                    aria-describedby={errors.telephone ? "societe-telephone-error" : undefined}
                  />
                </Field>
                <Field id="societe-email" label="Email" error={errors.email?.message}>
                  <div className="relative">
                    <Input
                      id="societe-email"
                      {...register("email")}
                      type="email"
                      placeholder="contact@societe.tn"
                      className={email && !errors.email ? "pr-9" : undefined}
                      aria-invalid={Boolean(errors.email)}
                      aria-describedby={errors.email ? "societe-email-error" : undefined}
                    />
                    {email && !errors.email && (
                      <a
                        href={`mailto:${email}`}
                        title="Envoyer un email à cette adresse"
                        aria-label={`Envoyer un email à ${email}`}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-accent"
                      >
                        <Mail className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </Field>
              </div>
              <Field id="societe-adresse" label="Adresse" error={errors.adresse?.message}>
                <Input
                  id="societe-adresse"
                  {...register("adresse")}
                  placeholder="N°, rue, code postal, ville"
                  aria-invalid={Boolean(errors.adresse)}
                  aria-describedby={errors.adresse ? "societe-adresse-error" : undefined}
                />
              </Field>
            </div>

            {errors.root?.message && (
              <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errors.root.message}
              </p>
            )}
          </SheetBody>

          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button type="submit" variant="ledger" disabled={isSubmitting}>
              {isSubmitting
                ? isEdit
                  ? "Enregistrement…"
                  : "Création…"
                : isEdit
                  ? "Enregistrer"
                  : "Créer la société"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>
      )}
      {error && <p id={`${id}-error`} className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

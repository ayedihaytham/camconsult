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
  onSubmit: (values: SocieteFormValues) => void;
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
    formState: { errors },
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
    <Sheet open={open} onOpenChange={onOpenChange}>
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
          onSubmit={handleSubmit((v) => {
            onSubmit(v);
            onOpenChange(false);
          })}
        >
          <SheetBody className="space-y-5">
            <Field label="Raison sociale" error={errors.raisonSociale?.message}>
              <Input {...register("raisonSociale")} placeholder="Ex. CAMCONSULT" />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="RNE" error={errors.rne?.message}>
                <Input {...register("rne")} placeholder="1234567A" />
              </Field>
              <Field label="N° TVA" error={errors.tva?.message}>
                <Input {...register("tva")} placeholder="1234567A/A/M/000" />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Thème" error={errors.theme?.message}>
                <Select
                  value={theme}
                  onValueChange={(v) => setValue("theme", v as SocieteTheme)}
                >
                  <SelectTrigger>
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
              <Field label="Statut" error={errors.statut?.message}>
                <Select
                  value={statut}
                  onValueChange={(v) => setValue("statut", v as Statut)}
                >
                  <SelectTrigger>
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
              label="Code interne"
              error={errors.code?.message}
              hint={isEdit ? undefined : "Généré automatiquement, modifiable"}
            >
              <Input {...register("code")} />
            </Field>

            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Contact
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Téléphone" error={errors.telephone?.message}>
                  <Input
                    {...register("telephone")}
                    type="tel"
                    placeholder="+216 00 00 00 00"
                  />
                </Field>
                <Field label="Email" error={errors.email?.message}>
                  <div className="relative">
                    <Input
                      {...register("email")}
                      type="email"
                      placeholder="contact@societe.tn"
                      className={email && !errors.email ? "pr-9" : undefined}
                    />
                    {email && !errors.email && (
                      <a
                        href={`mailto:${email}`}
                        title="Envoyer un email à cette adresse"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-accent"
                      >
                        <Mail className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </Field>
              </div>
              <Field label="Adresse" error={errors.adresse?.message}>
                <Input {...register("adresse")} placeholder="N°, rue, code postal, ville" />
              </Field>
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
              {isEdit ? "Enregistrer" : "Créer la société"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && !error && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

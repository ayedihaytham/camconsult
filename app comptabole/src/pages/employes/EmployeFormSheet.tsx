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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PasswordField } from "@/components/common/PasswordField";
import { generatePassword } from "@/lib/password";
import { useSocietes } from "@/store/data";
import type { Employe, EmployeType, Statut } from "@/types";

const TYPES: EmployeType[] = [
  "Comptable",
  "Assistant",
  "Stagiaire",
  "Gestionnaire de paie",
];

const schema = z.object({
  prenom: z.string().min(2, "Prénom requis"),
  nom: z.string().min(2, "Nom requis"),
  identifiant: z.string().min(3, "Identifiant requis"),
  motDePasse: z.string().min(8, "8 caractères minimum"),
  type: z.enum(["Comptable", "Assistant", "Stagiaire", "Gestionnaire de paie"]),
  email: z.string().email("Email invalide"),
  statut: z.enum(["actif", "inactif", "en_attente"]),
  societesAssignees: z.array(z.string()),
});

export type EmployeFormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employe?: Employe | null;
  onSubmit: (values: EmployeFormValues) => void;
}

const emptyValues: EmployeFormValues = {
  prenom: "",
  nom: "",
  identifiant: "",
  motDePasse: generatePassword(),
  type: "Comptable",
  email: "",
  statut: "actif",
  societesAssignees: [],
};

export function EmployeFormSheet({
  open,
  onOpenChange,
  employe,
  onSubmit,
}: Props) {
  const isEdit = Boolean(employe);
  const societes = useSocietes();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<EmployeFormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (!open) return;
    reset(employe ? { ...employe } : { ...emptyValues, motDePasse: generatePassword() });
  }, [open, employe, reset]);

  const type = watch("type");
  const statut = watch("statut");
  const motDePasse = watch("motDePasse");
  const assigned = watch("societesAssignees");

  function toggleSociete(id: string) {
    setValue(
      "societesAssignees",
      assigned.includes(id)
        ? assigned.filter((x) => x !== id)
        : [...assigned, id],
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {isEdit ? "Modifier le collaborateur" : "Ajouter un comptable"}
          </SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Mettez à jour la fiche du collaborateur."
              : "Créez un compte collaborateur et assignez ses sociétés."}
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
            <div className="grid grid-cols-2 gap-4">
              <Field label="Prénom" error={errors.prenom?.message}>
                <Input {...register("prenom")} placeholder="Camille" />
              </Field>
              <Field label="Nom" error={errors.nom?.message}>
                <Input {...register("nom")} placeholder="Moreau" />
              </Field>
            </div>

            <Field label="Email" error={errors.email?.message}>
              <Input
                {...register("email")}
                placeholder="c.moreau@cabinet-comptable.fr"
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Type / rôle" error={errors.type?.message}>
                <Select
                  value={type}
                  onValueChange={(v) => setValue("type", v as EmployeType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => (
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

            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Identifiants de connexion
              </p>
              <div className="space-y-4">
                <Field label="Identifiant" error={errors.identifiant?.message}>
                  <Input {...register("identifiant")} placeholder="c.moreau" />
                </Field>
                <div className="space-y-1.5">
                  <Label>Mot de passe</Label>
                  <PasswordField
                    value={motDePasse}
                    onValueChange={(v) =>
                      setValue("motDePasse", v, { shouldValidate: true })
                    }
                  />
                  {errors.motDePasse?.message && (
                    <p className="text-xs text-destructive">
                      {errors.motDePasse.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Sociétés assignées</Label>
                <span className="text-xs text-muted-foreground">
                  {assigned.length} sélectionnée{assigned.length > 1 ? "s" : ""}
                </span>
              </div>
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                {societes.length === 0 && (
                  <p className="px-2 py-1.5 text-sm text-muted-foreground">
                    Aucune société enregistrée. Ajoutez des sociétés pour
                    pouvoir les assigner.
                  </p>
                )}
                {societes.map((s) => (
                  <label
                    key={s.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-secondary"
                  >
                    <Checkbox
                      checked={assigned.includes(s.id)}
                      onCheckedChange={() => toggleSociete(s.id)}
                    />
                    <span className="text-sm text-foreground">
                      {s.raisonSociale}
                    </span>
                    <span className="ml-auto font-mono text-xs text-muted-foreground">
                      {s.code}
                    </span>
                  </label>
                ))}
              </div>
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
              {isEdit ? "Enregistrer" : "Créer le collaborateur"}
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
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generatePassword } from "@/lib/password";
import { useSocietes } from "@/store/data";
import type { Employe, EmployeType, Statut } from "@/types";

const TYPES: EmployeType[] = [
  "Comptable",
  "Assistant",
  "Stagiaire",
  "Gestionnaire de paie",
];

const NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ' -]*$/;

const schema = z.object({
  prenom: z.string().min(2, "Prénom requis").regex(NAME_RE, "Lettres uniquement"),
  nom: z.string().min(2, "Nom requis").regex(NAME_RE, "Lettres uniquement"),
  identifiant: z
    .string()
    .min(3, "3 caractères minimum")
    .max(32, "32 caractères maximum")
    .regex(
      /^[a-z][a-z0-9._-]*$/,
      "Minuscules, chiffres, points ou tirets uniquement — doit commencer par une lettre",
    ),
  motDePasse: z.string().min(8, "8 caractères minimum"),
  type: z.enum(["Comptable", "Assistant", "Stagiaire", "Gestionnaire de paie"]),
  role: z.enum(["collaborateur", "responsable_collaborateurs"]),
  email: z.string().email("Email invalide"),
  statut: z.enum(["actif", "inactif", "en_attente"]),
  societesAssignees: z.array(z.string()),
});

/** Identifiant proposé à partir du prénom/nom (ex. « Ahmed Ben Salah » →
 * « a.bensalah ») — accents retirés, minuscules, un seul point. Reste
 * modifiable : la proposition s'arrête dès que l'utilisateur tape
 * lui-même dans le champ (voir identifiantTouched). */
function normalizeNamePart(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function suggestIdentifiant(prenom: string, nom: string) {
  const p = normalizeNamePart(prenom);
  const n = normalizeNamePart(nom);
  if (!p || !n) return "";
  return `${p[0]}.${n}`;
}

// En modification, un mot de passe vide signifie « inchangé ».
const editSchema = schema.extend({
  motDePasse: z
    .string()
    .refine((v) => v === "" || v.length >= 8, "8 caractères minimum"),
});

export type EmployeFormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employe?: Employe | null;
  /** Seul l'admin peut promouvoir un compte responsable des collaborateurs
   * — masqué sinon (le rôle reste "collaborateur"). */
  canAssignRole?: boolean;
  onSubmit: (values: EmployeFormValues) => void;
}

const emptyValues: EmployeFormValues = {
  prenom: "",
  nom: "",
  identifiant: "",
  motDePasse: generatePassword(),
  type: "Comptable",
  role: "collaborateur",
  email: "",
  statut: "actif",
  societesAssignees: [],
};

export function EmployeFormSheet({
  open,
  onOpenChange,
  employe,
  canAssignRole = false,
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
    resolver: zodResolver(isEdit ? editSchema : schema),
    defaultValues: emptyValues,
  });

  const [identifiantTouched, setIdentifiantTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setIdentifiantTouched(false);
    reset(
      employe
        ? {
            ...employe,
            role:
              canAssignRole && employe.role === "responsable_collaborateurs"
                ? "responsable_collaborateurs"
                : "collaborateur",
          }
        : { ...emptyValues, motDePasse: generatePassword() },
    );
  }, [open, employe, canAssignRole, reset]);

  const type = watch("type");
  const role = watch("role");
  const statut = watch("statut");
  const assigned = watch("societesAssignees");
  const prenom = watch("prenom");
  const nom = watch("nom");

  useEffect(() => {
    if (isEdit || identifiantTouched) return;
    setValue("identifiant", suggestIdentifiant(prenom, nom));
  }, [prenom, nom, isEdit, identifiantTouched, setValue]);

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
            {isEdit ? "Modifier le collaborateur" : "Ajouter un collaborateur"}
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
                <Input {...register("prenom")} placeholder="Prénom" />
              </Field>
              <Field label="Nom" error={errors.nom?.message}>
                <Input {...register("nom")} placeholder="Nom" />
              </Field>
            </div>

            <Field label="Email" error={errors.email?.message}>
              <Input
                {...register("email")}
                type="email"
                placeholder="email@camconsult.com.tn"
              />
            </Field>

            {canAssignRole && (
              <Field
                label="Rôle"
                hint="Responsable des collaborateurs : gère l'équipe et voit toutes les sociétés, sans Journal/Paramètres/État client/Bordereaux."
              >
                <Select
                  value={role}
                  onValueChange={(v) =>
                    setValue("role", v as EmployeFormValues["role"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="collaborateur">Collaborateur</SelectItem>
                    <SelectItem value="responsable_collaborateurs">
                      Responsable des collaborateurs
                    </SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Field label="Type" error={errors.type?.message}>
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
                <Field
                  label="Identifiant"
                  error={errors.identifiant?.message}
                  hint={
                    !isEdit && !identifiantTouched
                      ? "Proposé à partir du prénom/nom — modifiable"
                      : undefined
                  }
                >
                  <Input
                    {...register("identifiant", {
                      onChange: () => setIdentifiantTouched(true),
                    })}
                    placeholder="p.nom"
                  />
                </Field>
                <div className="space-y-1.5">
                  <Label>Mot de passe</Label>
                  <Input
                    {...register("motDePasse")}
                    type="password"
                    autoComplete="new-password"
                    aria-label="Mot de passe"
                    placeholder={isEdit ? "Laisser vide pour ne pas changer" : undefined}
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

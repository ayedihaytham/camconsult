import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  useSocietes,
  defaultPermissions,
  PERMISSION_LABELS,
} from "@/store/data";
import { employeNomComplet } from "@/data/employes";
import type { Employe, EmployePermissions, PermissionKey } from "@/types";

const PERMISSION_HINTS: Record<PermissionKey, string> = {
  consulterDossiers: "Lecture de l'arborescence documentaire",
  deposerFichiers: "Ajout de documents dans les dossiers",
  modifierSocietes: "Édition des informations clients",
  supprimer: "Suppression de dossiers et de fichiers",
  messagerie: "Échanges avec le responsable",
};

const PERMISSION_ORDER: PermissionKey[] = [
  "consulterDossiers",
  "deposerFichiers",
  "modifierSocietes",
  "supprimer",
  "messagerie",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employe: Employe | null;
  onSave: (
    employeId: string,
    societesAssignees: string[],
    permissions: EmployePermissions,
  ) => void;
}

export function EmployeAccesSheet({ open, onOpenChange, employe, onSave }: Props) {
  const societes = useSocietes();
  const [assigned, setAssigned] = useState<string[]>([]);
  const [perms, setPerms] = useState<EmployePermissions>(
    defaultPermissions("Assistant"),
  );

  useEffect(() => {
    if (open && employe) {
      setAssigned(employe.societesAssignees);
      setPerms(employe.permissions ?? defaultPermissions(employe.type));
    }
  }, [open, employe]);

  function toggle(id: string) {
    setAssigned((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  }

  const grantedCount = PERMISSION_ORDER.filter((k) => perms[k]).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-accent" />
            Gestion des accès
          </SheetTitle>
          <SheetDescription>
            {employe
              ? `Droits et périmètre de ${employeNomComplet(employe)}. Ces règles s'appliquent à la session du collaborateur.`
              : ""}
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="space-y-6">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Permissions
              </h4>
              <span className="text-xs text-muted-foreground">
                {grantedCount} / {PERMISSION_ORDER.length} accordées
              </span>
            </div>
            <div className="space-y-1">
              {PERMISSION_ORDER.map((key) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-secondary"
                >
                  <Checkbox
                    className="mt-0.5"
                    checked={perms[key]}
                    onCheckedChange={(c) =>
                      setPerms((prev) => ({ ...prev, [key]: Boolean(c) }))
                    }
                  />
                  <span>
                    <span className="block text-sm font-medium text-foreground">
                      {PERMISSION_LABELS[key]}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {PERMISSION_HINTS[key]}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {employe && (
              <button
                type="button"
                onClick={() => setPerms(defaultPermissions(employe.type))}
                className="mt-2 text-xs font-bold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
              >
                Réinitialiser selon le rôle « {employe.type} »
              </button>
            )}
          </section>

          <Separator />

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Sociétés accessibles
              </h4>
              <span className="text-xs text-muted-foreground">
                {assigned.length} / {societes.length}
              </span>
            </div>
            <div className="space-y-1 rounded-md border border-border p-2">
              {societes.length === 0 && (
                <p className="px-2 py-1.5 text-sm text-muted-foreground">
                  Aucune société enregistrée.
                </p>
              )}
              {societes.map((s) => (
                <label
                  key={s.id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-secondary"
                >
                  <Checkbox
                    checked={assigned.includes(s.id)}
                    onCheckedChange={() => toggle(s.id)}
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
          </section>
        </SheetBody>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            variant="ledger"
            onClick={() => {
              if (employe) onSave(employe.id, assigned, perms);
              toast.success("Accès mis à jour");
              onOpenChange(false);
            }}
          >
            Enregistrer les accès
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

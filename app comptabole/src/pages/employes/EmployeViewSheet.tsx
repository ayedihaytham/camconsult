import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Check, X } from "lucide-react";
import { DetailRow } from "@/components/ledger/DetailSheetRow";
import { StatutDot } from "@/components/ledger/StatusDot";
import { formatDate } from "@/lib/utils";
import { useSocietes, PERMISSION_LABELS } from "@/store/data";
import { employeNomComplet } from "@/data/employes";
import type { Employe, PermissionKey } from "@/types";

export function EmployeViewSheet({
  open,
  onOpenChange,
  employe,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employe: Employe | null;
}) {
  const societes = useSocietes();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Fiche collaborateur</SheetTitle>
        </SheetHeader>
        {employe && (
          <SheetBody className="space-y-5">
            <div className="flex items-center gap-4">
              <span className="flex size-[72px] shrink-0 items-center justify-center rounded-full bg-accent/15 text-lg font-bold text-primary">
                {employe.prenom[0]}
                {employe.nom[0]}
              </span>
              <div className="min-w-0">
                <h3 className="font-serif text-3xl font-medium leading-tight text-primary">
                  {employeNomComplet(employe)}
                </h3>
                <div className="mt-1 flex items-center gap-3 text-base">
                  <span className="text-muted-foreground">{employe.type}</span>
                  <StatutDot statut={employe.statut} />
                </div>
              </div>
            </div>

            <dl className="divide-y divide-accent/25 overflow-hidden rounded-xl border border-accent/30 bg-card">
              <DetailRow label="Identifiant" value={employe.identifiant} />
              <DetailRow
                label="Email"
                value={employe.email}
                href={employe.email ? `mailto:${employe.email}` : undefined}
              />
              <DetailRow label="Créé le" value={formatDate(employe.creeLe)} />
            </dl>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Sociétés assignées ({employe.societesAssignees.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {employe.societesAssignees.map((id) => {
                  const s = societes.find((x) => x.id === id) ?? null;
                  return (
                    <span
                      key={id}
                      className="rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground"
                    >
                      {s?.raisonSociale ?? id}
                    </span>
                  );
                })}
                {employe.societesAssignees.length === 0 && (
                  <span className="text-sm text-muted-foreground">
                    Aucune société assignée
                  </span>
                )}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Permissions
              </p>
              <ul className="divide-y divide-accent/25 overflow-hidden rounded-xl border border-accent/30 bg-card">
                {(Object.keys(PERMISSION_LABELS) as PermissionKey[]).map(
                  (key) => {
                    const on = Boolean(employe.permissions?.[key]);
                    return (
                      <li
                        key={key}
                        className="flex items-center justify-between px-4 py-2 text-sm"
                      >
                        <span className="text-foreground">
                          {PERMISSION_LABELS[key]}
                        </span>
                        {on ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
                            <Check className="h-3.5 w-3.5 text-success" />
                            Autorisé
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                            <X className="h-3.5 w-3.5" />
                            Refusé
                          </span>
                        )}
                      </li>
                    );
                  },
                )}
              </ul>
            </div>
          </SheetBody>
        )}
      </SheetContent>
    </Sheet>
  );
}

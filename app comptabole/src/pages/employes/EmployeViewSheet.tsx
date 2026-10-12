import {
  AtSign,
  Briefcase,
  Building2,
  CalendarDays,
  CheckCircle2,
  Mail,
  Pencil,
  PauseCircle,
  ShieldCheck,
  User,
  XCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn, formatDate, initials } from "@/lib/utils";
import { useData, useSocietes, PERMISSION_LABELS } from "@/store/data";
import { employeNomComplet } from "@/data/employes";
import type { Employe, PermissionKey } from "@/types";

function Rubrique({
  icone: Icone,
  titre,
  compteur,
  droite,
  children,
}: {
  icone: typeof User;
  titre: string;
  compteur?: number;
  droite?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-primary">
        <Icone className="size-4 text-accent" aria-hidden="true" />
        {titre}
        {compteur !== undefined && (
          <span className="rounded-full border border-border bg-muted px-2 text-[11px] font-semibold tracking-normal text-muted-foreground">{compteur}</span>
        )}
        {droite && <span className="ml-auto text-xs font-bold normal-case tracking-normal text-muted-foreground">{droite}</span>}
      </h3>
      {children}
    </section>
  );
}

function Ligne({ icone: Icone, libelle, className, children }: { icone: typeof User; libelle: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2.5 border-b border-dashed border-border py-2 text-[13px]", className)}>
      <Icone className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="shrink-0 text-muted-foreground">{libelle}</span>
      <span className="ml-auto min-w-0 truncate text-right font-bold text-primary">{children}</span>
    </div>
  );
}

export function EmployeViewSheet({
  open,
  onOpenChange,
  employe,
  onEdit,
  onAcces,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employe: Employe | null;
  onEdit?: (employe: Employe) => void;
  onAcces?: (employe: Employe) => void;
}) {
  const societes = useSocietes();
  const enLigne = useData((s) => (employe ? s.enLigneIds.includes(employe.id) : false));
  const cles = Object.keys(PERMISSION_LABELS) as PermissionKey[];
  const autorisees = employe ? cles.filter((k) => Boolean(employe.permissions?.[k])).length : 0;
  const actif = employe?.statut === "actif";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-1.5rem)] max-w-[540px] flex-col gap-0 overflow-hidden rounded-lg p-0">
        {employe && (
          <>
            <DialogHeader className="flex-row items-center gap-3.5 space-y-0 border-b border-border px-[18px] py-4 pr-14">
              <span className={cn("relative grid size-12 shrink-0 place-items-center rounded-full text-[15px] font-extrabold", actif ? "bg-primary text-accent" : "border border-border bg-muted text-muted-foreground")} aria-hidden="true">
                {initials(employeNomComplet(employe))}
                <span className={cn("absolute bottom-0 right-0 size-[11px] rounded-full border-2 border-card", enLigne ? "bg-success" : "bg-muted-foreground/50")} />
              </span>
              <div className="min-w-0 flex-1">
                <DialogTitle className="truncate font-serif text-[22px] font-semibold leading-tight text-primary">{employeNomComplet(employe)}</DialogTitle>
                <DialogDescription className="flex items-center gap-1.5 text-[12.5px]">
                  <Briefcase className="size-3.5" aria-hidden="true" />
                  {employe.type}
                </DialogDescription>
              </div>
              <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-bold", actif ? "bg-success/10 text-success" : employe.statut === "en_attente" ? "bg-warning/10 text-warning" : "border border-border bg-muted text-muted-foreground")}>
                {actif ? <CheckCircle2 className="size-3.5" aria-hidden="true" /> : <PauseCircle className="size-3.5" aria-hidden="true" />}
                {actif ? "Actif" : employe.statut === "en_attente" ? "En attente" : "Inactif"}
              </span>
            </DialogHeader>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-[18px] py-3.5">
              <Rubrique icone={User} titre="Identité">
                <div className="grid gap-x-6 sm:grid-cols-2">
                  <Ligne icone={AtSign} libelle="Identifiant">{employe.identifiant}</Ligne>
                  <Ligne icone={CalendarDays} libelle="Créé le">{formatDate(employe.creeLe)}</Ligne>
                  <Ligne icone={Mail} libelle="Email" className="sm:col-span-2">
                    {employe.email ? <a className="hover:underline" href={`mailto:${employe.email}`}>{employe.email}</a> : "—"}
                  </Ligne>
                </div>
              </Rubrique>

              <Rubrique icone={Building2} titre="Sociétés assignées" compteur={employe.societesAssignees.length}>
                {employe.societesAssignees.length === 0 ? (
                  <div className="flex items-center gap-2.5 rounded-md border border-dashed border-input px-3 py-2.5 text-[13px] text-muted-foreground">
                    <Building2 className="size-4 shrink-0" aria-hidden="true" />
                    Aucune société assignée
                    {onEdit && (
                      <Button type="button" variant="outline" size="sm" className="ml-auto h-7 gap-1.5 px-2.5 text-xs font-semibold" onClick={() => onEdit(employe)}>
                        <Pencil className="size-3.5" aria-hidden="true" />
                        Assigner
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {employe.societesAssignees.map((id) => {
                      const nom = societes.find((x) => x.id === id)?.raisonSociale ?? id;
                      return (
                        <span key={id} className="inline-flex items-center gap-2 rounded-md border border-border bg-muted/50 py-1 pl-1.5 pr-2.5 text-[13px] font-semibold text-primary">
                          <span className="grid size-[22px] place-items-center rounded-[5px] bg-accent/20 text-[10px] font-extrabold" aria-hidden="true">
                            {(nom.match(/^\d{1,3}/)?.[0] ?? nom.split(/\s+/).map((m) => m[0]).slice(0, 2).join("")).toUpperCase()}
                          </span>
                          {nom}
                        </span>
                      );
                    })}
                  </div>
                )}
              </Rubrique>

              <Rubrique icone={ShieldCheck} titre="Permissions" droite={`${autorisees} sur ${cles.length} autorisée${autorisees > 1 ? "s" : ""}`}>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {cles.map((key) => {
                    const on = Boolean(employe.permissions?.[key]);
                    return (
                      <li
                        key={key}
                        className={cn("flex items-center gap-2.5 rounded-md border px-2.5 py-2 text-[13px]", on ? "border-border text-foreground" : "border-border bg-muted/50 text-muted-foreground")}
                      >
                        {on ? <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" /> : <XCircle className="size-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />}
                        {PERMISSION_LABELS[key]}
                        <span className={cn("ml-auto text-[11.5px] font-bold", on ? "text-success" : "text-muted-foreground/70")}>{on ? "Autorisé" : "Refusé"}</span>
                      </li>
                    );
                  })}
                </ul>
              </Rubrique>
            </div>

            {(onEdit || onAcces) && (
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-muted/40 px-[18px] py-3">
                <span className="mr-auto text-xs text-muted-foreground">Les droits se modifient dans « Accès ».</span>
                {onEdit && (
                  <Button type="button" variant="outline" className="gap-2" onClick={() => onEdit(employe)}>
                    <Pencil className="size-4" aria-hidden="true" />
                    Modifier
                  </Button>
                )}
                {onAcces && (
                  <Button type="button" variant="outline" className="gap-2 border-accent bg-accent/15 hover:bg-accent/30" onClick={() => onAcces(employe)}>
                    <ShieldCheck className="size-4" aria-hidden="true" />
                    Accès
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

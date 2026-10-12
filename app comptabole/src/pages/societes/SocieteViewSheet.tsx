import {
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  FolderOpen,
  Mail,
  MapPin,
  Pencil,
  PauseCircle,
  Phone,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import type { Societe, Statut } from "@/types";
import { SocieteEmployesSection } from "./SocieteEmployesSection";

const STATUT_PASTILLE: Record<Statut, { icone: typeof CheckCircle2; libelle: string; classe: string }> = {
  actif: { icone: CheckCircle2, libelle: "Actif", classe: "bg-success/10 text-success" },
  en_attente: { icone: Clock, libelle: "En attente", classe: "bg-warning/10 text-warning" },
  inactif: { icone: PauseCircle, libelle: "Inactif", classe: "bg-muted text-muted-foreground" },
};

function initiales(nom: string) {
  const ordre = nom.trim().match(/^\d{1,3}/);
  if (ordre) return ordre[0];
  const mots = nom.trim().split(/\s+/).filter(Boolean);
  return mots.length > 1 ? `${mots[0][0]}${mots[1][0]}`.toUpperCase() : nom.slice(0, 2).toUpperCase();
}

function Rubrique({ icone: Icone, titre, children }: { icone: typeof FileText; titre: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-primary">
        <Icone className="size-4 text-accent" aria-hidden="true" />
        {titre}
      </h3>
      {children}
    </section>
  );
}

function Ligne({ icone: Icone, libelle, children }: { icone: typeof FileText; libelle: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 border-b border-dashed border-border py-2 text-[13px]">
      <Icone className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="shrink-0 text-muted-foreground">{libelle}</span>
      <span className="ml-auto min-w-0 truncate text-right font-bold text-primary">{children}</span>
    </div>
  );
}

export function SocieteViewSheet({
  open,
  onOpenChange,
  societe,
  onEdit,
  onOpenDossiers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  societe: Societe | null;
  onEdit?: (societe: Societe) => void;
  onOpenDossiers?: (societe: Societe) => void;
}) {
  const { isAdmin, can, canManageCollaborateurs } = usePermissions();
  // Les comptes de la société (responsable, délégués) : l'administrateur et le responsable des collaborateurs les gèrent.
  const gereContacts = isAdmin || canManageCollaborateurs;
  const canEdit = isAdmin || can("modifierSocietes");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-1.5rem)] max-w-[540px] flex-col gap-0 overflow-hidden rounded-lg p-0">
        {societe && (
          <>
            <DialogHeader className="flex-row items-center gap-3.5 space-y-0 border-b border-border px-[18px] py-4 pr-14">
              <span className="grid size-12 shrink-0 place-items-center rounded-[10px] border border-border bg-accent/15 text-[15px] font-extrabold text-primary" aria-hidden="true">
                {initiales(societe.raisonSociale)}
              </span>
              <div className="min-w-0 flex-1">
                <DialogTitle className="truncate font-serif text-[22px] font-semibold leading-tight text-primary">{societe.raisonSociale}</DialogTitle>
                <DialogDescription className="truncate text-[12.5px]">
                  {societe.theme} · {societe.rne ? `RNE ${societe.rne}` : "RNE non renseigné"}
                </DialogDescription>
              </div>
              {(() => {
                const { icone: Icone, libelle, classe } = STATUT_PASTILLE[societe.statut];
                return (
                  <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-bold", classe)}>
                    <Icone className="size-3.5" aria-hidden="true" />
                    {libelle}
                  </span>
                );
              })()}
            </DialogHeader>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-[18px] py-3.5">
              <Rubrique icone={FileText} titre="Identité">
                <div className="grid gap-x-6 sm:grid-cols-2">
                  <Ligne icone={FileText} libelle="RNE">{societe.rne || "—"}</Ligne>
                  <Ligne icone={FileText} libelle="N° TVA">{societe.tva || "—"}</Ligne>
                  <Ligne icone={CalendarDays} libelle="Créée le">{formatDate(societe.creeLe)}</Ligne>
                </div>
              </Rubrique>

              <Rubrique icone={Phone} titre="Coordonnées">
                <Ligne icone={Phone} libelle="Téléphone">
                  {societe.telephone ? <a className="hover:underline" href={`tel:${societe.telephone}`}>{societe.telephone}</a> : "—"}
                </Ligne>
                <Ligne icone={Mail} libelle="Email">
                  {societe.email ? <a className="hover:underline" href={`mailto:${societe.email}`}>{societe.email}</a> : "—"}
                </Ligne>
                <Ligne icone={MapPin} libelle="Adresse">{societe.adresse || "—"}</Ligne>
              </Rubrique>

              {gereContacts && <SocieteEmployesSection societeId={societe.id} peutSupprimer={isAdmin} />}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-muted/40 px-[18px] py-3">
              {gereContacts && <span className="mr-auto text-xs text-muted-foreground">Les responsables donnent les tâches aux délégués.</span>}
              {canEdit && onEdit && (
                <Button type="button" variant="outline" className="gap-2" onClick={() => onEdit(societe)}>
                  <Pencil className="size-4" aria-hidden="true" />
                  Modifier la société
                </Button>
              )}
              {onOpenDossiers && (
                <Button type="button" variant="outline" className="gap-2 border-accent bg-accent/15 hover:bg-accent/30" onClick={() => onOpenDossiers(societe)}>
                  <FolderOpen className="size-4" aria-hidden="true" />
                  Mes dossiers
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useEffect } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  FolderOpen,
  Mail,
  MapPin,
  Pencil,
  PauseCircle,
  Phone,
  Rocket,
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
import { useCollectes } from "@/store/collectes";
import type { Societe, Statut } from "@/types";
import { AccesCreeVue, CompteFormVue, SocieteEmployesSection, useComptesSociete, type ComptesSociete } from "./SocieteEmployesSection";

const STATUT_PASTILLE: Record<Statut, { icone: typeof CheckCircle2; libelle: string; classe: string }> = {
  actif: { icone: CheckCircle2, libelle: "Actif", classe: "bg-[#DDF0E5] text-[#1D5D41]" },
  en_attente: { icone: Clock, libelle: "En attente", classe: "bg-[#FBEBC4] text-[#8A5A0B]" },
  inactif: { icone: PauseCircle, libelle: "Inactif", classe: "bg-white/15 text-white" },
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
        <Icone className="size-4 text-muted-foreground" aria-hidden="true" />
        {titre}
      </h3>
      {children}
    </section>
  );
}

function Ligne({ icone: Icone, libelle, children, action }: { icone: typeof FileText; libelle: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 border-b border-dashed border-border py-2 text-[13px] max-sm:py-2.5">
      <Icone className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="shrink-0 text-muted-foreground">{libelle}</span>
      <span className="ml-auto min-w-0 truncate text-right font-bold text-primary">{children}</span>
      {action}
    </div>
  );
}

/** Bouton rond d'appel ou d'e-mail, réservé au téléphone (cible de 40 px). */
function Rond({ href, libelle, children }: { href: string; libelle: string; children: React.ReactNode }) {
  return (
    <a href={href} aria-label={libelle} className="hidden size-10 shrink-0 place-items-center rounded-full border border-border text-primary max-sm:grid">
      {children}
    </a>
  );
}

interface Etape {
  cle: string;
  titre: string;
  aide: string;
  fait: boolean;
  action?: { libelle: string; onClick: () => void };
}

/** Cadre « Pour démarrer » d'une société neuve : ce qu'il reste à faire, avec un raccourci pour chaque étape. */
function PourDemarrer({ etapes }: { etapes: Etape[] }) {
  const faites = etapes.filter((e) => e.fait).length;
  return (
    <section aria-label="Pour démarrer" className="overflow-hidden rounded-xl border border-border">
      <header className="flex items-center gap-2.5 border-b border-border bg-[#FBF7EE] px-3.5 py-2.5">
        <Rocket className="size-4 text-[#8A5A0B]" aria-hidden="true" />
        <h3 className="text-[13px] font-bold text-primary">Pour démarrer</h3>
        <span className="ml-auto text-xs font-bold text-[#8A5A0B]">{faites} sur {etapes.length}</span>
      </header>
      <div className="mx-3.5 mt-2.5 h-[5px] overflow-hidden rounded-full bg-[#E4EAF2]" aria-hidden="true">
        <i className="block h-full bg-accent" style={{ width: `${Math.round((faites / etapes.length) * 100)}%` }} />
      </div>
      <ol>
        {etapes.map((e, i) => (
          <li key={e.cle} className="flex items-center gap-3 border-b border-border px-3.5 py-2.5 last:border-b-0 max-sm:py-3">
            <span className={cn("grid size-6 shrink-0 place-items-center rounded-full border-2 text-[11px] font-extrabold", e.fait ? "border-success bg-success text-white" : "border-border text-muted-foreground")}>
              {e.fait ? <Check className="size-3.5" aria-hidden="true" /> : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn("text-[13px] font-semibold", e.fait ? "text-muted-foreground" : "text-primary")}>{e.titre}</p>
              {!e.fait && <p className="text-[11.5px] text-muted-foreground">{e.aide}</p>}
            </div>
            {!e.fait && e.action && (
              <button
                type="button"
                onClick={e.action.onClick}
                className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[12.5px] font-bold text-[#1F5AA6] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:min-h-10"
              >
                {e.action.libelle}
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </button>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function SocieteViewSheet({
  open,
  onOpenChange,
  societe,
  onEdit,
  onOpenDossiers,
  onCreerCollecte,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  societe: Societe | null;
  onEdit?: (societe: Societe) => void;
  onOpenDossiers?: (societe: Societe) => void;
  /** Ouvre la création d'une collecte pour cette société (étape « Pour démarrer »). */
  onCreerCollecte?: (societe: Societe) => void;
}) {
  const { isAdmin, canManageCollaborateurs } = usePermissions();
  const gereContacts = isAdmin || canManageCollaborateurs;
  const comptes = useComptesSociete(societe?.id ?? "");
  const { reinitialiser } = comptes;
  // À la fermeture, ou quand on change de société, la carte repart de la fiche.
  useEffect(() => {
    if (!open) reinitialiser();
  }, [open, societe?.id, reinitialiser]);
  // La croix se lit sur le bandeau marine de la fiche ; sur les autres vues l'en-tête est clair.
  const surBandeau = !(gereContacts && comptes.vue !== "fiche");

  return (
    <Dialog open={open} onOpenChange={(ouvert) => { if (!ouvert && comptes.busy) return; onOpenChange(ouvert); }}>
      <DialogContent
        // Pleine page sur téléphone ; carte centrée ailleurs.
        className={cn(
          "flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-1.5rem)] max-w-[540px] flex-col gap-0 overflow-hidden rounded-lg p-0 max-sm:left-0 max-sm:top-0 max-sm:h-[100dvh] max-sm:max-h-none max-sm:w-screen max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none [&>button.absolute]:z-10",
          surBandeau && "[&>button.absolute]:text-white [&>button.absolute]:opacity-90",
        )}
      >
        {societe && <Contenu societe={societe} comptes={comptes} onEdit={onEdit} onOpenDossiers={onOpenDossiers} onCreerCollecte={onCreerCollecte} />}
      </DialogContent>
    </Dialog>
  );
}

function Contenu({
  societe,
  comptes,
  onEdit,
  onOpenDossiers,
  onCreerCollecte,
}: {
  societe: Societe;
  comptes: ComptesSociete;
  onEdit?: (societe: Societe) => void;
  onOpenDossiers?: (societe: Societe) => void;
  onCreerCollecte?: (societe: Societe) => void;
}) {
  const { isAdmin, can, canManageCollaborateurs, isCollaborateur } = usePermissions();
  // Les comptes de la société (responsable, délégués) : l'administrateur et le responsable des collaborateurs les gèrent.
  const gereContacts = isAdmin || canManageCollaborateurs;
  const canEdit = isAdmin || can("modifierSocietes");
  const peutCreerCollecte = Boolean(isAdmin || isCollaborateur) && Boolean(onCreerCollecte);
  const aDesCollectes = useCollectes((s) => s.list.some((c) => c.societeId === societe.id));

  // La carte change de vue sur place : fiche, nouveau compte, accès créé.
  if (gereContacts && comptes.vue === "compte") return <CompteFormVue comptes={comptes} />;
  if (gereContacts && comptes.vue === "acces") return <AccesCreeVue comptes={comptes} />;

  const etapes: Etape[] = [
    { cle: "creee", titre: "Société créée", aide: "", fait: true },
    ...(gereContacts
      ? [{
          cle: "responsable",
          titre: "Ajouter le responsable",
          aide: "Il reçoit un lien d'accès et gère ses délégués",
          fait: comptes.employes.some((e) => !e.delegue),
          action: { libelle: "Ajouter", onClick: comptes.openAdd },
        }]
      : []),
    ...(peutCreerCollecte
      ? [{
          cle: "collecte",
          titre: "Créer la première collecte",
          aide: "Demandez les pièces du mois à la société",
          fait: aDesCollectes,
          action: { libelle: "Créer", onClick: () => onCreerCollecte?.(societe) },
        }]
      : []),
  ];
  // Le cadre n'apparaît que s'il reste quelque chose à faire (et seulement pour les étapes que la personne peut accomplir).
  const demarrage = etapes.length > 1 && etapes.some((e) => !e.fait);
  const { icone: IconeStatut, libelle: libelleStatut, classe: classeStatut } = STATUT_PASTILLE[societe.statut];

  return (
    <>
      <DialogHeader className="flex-row items-center gap-3.5 space-y-0 bg-gradient-to-br from-primary to-[#123566] px-[18px] py-[18px] pr-14 text-primary-foreground">
        <span className="grid size-[52px] shrink-0 place-items-center rounded-xl bg-accent text-[16px] font-extrabold text-primary" aria-hidden="true">
          {initiales(societe.raisonSociale)}
        </span>
        <div className="min-w-0 flex-1">
          <DialogTitle className="truncate font-serif text-[22px] font-semibold leading-tight text-white">{societe.raisonSociale}</DialogTitle>
          <DialogDescription className="truncate text-[12.5px] text-[#b9cbe3]">
            {societe.theme} · {societe.rne ? `RNE ${societe.rne}` : "RNE non renseigné"}
          </DialogDescription>
        </div>
        <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-bold", classeStatut)}>
          <IconeStatut className="size-3.5" aria-hidden="true" />
          {libelleStatut}
        </span>
      </DialogHeader>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-[18px] py-3.5">
        {demarrage && <PourDemarrer etapes={etapes} />}

        <Rubrique icone={FileText} titre="Identité">
          <div className="grid gap-x-6 sm:grid-cols-2">
            <Ligne icone={FileText} libelle="RNE">{societe.rne || "—"}</Ligne>
            <Ligne icone={FileText} libelle="N° TVA">{societe.tva || "—"}</Ligne>
            <Ligne icone={CalendarDays} libelle="Créée le">{formatDate(societe.creeLe)}</Ligne>
          </div>
        </Rubrique>

        <Rubrique icone={Phone} titre="Coordonnées">
          <Ligne
            icone={Phone}
            libelle="Téléphone"
            action={societe.telephone ? <Rond href={`tel:${societe.telephone}`} libelle={`Appeler ${societe.telephone}`}><Phone className="size-4" aria-hidden="true" /></Rond> : undefined}
          >
            {societe.telephone ? <a className="hover:underline" href={`tel:${societe.telephone}`}>{societe.telephone}</a> : "—"}
          </Ligne>
          <Ligne
            icone={Mail}
            libelle="Email"
            action={societe.email ? <Rond href={`mailto:${societe.email}`} libelle={`Écrire à ${societe.email}`}><Mail className="size-4" aria-hidden="true" /></Rond> : undefined}
          >
            {societe.email ? <a className="hover:underline" href={`mailto:${societe.email}`}>{societe.email}</a> : "—"}
          </Ligne>
          <Ligne icone={MapPin} libelle="Adresse">{societe.adresse || "—"}</Ligne>
        </Rubrique>

        {gereContacts && <SocieteEmployesSection comptes={comptes} peutSupprimer={isAdmin} videMasque={demarrage} />}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-muted/40 px-[18px] py-3 max-sm:flex-col-reverse max-sm:items-stretch [&>button]:max-sm:h-12">
        {canEdit && onEdit && (
          <Button type="button" variant="outline" className="gap-2" onClick={() => onEdit(societe)}>
            <Pencil className="size-4" aria-hidden="true" />
            Modifier la société
          </Button>
        )}
        {onOpenDossiers && (
          <Button type="button" className="gap-2" onClick={() => onOpenDossiers(societe)}>
            <FolderOpen className="size-4" aria-hidden="true" />
            Mes dossiers
          </Button>
        )}
      </div>
    </>
  );
}

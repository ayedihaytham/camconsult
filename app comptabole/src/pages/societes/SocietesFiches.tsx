import { FolderOpen, Pencil } from "lucide-react";
import { LedgerRowMenu } from "@/components/ledger/LedgerRowMenu";
import { StatutDot } from "@/components/ledger/StatusDot";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { RowAction } from "@/components/common/RowActions";
import { cn, formatDate } from "@/lib/utils";
import { COLLECTE_STATUT_LABELS } from "@/lib/collecte/tabs";
import type { Collecte, Employe, Societe } from "@/types";
import { SocieteEmployesSection } from "./SocieteEmployesSection";

export interface SocieteIndicateurs {
  /** Tâches non terminées ; `null` quand le profil ne voit pas les tâches. */
  taches: number | null;
  /** Collectes ouvertes (ni validées ni archivées) ; `null` quand le profil ne voit pas les collectes. */
  collectes: number | null;
  /** Tableaux transmis par le client qui attendent l'examen du cabinet. */
  aExaminer: number;
  dossiers: number;
  contacts: number;
}

interface Props {
  societes: Societe[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  indicateurs: ReadonlyMap<string, SocieteIndicateurs>;
  collectes: Collecte[];
  employes: Employe[];
  isAdmin: boolean;
  canEdit: boolean;
  isLoading: boolean;
  emptyMessage: string;
  menuActions: (societe: Societe) => RowAction[];
  onEdit: (societe: Societe) => void;
  onOpenDossiers: (societe: Societe) => void;
  onOpenCollecte: (collecte: Collecte) => void;
}

function initiales(nom: string) {
  const ordre = nom.trim().match(/^\d{1,3}/);
  if (ordre) return ordre[0];
  const mots = nom.trim().split(/\s+/).filter(Boolean);
  return mots.length > 1 ? `${mots[0][0]}${mots[1][0]}`.toUpperCase() : nom.slice(0, 2).toUpperCase();
}

function Chiffre({ valeur, libelle }: { valeur: number | null; libelle: string }) {
  return (
    <div className="rounded-sm border border-border bg-muted/40 px-3 py-2.5">
      <p className={cn("text-xl font-bold leading-tight tabular-nums text-primary", !valeur && "text-muted-foreground/50")}>{valeur ?? "—"}</p>
      <p className="text-xs text-muted-foreground">{libelle}</p>
    </div>
  );
}

function Rubrique({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-sm border border-border p-3">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">{titre}</h3>
      {children}
    </section>
  );
}

function Ligne({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-dashed border-border py-1.5 text-[13px] last:border-b-0">
      <span className="text-muted-foreground">{libelle}</span>
      <span className="min-w-0 truncate text-right font-semibold text-primary">{children}</span>
    </div>
  );
}

/** Registre en deux volets : la liste compacte des sociétés à gauche, la fiche de la société choisie à droite. */
export function SocietesFiches({
  societes,
  selectedId,
  onSelect,
  indicateurs,
  collectes,
  employes,
  isAdmin,
  canEdit,
  isLoading,
  emptyMessage,
  menuActions,
  onEdit,
  onOpenDossiers,
  onOpenCollecte,
}: Props) {
  if (isLoading) {
    return (
      <div className="hidden gap-3 p-4 lg:grid lg:grid-cols-[320px_1fr]">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    );
  }
  if (societes.length === 0) {
    return <p className="hidden px-4 py-12 text-center text-sm text-muted-foreground lg:block">{emptyMessage}</p>;
  }

  const societe = societes.find((s) => s.id === selectedId) ?? societes[0];
  const chiffres = indicateurs.get(societe.id);
  const contacts = employes.filter((e) => e.role === "societe_employe" && e.societeId === societe.id);
  const ouvertes = collectes.filter((c) => c.societeId === societe.id && c.statut !== "valide" && c.statut !== "archive");

  return (
    <div className="hidden min-h-[430px] grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:grid">
      <ul className="max-h-[70vh] divide-y divide-border overflow-y-auto border-r border-border bg-muted/40" aria-label="Sociétés">
        {societes.map((s) => {
          const actif = s.id === societe.id;
          const aExaminer = indicateurs.get(s.id)?.aExaminer ?? 0;
          return (
            <li key={s.id}>
              <button
                type="button"
                aria-current={actif ? "true" : undefined}
                onClick={() => onSelect(s.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  actif && "bg-accent/15 shadow-[inset_3px_0_0_hsl(var(--accent))]",
                )}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-[7px] bg-accent/20 text-[13px] font-extrabold text-primary" aria-hidden="true">{initiales(s.raisonSociale)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold text-primary">{s.raisonSociale}</span>
                  <span className="block truncate text-xs text-muted-foreground">{s.theme} · {s.statut === "actif" ? "Actif" : s.statut === "en_attente" ? "En attente" : "Inactif"}</span>
                </span>
                {aExaminer > 0 && (
                  <span className="rounded-full bg-destructive px-1.5 text-[11px] font-extrabold text-destructive-foreground" title={`${aExaminer} tableau${aExaminer > 1 ? "x" : ""} à examiner`}>
                    {aExaminer}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="min-w-0 space-y-3.5 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-accent/20 text-[15px] font-extrabold text-primary" aria-hidden="true">{initiales(societe.raisonSociale)}</span>
          <div className="min-w-0">
            <h2 className="truncate font-serif text-xl font-medium text-primary">{societe.raisonSociale}</h2>
            <p className="truncate text-xs text-muted-foreground">
              {societe.theme} · {societe.rne ? `RNE ${societe.rne}` : "RNE non renseigné"} · <span className="font-mono">{societe.code}</span>
            </p>
          </div>
          <StatutDot statut={societe.statut} pill />
          <span className="flex-1" />
          {canEdit && (
            <Button type="button" variant="outline" size="sm" onClick={() => onEdit(societe)}>
              <Pencil className="size-3.5" />
              Modifier
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" className="border-accent bg-accent/15 hover:bg-accent/30" onClick={() => onOpenDossiers(societe)}>
            <FolderOpen className="size-3.5" />
            Mes dossiers
          </Button>
          <LedgerRowMenu actions={menuActions(societe)} />
        </div>

        <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
          {chiffres?.taches !== null && <Chiffre valeur={chiffres?.taches ?? 0} libelle="Tâches en cours" />}
          {chiffres?.collectes !== null && <Chiffre valeur={chiffres?.collectes ?? 0} libelle="Collectes ouvertes" />}
          <Chiffre valeur={chiffres?.dossiers ?? 0} libelle="Dossiers" />
          <Chiffre valeur={contacts.length} libelle={contacts.length > 1 ? "Contacts" : "Contact"} />
        </div>

        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          <Rubrique titre="Contacts">
            {isAdmin ? (
              <SocieteEmployesSection societeId={societe.id} />
            ) : contacts.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">Aucun contact enregistré.</p>
            ) : (
              contacts.map((c) => (
                <Ligne key={c.id} libelle={c.delegue ? "Délégué" : "Responsable"}>{c.prenom} {c.nom}</Ligne>
              ))
            )}
          </Rubrique>

          <Rubrique titre="Coordonnées">
            <Ligne libelle="Téléphone">{societe.telephone ? <a className="hover:underline" href={`tel:${societe.telephone}`}>{societe.telephone}</a> : "—"}</Ligne>
            <Ligne libelle="Email">{societe.email ? <a className="hover:underline" href={`mailto:${societe.email}`}>{societe.email}</a> : "—"}</Ligne>
            <Ligne libelle="N° TVA">{societe.tva || "—"}</Ligne>
            <Ligne libelle="Adresse">{societe.adresse || "—"}</Ligne>
            <Ligne libelle="Créée le">{formatDate(societe.creeLe)}</Ligne>
          </Rubrique>

          {chiffres?.collectes !== null && (
            <Rubrique titre="Collectes en cours">
              {ouvertes.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">Aucune collecte ouverte.</p>
              ) : (
                ouvertes.slice(0, 4).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onOpenCollecte(c)}
                    className="flex w-full items-center justify-between gap-3 border-b border-dashed border-border py-1.5 text-left text-[13px] last:border-b-0 hover:text-primary"
                  >
                    <span className="min-w-0 truncate font-semibold text-primary">{c.periode.trim() || "Sans période"}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{COLLECTE_STATUT_LABELS[c.statut]}</span>
                  </button>
                ))
              )}
            </Rubrique>
          )}
        </div>
      </div>
    </div>
  );
}

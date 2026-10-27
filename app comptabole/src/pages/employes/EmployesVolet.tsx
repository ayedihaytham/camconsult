import { useMemo, useRef, useState, type ComponentProps, type KeyboardEvent } from "react";
import { Eye, ShieldCheck } from "lucide-react";
import { LedgerRowMenu } from "@/components/ledger/LedgerRowMenu";
import { StatutIcone } from "@/components/ledger/StatutIcone";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { employeNomComplet } from "@/data/employes";
import { cn, initials } from "@/lib/utils";
import type { Employe, Statut } from "@/types";
import { assignmentPreview } from "./teamLedger";

const POINT_STATUT: Record<Statut, string> = { actif: "bg-success", en_attente: "border-2 border-warning bg-card", inactif: "bg-muted-foreground/50" };
const LIBELLE_STATUT: Record<Statut, string> = { actif: "Actif", en_attente: "En attente", inactif: "Inactif" };

interface EmployesVoletProps {
  employes: Employe[];
  loading: boolean;
  emptyMessage: string;
  societyNames: Map<string, string>;
  openTaskCounts: Map<string, number>;
  droitsTotal: number;
  droitsActifs: (employe: Employe) => number;
  onOpenFiche: (employe: Employe) => void;
  onOpenAcces: (employe: Employe) => void;
  menuActions: (employe: Employe) => ComponentProps<typeof LedgerRowMenu>["actions"];
}

/** Présentation « liste et volet » du registre : l'équipe à gauche, le détail du collaborateur choisi à droite. Ne porte aucune règle métier : tout vient de la page. */
export function EmployesVolet({ employes, loading, emptyMessage, societyNames, openTaskCounts, droitsTotal, droitsActifs, onOpenFiche, onOpenAcces, menuActions }: EmployesVoletProps) {
  const tries = useMemo(() => [...employes].sort((a, b) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, "fr")), [employes]);
  const [choisi, setChoisi] = useState<string | null>(null);
  const listeRef = useRef<HTMLUListElement>(null);
  const courant = tries.find((employe) => employe.id === choisi) ?? tries[0];

  if (loading) {
    return <div className="grid gap-3 p-3 lg:grid-cols-[320px_minmax(0,1fr)]" role="status" aria-label="Chargement des collaborateurs"><Skeleton className="h-64" /><Skeleton className="h-64" /></div>;
  }
  if (!courant) return <p className="px-4 py-10 text-sm text-muted-foreground">{emptyMessage}</p>;

  function naviguer(event: KeyboardEvent<HTMLUListElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const index = tries.findIndex((employe) => employe.id === courant.id);
    const suivant = tries[Math.min(tries.length - 1, Math.max(0, index + (event.key === "ArrowDown" ? 1 : -1)))];
    setChoisi(suivant.id);
    requestAnimationFrame(() => listeRef.current?.querySelector<HTMLElement>(`[data-employe="${suivant.id}"]`)?.focus());
  }

  const nombreSocietes = courant.societesAssignees.length;
  const taches = openTaskCounts.get(courant.id) ?? 0;
  const bloc = "grid content-start gap-1.5 rounded-[10px] border border-border/70 bg-muted/30 px-4 py-3.5";
  const etiquette = "text-[10.5px] font-bold uppercase tracking-[0.1em] text-muted-foreground";
  const monogramme = (employe: Employe) => initials(employeNomComplet(employe));

  return (
    <div className="grid items-start gap-3 p-3 lg:grid-cols-[320px_minmax(0,1fr)]">
      <ul ref={listeRef} onKeyDown={naviguer} aria-label="Collaborateurs" className="flex max-h-[calc(100vh-18rem)] min-h-[20rem] flex-col gap-1 overflow-y-auto rounded-xl border border-border bg-card p-2">
        {tries.map((employe) => {
          const actif = employe.id === courant.id;
          const nbTaches = openTaskCounts.get(employe.id) ?? 0;
          return (
            <li key={employe.id}>
              <button
                type="button"
                data-employe={employe.id}
                aria-current={actif ? "true" : undefined}
                onClick={() => setChoisi(employe.id)}
                className={cn("grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[9px] px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", actif ? "bg-primary text-primary-foreground" : "hover:bg-muted/60")}
              >
                <span aria-hidden className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg border text-[10px] font-bold tracking-wide", actif ? "border-white/30 bg-white/15 text-accent" : "border-primary/15 bg-primary/[0.07] text-primary")}>{monogramme(employe)}</span>
                <span className="min-w-0">
                  <span className={cn("block truncate text-[13px] font-semibold", actif ? "text-primary-foreground" : "text-primary")}>{employeNomComplet(employe)}</span>
                  <span className={cn("block truncate text-[11.5px]", actif ? "text-primary-foreground/75" : "text-muted-foreground")}>{employe.type} · {nbTaches} tâche{nbTaches > 1 ? "s" : ""} ouverte{nbTaches > 1 ? "s" : ""}</span>
                </span>
                <span className={cn("size-2.5 rounded-full", POINT_STATUT[employe.statut])} title={LIBELLE_STATUT[employe.statut]} />
              </button>
            </li>
          );
        })}
      </ul>

      <section aria-live="polite" aria-label={`Détail de ${employeNomComplet(courant)}`} className="min-w-0 rounded-xl border border-border bg-card p-5">
        <header className="flex items-center gap-4 border-b border-border/70 pb-4">
          <span aria-hidden className="flex size-[52px] shrink-0 items-center justify-center rounded-[13px] border border-primary/15 bg-primary/[0.07] text-[15px] font-bold text-primary">{monogramme(courant)}</span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold text-primary">{employeNomComplet(courant)}</h2>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{courant.type} · {courant.email || "Email non renseigné"}</p>
            {courant.doitChangerMotDePasse && <span className="mt-1 inline-block rounded-full bg-warning/12 px-2 py-0.5 text-[10px] font-semibold text-warning">Doit changer son mot de passe</span>}
          </div>
          <StatutIcone statut={courant.statut} />
          <LedgerRowMenu actions={menuActions(courant).filter((action) => action.label !== "Voir la fiche" && action.label !== "Accès")} />
        </header>

        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className={bloc}>
            <dt className={etiquette}>Périmètre</dt>
            <dd>
              <p className="text-sm font-semibold text-foreground">{nombreSocietes} société{nombreSocietes === 1 ? "" : "s"}</p>
              <p className="text-xs text-muted-foreground">{assignmentPreview(courant, societyNames)}</p>
            </dd>
          </div>
          <div className={bloc}>
            <dt className={etiquette}>Accès</dt>
            <dd>
              <p className="text-sm font-semibold text-foreground"><span className="tabular-nums">{droitsActifs(courant)}/{droitsTotal}</span> droits actifs</p>
              <p className="text-xs text-muted-foreground">Identifiant : {courant.identifiant}</p>
            </dd>
          </div>
          <div className={bloc}>
            <dt className={etiquette}>Tâches ouvertes</dt>
            <dd className={cn("text-[28px] font-bold leading-none tabular-nums", taches === 0 ? "text-muted-foreground/50" : "text-primary")}>{taches}</dd>
          </div>
          <div className={bloc}>
            <dt className={etiquette}>Statut</dt>
            <dd className="text-sm font-semibold text-foreground">{LIBELLE_STATUT[courant.statut]}</dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button type="button" className="gap-2" onClick={() => onOpenFiche(courant)}>
            <Eye className="size-4" aria-hidden="true" />Ouvrir la fiche
          </Button>
          <Button type="button" variant="outline" className="gap-2" onClick={() => onOpenAcces(courant)}>
            <ShieldCheck className="size-4" aria-hidden="true" />Gérer les accès
          </Button>
        </div>
      </section>
    </div>
  );
}

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ChevronDown, MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isOverdueCollection } from "@/lib/dashboard/dashboardData";
import { resumeTableaux } from "@/lib/collecte/periodes";
import type { Collecte, CollecteStatut } from "@/types";
import { cn, formatRelative, initials } from "@/lib/utils";

const STATUT: Record<CollecteStatut, { label: string; tone: string }> = {
  brouillon: { label: "Chez le client", tone: "bg-muted text-muted-foreground" },
  transmis: { label: "Transmis", tone: "bg-primary/10 text-primary" },
  a_corriger: { label: "À corriger", tone: "bg-warning/15 text-warning" },
  valide: { label: "Validée", tone: "bg-success/15 text-success" },
  archive: { label: "Archivée", tone: "bg-muted text-muted-foreground" },
};

const aExaminer = (c: Collecte) => (c.statut === "archive" ? 0 : c.tableauxTransmis ?? 0);
const avancement = (c: Collecte) => {
  const n = c.onglets?.length ?? 0;
  return n > 0 ? Math.min(100, Math.round((((c.tableauxTransmis ?? 0) + (c.tableauxValides ?? 0)) / n) * 100)) : 0;
};
function action(c: Collecte): string {
  if (aExaminer(c) > 0 || c.statut === "a_corriger" || c.statut === "transmis") return "Examiner";
  if (c.statut === "brouillon") return "Ouvrir";
  return "Consulter";
}
/** Titre d'une collecte : sa période, sinon ce qu'elle demande ; jamais une date de création répétée. */
export function titreCollecte(c: Collecte): string {
  return c.periode.trim() || "Sans période";
}

interface Groupe {
  societeId: string;
  nom: string;
  collectes: Collecte[];
  aExaminer: number;
}

/** Registre des collectes du cabinet : une ligne par société, ses collectes dépliables avec leur période et les tableaux demandés. */
export function CollectesRegistre({ collectes, socNom, onDelete }: {
  collectes: Collecte[];
  socNom: (societeId: string) => string;
  /** Suppression, réservée à l'admin : sans cette fonction, le menu d'actions n'existe pas. */
  onDelete?: (collecte: Collecte) => void;
}) {
  const navigate = useNavigate();
  const now = useMemo(() => new Date(), []);

  const groupes = useMemo<Groupe[]>(() => {
    const parSociete = new Map<string, Collecte[]>();
    for (const c of collectes) parSociete.set(c.societeId, [...(parSociete.get(c.societeId) ?? []), c]);
    return [...parSociete.entries()]
      .map(([societeId, liste]) => ({
        societeId,
        nom: socNom(societeId),
        collectes: [...liste].sort((a, b) => b.majLe.localeCompare(a.majLe)),
        aExaminer: liste.reduce((total, c) => total + aExaminer(c), 0),
      }))
      // Les sociétés qui ont du travail à examiner d'abord, puis l'ordre alphabétique.
      .sort((a, b) => Number(b.aExaminer > 0) - Number(a.aExaminer > 0) || a.nom.localeCompare(b.nom, "fr"));
  }, [collectes, socNom]);

  // Ouvertes au départ : les sociétés avec du travail à examiner, ou la seule société affichée.
  const [ouverts, setOuverts] = useState<Set<string>>(
    () => new Set(groupes.filter((g) => g.aExaminer > 0 || groupes.length === 1).map((g) => g.societeId)),
  );
  const toutOuvert = groupes.length > 0 && groupes.every((g) => ouverts.has(g.societeId));
  const basculer = (id: string) =>
    setOuverts((courant) => {
      const suivant = new Set(courant);
      if (suivant.has(id)) suivant.delete(id);
      else suivant.add(id);
      return suivant;
    });

  return (
    <div>
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
        <span className="text-xs tabular-nums text-muted-foreground">{groupes.length} société{groupes.length > 1 ? "s" : ""} · {collectes.length} collecte{collectes.length > 1 ? "s" : ""}</span>
        <Button type="button" variant="outline" size="sm" className="min-h-9" onClick={() => setOuverts(toutOuvert ? new Set() : new Set(groupes.map((g) => g.societeId)))}>
          {toutOuvert ? "Tout replier" : "Tout déplier"}
        </Button>
      </div>
      <ul>
        {groupes.map((g) => {
          const ouvert = ouverts.has(g.societeId);
          const panneau = `collectes-${g.societeId}`;
          return (
            <li key={g.societeId} className="border-t border-border first:border-t-0">
              <button
                type="button"
                aria-expanded={ouvert}
                aria-controls={panneau}
                onClick={() => basculer(g.societeId)}
                className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none", !ouvert && "-rotate-90")} aria-hidden="true" />
                <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-md border border-border bg-secondary/60 text-[11px] font-extrabold text-primary">{initials(g.nom)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{g.nom}</span>
                  <span className="block truncate text-xs text-muted-foreground">{g.collectes.length} collecte{g.collectes.length > 1 ? "s" : ""} · dernière {titreCollecte(g.collectes[0])}</span>
                </span>
                <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold", g.aExaminer > 0 ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground")}>
                  {g.aExaminer > 0 ? `${g.aExaminer} à examiner` : "Rien à examiner"}
                </span>
              </button>
              {ouvert && (
                <ul id={panneau} className="border-t border-border bg-muted/30">
                  {g.collectes.map((c) => {
                    const st = STATUT[c.statut];
                    const retard = isOverdueCollection(c, now);
                    const av = avancement(c);
                    const tableaux = resumeTableaux(c.onglets ?? []);
                    return (
                      <li key={c.id} className="grid min-w-0 items-center gap-x-4 gap-y-2 border-t border-border px-4 py-3 first:border-t-0 md:grid-cols-[minmax(0,1fr)_11rem_9rem_auto] md:pl-[4.25rem]">
                        <div className="min-w-0">
                          <button type="button" onClick={() => navigate(`/collectes/${c.id}`)} className="block max-w-full truncate text-left text-sm font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            {titreCollecte(c)}
                          </button>
                          {tableaux.length > 0 && (
                            <ul className="mt-1.5 flex flex-wrap gap-1" aria-label="Tableaux demandés">
                              {tableaux.map((nom) => <li key={nom} className="rounded border border-border bg-card px-1.5 py-px text-[11.5px] text-muted-foreground">{nom}</li>)}
                            </ul>
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className={cn("inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", st.tone)}>{st.label}{aExaminer(c) > 0 ? ` · ${aExaminer(c)} à examiner` : ""}</span>
                          {retard && <p className="mt-1 text-xs font-semibold text-destructive">Échéance dépassée</p>}
                        </div>
                        <div className="min-w-0 text-xs text-muted-foreground" role="img" aria-label={`Avancement ${av} %`}>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${av}%` }} /></div>
                            <span className="tabular-nums">{(c.tableauxTransmis ?? 0) + (c.tableauxValides ?? 0)}/{c.onglets?.length ?? 0}</span>
                          </div>
                          <p className="mt-0.5">{formatRelative(c.majLe)}</p>
                        </div>
                        <div className="flex items-center justify-end gap-1">
                          <Button type="button" variant="ghost" size="sm" className="min-h-9 gap-1 font-semibold text-primary" onClick={() => navigate(`/collectes/${c.id}`)} aria-label={`${action(c)} la collecte ${g.nom} — ${titreCollecte(c)}`}>
                            {action(c)}<ArrowRight className="size-3.5" aria-hidden="true" />
                          </Button>
                          {onDelete && <ActionsMenu collecte={c} nom={g.nom} onOpen={() => navigate(`/collectes/${c.id}`)} onDelete={onDelete} />}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ActionsMenu({ collecte, nom, onOpen, onDelete }: { collecte: Collecte; nom: string; onOpen: () => void; onDelete: (c: Collecte) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" className="size-10 lg:size-8" aria-label={`Actions pour ${nom}, ${titreCollecte(collecte)}`}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onOpen}><ArrowRight /> Ouvrir la collecte</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => onDelete(collecte)}><Trash2 /> Supprimer…</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

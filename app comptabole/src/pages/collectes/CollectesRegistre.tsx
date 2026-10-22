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
import { libelleEcheance } from "@/lib/collecte/echeance";
import type { Collecte, CollecteStatut } from "@/types";
import { cn, formatDate, formatRelative, initials } from "@/lib/utils";

const STATUT: Record<CollecteStatut, { label: string; tone: string; point: string }> = {
  brouillon: { label: "Chez le client", tone: "bg-chart-2/10 text-chart-2", point: "bg-chart-2" },
  transmis: { label: "Transmis", tone: "bg-primary/10 text-primary", point: "bg-primary" },
  a_corriger: { label: "À corriger", tone: "bg-warning/15 text-warning", point: "bg-warning" },
  valide: { label: "Validée", tone: "bg-success/15 text-success", point: "bg-success" },
  archive: { label: "Archivée", tone: "bg-muted text-muted-foreground", point: "bg-muted-foreground" },
};

/** Colonnes communes à l'en-tête et aux lignes (grand écran) : période, statut, avancement, échéance, activité, actions. */
const GRILLE = "lg:grid-cols-[minmax(0,2.3fr)_minmax(10.5rem,1.2fr)_minmax(9.5rem,1.1fr)_6.5rem_6.5rem_7.5rem]";

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
  enRetard: number;
}

/** Rang de chaque collecte parmi celles de la même société qui portent le même titre (par date de création) : « collecte 1 », « collecte 2 ». */
function rangsHomonymes(collectes: Collecte[]): Map<string, number> {
  const rangs = new Map<string, number>();
  const parTitre = new Map<string, Collecte[]>();
  for (const c of collectes) parTitre.set(titreCollecte(c), [...(parTitre.get(titreCollecte(c)) ?? []), c]);
  for (const liste of parTitre.values()) {
    if (liste.length < 2) continue;
    [...liste].sort((a, b) => a.creeLe.localeCompare(b.creeLe)).forEach((c, i) => rangs.set(c.id, i + 1));
  }
  return rangs;
}

/** Registre des collectes du cabinet : une ligne par société, ses collectes dépliables avec leur période, leur statut, leur avancement, leur échéance et leur dernière activité. */
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
        enRetard: liste.filter((c) => isOverdueCollection(c, now)).length,
      }))
      // Les sociétés qui ont du travail à examiner d'abord, puis l'ordre alphabétique.
      .sort((a, b) => Number(b.aExaminer > 0) - Number(a.aExaminer > 0) || a.nom.localeCompare(b.nom, "fr"));
  }, [collectes, socNom, now]);

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
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-1.5">
        <span className="text-xs tabular-nums text-muted-foreground">{groupes.length} société{groupes.length > 1 ? "s" : ""} · {collectes.length} collecte{collectes.length > 1 ? "s" : ""}</span>
        <Button type="button" variant="outline" size="sm" className="min-h-9 lg:min-h-8" onClick={() => setOuverts(toutOuvert ? new Set() : new Set(groupes.map((g) => g.societeId)))}>
          {toutOuvert ? "Tout replier" : "Tout déplier"}
        </Button>
      </div>
      <div aria-hidden="true" className={cn("hidden border-b border-accent/25 bg-accent/[0.07] px-4 py-1.5 text-[0.62rem] font-bold uppercase tracking-[0.08em] text-muted-foreground lg:grid lg:gap-x-3", GRILLE)}>
        <span>Société / période</span>
        <span>Statut</span>
        <span>Avancement</span>
        <span>Échéance</span>
        <span>Activité</span>
        <span />
      </div>
      <ul>
        {groupes.map((g) => {
          const ouvert = ouverts.has(g.societeId);
          const panneau = `collectes-${g.societeId}`;
          const rangs = rangsHomonymes(g.collectes);
          return (
            <li key={g.societeId} className="border-t border-accent/20 first:border-t-0">
              <button
                type="button"
                aria-expanded={ouvert}
                aria-controls={panneau}
                onClick={() => basculer(g.societeId)}
                className="flex min-h-12 w-full items-center gap-2.5 px-4 py-2 text-left hover:bg-accent/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <ChevronDown className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none", !ouvert && "-rotate-90")} aria-hidden="true" />
                <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-md border border-border bg-secondary/60 text-[10px] font-extrabold text-primary">{initials(g.nom)}</span>
                <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
                  <span className="block truncate text-[13px] font-semibold text-primary">{g.nom}</span>
                  <span className="truncate text-[11.5px] text-muted-foreground">
                    {g.collectes.length} collecte{g.collectes.length > 1 ? "s" : ""}
                    {g.enRetard > 0 ? ` · ${g.enRetard} en retard` : ` · dernière ${titreCollecte(g.collectes[0])}`}
                  </span>
                </span>
                {g.enRetard > 0 && <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-px text-[11.5px] font-semibold text-destructive">Action requise</span>}
                <span className={cn("shrink-0 rounded-full px-2 py-px text-[11.5px] font-semibold", g.aExaminer > 0 ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground")}>
                  {g.aExaminer > 0 ? `${g.aExaminer} à examiner` : "Rien à examiner"}
                </span>
              </button>
              {ouvert && (
                <ul id={panneau} className="border-t border-accent/20 bg-background/60">
                  {g.collectes.map((c) => {
                    const st = STATUT[c.statut];
                    const retard = isOverdueCollection(c, now);
                    const av = avancement(c);
                    const n = c.onglets?.length ?? 0;
                    const valides = c.tableauxValides ?? 0;
                    const transmis = c.tableauxTransmis ?? 0;
                    const tableaux = resumeTableaux(c.onglets ?? [], 1);
                    const tousLesTableaux = resumeTableaux(c.onglets ?? [], 99).join(" · ");
                    const fermee = c.statut === "valide" || c.statut === "archive";
                    const echeance = fermee ? null : libelleEcheance(c.echeance, now);
                    const rang = rangs.get(c.id);
                    return (
                      <li key={c.id} className={cn("grid min-w-0 grid-cols-2 items-center gap-x-3 gap-y-1.5 border-t border-accent/20 px-4 py-2 shadow-[inset_2px_0_0_hsl(var(--accent)/0.55)] first:border-t-0 hover:bg-accent/[0.06] lg:py-1.5", GRILLE)}>
                        <div className="col-span-2 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 lg:col-span-1 lg:flex-nowrap lg:pl-9">
                          <button type="button" onClick={() => navigate(`/collectes/${c.id}`)} className="block max-w-full shrink-0 truncate text-left text-[13px] font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            {titreCollecte(c)}
                          </button>
                          {rang && <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">collecte {rang}</span>}
                          {tableaux.length > 0 && (
                            <ul className="flex min-w-0 gap-1 overflow-hidden" aria-label="Tableaux demandés" title={tousLesTableaux}>
                              {tableaux.map((nom) => <li key={nom} className="whitespace-nowrap rounded border border-border bg-card px-1.5 py-px text-[11px] text-muted-foreground">{nom}</li>)}
                            </ul>
                          )}
                        </div>
                        <div className="flex min-w-0 flex-wrap items-center gap-1">
                          <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-px text-[11.5px] font-semibold", st.tone)}>
                            <span aria-hidden="true" className={cn("size-1.5 rounded-full", st.point)} />
                            {st.label}{aExaminer(c) > 0 ? ` · ${aExaminer(c)} à examiner` : ""}
                          </span>
                          {retard && (
                            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-destructive/10 px-2 py-px text-[11.5px] font-semibold text-destructive">
                              <span aria-hidden="true" className="size-1.5 rounded-full bg-destructive" />
                              En retard
                            </span>
                          )}
                        </div>
                        <div className="flex min-w-0 items-center gap-2 text-xs" role="img" aria-label={`Avancement ${av} %`} title={`${valides} validé${valides > 1 ? "s" : ""}, ${transmis} transmis, sur ${n}`}>
                          <span className="font-semibold tabular-nums text-foreground">{transmis + valides}/{n}</span>
                          <div className="flex h-1.5 w-16 shrink-0 gap-px overflow-hidden rounded-full bg-border">
                            <div className="h-full bg-success" style={{ width: `${n > 0 ? (valides / n) * 100 : 0}%` }} />
                            <div className="h-full bg-warning" style={{ width: `${n > 0 ? (transmis / n) * 100 : 0}%` }} />
                          </div>
                        </div>
                        <div className="whitespace-nowrap text-xs tabular-nums">
                          {echeance ? <span className={cn(echeance.retard ? "font-semibold text-destructive" : "text-foreground")}>{echeance.texte}</span> : <span className="text-muted-foreground">—</span>}
                        </div>
                        <div className="whitespace-nowrap text-xs tabular-nums text-muted-foreground" title={`Créée le ${formatDate(c.creeLe)}${c.derniereRelanceLe ? ` · relancée le ${formatDate(c.derniereRelanceLe)}` : ""}`}>
                          {formatRelative(c.majLe)}
                        </div>
                        <div className="col-span-2 flex items-center justify-end gap-1 lg:col-span-1">
                          <Button type="button" variant="ghost" size="sm" className="min-h-9 gap-1 px-2 font-semibold text-primary lg:min-h-8" onClick={() => navigate(`/collectes/${c.id}`)} aria-label={`${action(c)} la collecte ${g.nom} — ${titreCollecte(c)}`}>
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

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { isOverdueCollection } from "@/lib/dashboard/dashboardData";
import { resumeTableaux } from "@/lib/collecte/periodes";
import { libelleEcheance } from "@/lib/collecte/echeance";
import type { Collecte, CollecteStatut } from "@/types";
import { cn, formatDate, formatRelative, initials } from "@/lib/utils";
import { STATUT, action, aExaminer, grouperParSociete, rangsHomonymes, titreCollecte, type Groupe } from "./CollectesRegistre";

/** Étape du circuit d'une collecte (0 = à remplir, 1 = transmise, 2 = validée) d'après son statut. */
export function etapeCircuit(statut: CollecteStatut): 0 | 1 | 2 {
  return statut === "transmis" ? 1 : statut === "valide" || statut === "archive" ? 2 : 0;
}

const ETAPES = ["À remplir", "Transmise", "Validée"] as const;

function Circuit({ statut }: { statut: CollecteStatut }) {
  const etape = etapeCircuit(statut);
  const aCorriger = statut === "a_corriger";
  return (
    <ol className="my-3 flex items-center" aria-label="Circuit de la collecte">
      {ETAPES.map((nom, i) => {
        const fait = i < etape || (i === etape && etape === 2);
        const courant = i === etape && etape < 2;
        return (
          <li key={nom} className="flex flex-1 items-center last:flex-none" aria-current={courant ? "step" : undefined}>
            <span className={cn("flex items-center gap-1.5 whitespace-nowrap text-[0.71875rem]", fait ? "font-semibold text-foreground" : courant ? (aCorriger ? "font-semibold text-warning" : "font-semibold text-warning") : "text-muted-foreground")}>
              <span aria-hidden="true" className={cn("size-[11px] rounded-full border-2", fait ? "border-primary bg-primary" : courant ? "border-warning bg-card shadow-[0_0_0_3px_hsl(var(--warning)/0.18)]" : "border-border bg-card")} />
              {courant && aCorriger && i === 0 ? "À corriger" : nom}
            </span>
            {i < ETAPES.length - 1 && <span aria-hidden="true" className={cn("mx-2 h-0.5 flex-1 rounded", i < etape ? "bg-primary" : "bg-border")} />}
          </li>
        );
      })}
    </ol>
  );
}

function CarteCollecte({ collecte, rang, now, onOuvrir, onDelete, nomSociete }: { collecte: Collecte; rang?: number; now: Date; onOuvrir: () => void; onDelete?: (c: Collecte) => void; nomSociete: string }) {
  const st = STATUT[collecte.statut];
  const retard = isOverdueCollection(collecte, now);
  const n = collecte.onglets?.length ?? 0;
  const valides = collecte.tableauxValides ?? 0;
  const transmis = collecte.tableauxTransmis ?? 0;
  const fermee = collecte.statut === "valide" || collecte.statut === "archive";
  const echeance = fermee ? null : libelleEcheance(collecte.echeance, now);
  const tableaux = resumeTableaux(collecte.onglets ?? [], 3);
  return (
    <article className={cn("mb-2.5 rounded-xl border px-4 py-3.5", retard ? "border-destructive/30 bg-gradient-to-r from-destructive/5 to-card" : "border-border bg-card")} aria-label={`Collecte ${titreCollecte(collecte)}`}>
      <div className="flex items-center justify-between gap-2.5">
        <h3 className="min-w-0 truncate text-sm font-bold text-primary">
          {titreCollecte(collecte)}
          {rang ? <span className="ml-2 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">collecte {rang}</span> : null}
        </h3>
        <span className="flex shrink-0 flex-wrap items-center justify-end gap-1">
          <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", st.tone)}>
            <span aria-hidden="true" className={cn("size-1.5 rounded-full", st.point)} />
            {st.label}{aExaminer(collecte) > 0 ? ` · ${aExaminer(collecte)} à examiner` : ""}
          </span>
          {retard && (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-destructive" />
              En retard
            </span>
          )}
        </span>
      </div>
      <Circuit statut={collecte.statut} />
      <div className="flex h-1.5 gap-px overflow-hidden rounded-full bg-border" role="img" aria-label={`${valides} tableau${valides > 1 ? "x" : ""} validé${valides > 1 ? "s" : ""}, ${transmis} transmis, sur ${n}`}>
        <div className="h-full bg-success" style={{ width: `${n > 0 ? (valides / n) * 100 : 0}%` }} />
        <div className="h-full bg-warning" style={{ width: `${n > 0 ? (transmis / n) * 100 : 0}%` }} />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
        <span>Tableaux <b className="font-semibold tabular-nums text-foreground">{transmis + valides} / {n}</b></span>
        <span>
          Échéance{" "}
          {echeance ? <b className={cn("font-semibold", echeance.retard ? "text-destructive" : "text-foreground")}>{echeance.texte}</b> : <b className="font-semibold text-foreground">—</b>}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground" title={`Créée le ${formatDate(collecte.creeLe)}${collecte.derniereRelanceLe ? ` · relancée le ${formatDate(collecte.derniereRelanceLe)}` : ""}`}>
        Dernière activité · {formatRelative(collecte.majLe)}
      </p>
      {tableaux.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1" aria-label="Tableaux demandés">
          {tableaux.map((nom) => <li key={nom} className="whitespace-nowrap rounded border border-border bg-muted/40 px-1.5 py-px text-[11px] text-muted-foreground">{nom}</li>)}
        </ul>
      )}
      <div className="mt-3 flex items-center gap-1.5">
        <button
          type="button"
          onClick={onOuvrir}
          aria-label={`${action(collecte)} la collecte ${nomSociete} — ${titreCollecte(collecte)}`}
          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 text-[0.8125rem] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {action(collecte)} la collecte
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </button>
        {onDelete && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="icon-sm" className="size-9" aria-label={`Actions pour ${nomSociete}, ${titreCollecte(collecte)}`}>
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem variant="destructive" onSelect={() => onDelete(collecte)}><Trash2 /> Supprimer…</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </article>
  );
}

/** Pastille d'état d'une société dans la liste : en retard, à examiner, sinon rien à signaler. */
function EtatSociete({ g }: { g: Groupe }) {
  if (g.enRetard > 0) return <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive"><span aria-hidden="true" className="size-1.5 rounded-full bg-current" />En retard</span>;
  if (g.aExaminer > 0) return <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-semibold text-warning"><span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{g.aExaminer} à examiner</span>;
  return <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground"><span aria-hidden="true" className="size-1.5 rounded-full bg-current" />Rien à examiner</span>;
}

/** Présentation « liste et volet » des collectes : les sociétés à gauche, la fiche de la société choisie (une carte par collecte, avec son circuit) à droite. */
export function CollectesVolet({ collectes, socNom, onDelete }: { collectes: Collecte[]; socNom: (societeId: string) => string; onDelete?: (collecte: Collecte) => void }) {
  const navigate = useNavigate();
  const now = useMemo(() => new Date(), []);
  const groupes = useMemo(() => grouperParSociete(collectes, socNom, now), [collectes, socNom, now]);
  const [choix, setChoix] = useState<string | null>(null);
  const choisie = groupes.find((g) => g.societeId === choix) ?? groupes[0] ?? null;
  // La société choisie disparaît de la liste (filtre, recherche) : la première prend la place.
  useEffect(() => {
    if (choix && !groupes.some((g) => g.societeId === choix)) setChoix(null);
  }, [groupes, choix]);
  const rangs = useMemo(() => (choisie ? rangsHomonymes(choisie.collectes) : new Map<string, number>()), [choisie]);
  return (
    <div className="grid min-h-[30rem] lg:grid-cols-[minmax(0,1fr)_28rem]" data-testid="collectes-liste-volet">
      <ul className="min-w-0 border-border lg:border-r" aria-label="Sociétés">
        {groupes.map((g) => {
          const actif = g.societeId === choisie?.societeId;
          return (
            <li key={g.societeId}>
              <button
                type="button"
                aria-current={actif ? "true" : undefined}
                onClick={() => setChoix(g.societeId)}
                className={cn("grid w-full grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3.5 border-b border-border/70 px-4 py-3 text-left transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", actif && "bg-accent/15 shadow-[inset_3px_0_0_hsl(var(--accent))]")}
              >
                <span aria-hidden="true" className="relative grid size-10 place-items-center rounded-xl bg-gradient-to-br from-primary/90 to-primary text-[0.78rem] font-bold text-primary-foreground shadow-sm">
                  {initials(g.nom)}
                  {g.enRetard > 0 && <i className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-card bg-destructive" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-foreground">{g.nom}</span>
                  <span className="block truncate text-xs text-muted-foreground">{g.collectes.length} collecte{g.collectes.length > 1 ? "s" : ""} · dernière {titreCollecte(g.collectes[0])}</span>
                </span>
                <EtatSociete g={g} />
              </button>
            </li>
          );
        })}
      </ul>
      <aside className="bg-gradient-to-b from-muted/50 to-card p-5" aria-label="Fiche de la société">
        {choisie && (
          <div>
            <h2 className="text-lg font-bold text-primary">{choisie.nom}</h2>
            <p className="mb-3.5 text-[0.8125rem] text-muted-foreground">{choisie.collectes.length} collecte{choisie.collectes.length > 1 ? "s" : ""}</p>
            <dl className="mb-3.5 grid grid-cols-3 gap-2.5">
              {([["Collectes", choisie.collectes.length, "text-primary"], ["À examiner", choisie.aExaminer, choisie.aExaminer > 0 ? "text-warning" : "text-muted-foreground/60"], ["En retard", choisie.enRetard, choisie.enRetard > 0 ? "text-destructive" : "text-primary"]] as const).map(([libelle, valeur, ton]) => (
                <div key={libelle} className="rounded-xl border border-border bg-card px-3 py-2.5">
                  <dt className="text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{libelle}</dt>
                  <dd className={cn("m-0 mt-0.5 text-xl font-bold tabular-nums", ton)}>{valeur}</dd>
                </div>
              ))}
            </dl>
            {choisie.collectes.map((c) => (
              <CarteCollecte key={c.id} collecte={c} rang={rangs.get(c.id)} now={now} nomSociete={choisie.nom} onOuvrir={() => navigate(`/collectes/${c.id}`)} onDelete={onDelete} />
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}

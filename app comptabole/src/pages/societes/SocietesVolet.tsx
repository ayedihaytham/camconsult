import { useMemo, useRef, useState, type ComponentProps, type KeyboardEvent } from "react";
import { Eye, FolderOpen } from "lucide-react";
import { LedgerRowMenu } from "@/components/ledger/LedgerRowMenu";
import { StatutIcone } from "@/components/ledger/StatutIcone";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { COLLECTE_STATUT_LABELS } from "@/lib/collecte/tabs";
import { cn, toTitleCase } from "@/lib/utils";
import type { Collecte, Societe, Statut } from "@/types";

const MONOGRAM_TONES = [
  "border-primary/15 bg-primary/[0.07] text-primary",
  "border-border bg-secondary text-primary/80",
  "border-accent/35 bg-accent/10 text-primary",
] as const;

export function societeInitials(name: string) {
  const order = name.trim().match(/^\d{1,3}/);
  if (order) return order[0];
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function monogramTone(seed: string) {
  const index = Array.from(seed).reduce((total, character) => total + character.charCodeAt(0), 0);
  return MONOGRAM_TONES[index % MONOGRAM_TONES.length];
}

export type SocieteContact = { nom: string; role: "Responsable" | "Délégué"; delegues: number };

const CIRCUIT = ["À remplir", "Transmise", "Validée"] as const;
const ETAPE = { brouillon: 0, transmis: 1, a_corriger: 1, valide: 2 } as const;
const LIBELLE_COLLECTE: Partial<Record<Collecte["statut"], string>> = { transmis: "Transmise", valide: "Validée" };
const POINT_STATUT: Record<Statut, string> = { actif: "bg-success", en_attente: "border-2 border-warning bg-card", inactif: "bg-muted-foreground/50" };

/** Avancement de la collecte du mois : trois points reliés (à remplir, transmise, validée) et le statut écrit ; les corrections demandées passent en alerte. */
function CollecteCircuit({ collecte }: { collecte: Collecte }) {
  const etape = ETAPE[collecte.statut as keyof typeof ETAPE] ?? 0;
  const alerte = collecte.statut === "a_corriger";
  const libelle = LIBELLE_COLLECTE[collecte.statut] ?? COLLECTE_STATUT_LABELS[collecte.statut];
  return (
    <span className="inline-flex items-center" role="img" aria-label={`${libelle} · étapes : ${CIRCUIT.join(", ")}`}>
      {CIRCUIT.map((nom, index) => (
        <span key={nom} className="inline-flex items-center" aria-hidden="true">
          {index > 0 && <span className={cn("h-0.5 w-4", index <= etape ? "bg-primary" : "bg-border")} />}
          <span className={cn(
            "block rounded-full border-2",
            index < etape ? "size-2.5 border-primary bg-primary" : index === etape ? cn("size-3 border-[3px] bg-card", alerte ? "border-destructive shadow-[0_0_0_3px_hsl(var(--destructive)/0.14)]" : "border-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]") : "size-2.5 border-border bg-card",
          )} />
        </span>
      ))}
      <span className={cn("ml-2.5 text-xs font-semibold", alerte ? "text-destructive" : "text-primary")} aria-hidden="true">{libelle}</span>
    </span>
  );
}

interface SocietesVoletProps {
  societes: Societe[];
  loading: boolean;
  emptyMessage: string;
  voitTaches: boolean;
  libelleCollecte: string;
  contactPrincipal: Map<string, SocieteContact>;
  collecteDuMois: Map<string, Collecte>;
  openTaskCount: Map<string, number>;
  dossiersParSociete: Map<string, number>;
  onOpenFiche: (societe: Societe) => void;
  onOpenDossiers: (societe: Societe) => void;
  menuActions: (societe: Societe) => ComponentProps<typeof LedgerRowMenu>["actions"];
}

/** Présentation « liste et volet » du registre : la liste compacte à gauche, le détail de la société choisie à droite. Ne porte aucune règle métier : tout vient de la page. */
export function SocietesVolet({ societes, loading, emptyMessage, voitTaches, libelleCollecte, contactPrincipal, collecteDuMois, openTaskCount, dossiersParSociete, onOpenFiche, onOpenDossiers, menuActions }: SocietesVoletProps) {
  const sorted = useMemo(() => [...societes].sort((a, b) => a.raisonSociale.localeCompare(b.raisonSociale, "fr")), [societes]);
  const [choisie, setChoisie] = useState<string | null>(null);
  const listeRef = useRef<HTMLUListElement>(null);
  const courante = sorted.find((societe) => societe.id === choisie) ?? sorted[0];

  if (loading) {
    return <div className="grid gap-3 p-3 lg:grid-cols-[320px_minmax(0,1fr)]" role="status" aria-label="Chargement des sociétés"><Skeleton className="h-64" /><Skeleton className="h-64" /></div>;
  }
  if (!courante) return <p className="px-4 py-10 text-sm text-muted-foreground">{emptyMessage}</p>;

  function naviguer(event: KeyboardEvent<HTMLUListElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const index = sorted.findIndex((societe) => societe.id === courante.id);
    const suivant = sorted[Math.min(sorted.length - 1, Math.max(0, index + (event.key === "ArrowDown" ? 1 : -1)))];
    setChoisie(suivant.id);
    requestAnimationFrame(() => listeRef.current?.querySelector<HTMLElement>(`[data-societe="${suivant.id}"]`)?.focus());
  }

  const contact = contactPrincipal.get(courante.id);
  const collecte = collecteDuMois.get(courante.id);
  const taches = openTaskCount.get(courante.id) ?? 0;
  const dossiers = dossiersParSociete.get(courante.id) ?? 0;
  const bloc = "grid content-start gap-1.5 rounded-[10px] border border-border/70 bg-muted/30 px-4 py-3.5";
  const etiquette = "text-[10.5px] font-bold uppercase tracking-[0.1em] text-muted-foreground";

  return (
    <div className="grid items-start gap-3 p-3 lg:grid-cols-[320px_minmax(0,1fr)]">
      <ul ref={listeRef} onKeyDown={naviguer} aria-label="Sociétés" className="flex max-h-[calc(100vh-22rem)] min-h-[20rem] flex-col gap-1 overflow-y-auto rounded-xl border border-border bg-card p-2">
        {sorted.map((societe) => {
          const active = societe.id === courante.id;
          const collecteListe = collecteDuMois.get(societe.id);
          return (
            <li key={societe.id}>
              <button
                type="button"
                data-societe={societe.id}
                aria-current={active ? "true" : undefined}
                onClick={() => setChoisie(societe.id)}
                className={cn("grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[9px] px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active ? "bg-primary text-primary-foreground" : "hover:bg-muted/60")}
              >
                <span aria-hidden className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg border text-[10px] font-bold tracking-wide", active ? "border-white/30 bg-white/15 text-accent" : monogramTone(societe.id))}>{societeInitials(societe.raisonSociale)}</span>
                <span className="min-w-0">
                  <span className={cn("block truncate text-[13px] font-semibold", active ? "text-primary-foreground" : "text-primary")}>{societe.raisonSociale}</span>
                  <span className={cn("block truncate text-[11.5px]", active ? "text-primary-foreground/75" : "text-muted-foreground")}>{voitTaches ? (collecteListe ? LIBELLE_COLLECTE[collecteListe.statut] ?? COLLECTE_STATUT_LABELS[collecteListe.statut] : "Aucune collecte") : societe.theme}</span>
                </span>
                <span className={cn("size-2.5 rounded-full", POINT_STATUT[societe.statut])} title={societe.statut === "actif" ? "Actif" : societe.statut === "en_attente" ? "En attente" : "Inactif"} />
              </button>
            </li>
          );
        })}
      </ul>

      <section aria-live="polite" aria-label={`Détail de ${courante.raisonSociale}`} className="min-w-0 rounded-xl border border-border bg-card p-5">
        <header className="flex items-center gap-4 border-b border-border/70 pb-4">
          <span aria-hidden className={cn("flex size-[52px] shrink-0 items-center justify-center rounded-[13px] border text-[15px] font-bold", monogramTone(courante.id))}>{societeInitials(courante.raisonSociale)}</span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold text-primary">{courante.raisonSociale}</h2>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{courante.code} · {courante.theme} · {courante.rne || "RNE non renseigné"}</p>
          </div>
          <StatutIcone statut={courante.statut} />
          <LedgerRowMenu actions={menuActions(courante).filter((action) => action.label !== "Voir la fiche" && action.label !== "Mes dossiers")} />
        </header>

        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className={bloc}>
            <dt className={etiquette}>Contact</dt>
            <dd>
              {contact ? <>
                <p className="text-sm font-semibold text-foreground">{toTitleCase(contact.nom)}</p>
                <p className="text-xs text-muted-foreground">{contact.role}{contact.delegues > 0 && ` · ${contact.delegues} délégué${contact.delegues > 1 ? "s" : ""}`}</p>
              </> : <span className="text-sm text-muted-foreground">Aucun contact</span>}
            </dd>
          </div>
          {voitTaches && (
            <div className={bloc}>
              <dt className={etiquette}>{libelleCollecte}</dt>
              <dd>{collecte ? <CollecteCircuit collecte={collecte} /> : <span className="text-sm text-muted-foreground">Aucune collecte</span>}</dd>
            </div>
          )}
          {voitTaches && (
            <div className={bloc}>
              <dt className={etiquette}>Tâches ouvertes</dt>
              <dd className={cn("text-[28px] font-bold leading-none tabular-nums", taches === 0 ? "text-muted-foreground/50" : "text-primary")}>{taches}</dd>
            </div>
          )}
          <div className={bloc}>
            <dt className={etiquette}>Dossiers</dt>
            <dd className={cn("text-[28px] font-bold leading-none tabular-nums", dossiers === 0 ? "text-muted-foreground/50" : "text-primary")}>{dossiers}</dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button type="button" className="gap-2" onClick={() => onOpenFiche(courante)}>
            <Eye className="size-4" aria-hidden="true" />Ouvrir la fiche
          </Button>
          <Button type="button" variant="outline" className="gap-2" onClick={() => onOpenDossiers(courante)}>
            <FolderOpen className="size-4" aria-hidden="true" />Voir les dossiers
          </Button>
        </div>
      </section>
    </div>
  );
}

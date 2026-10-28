import { useState, type ReactNode } from "react";
import { Filter, MoreHorizontal, Search, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { norme, type CriteresStock, type FiltreSituation, type ValeurFiltre } from "@/lib/stockFiltres";
import { COLONNES_MASQUABLES, type ColonneStock, type DensiteStock, type PrefsTableauStock } from "@/lib/stockPrefs";

const SITUATIONS: { valeur: FiltreSituation; nom: string }[] = [
  { valeur: "tous", nom: "Tous" },
  { valeur: "solde", nom: "Soldés" },
  { valeur: "ecart", nom: "Écarts" },
  { valeur: "sans-achat", nom: "Sans achat" },
  { valeur: "sans-vente", nom: "Sans vente" },
];

/** Choix multiple parmi des puces (clients ou fournisseurs) : recherche au-delà de 8 noms, nombre de mouvements de chacun. */
function PucesMulti({ titre, valeurs, choix, onChange }: { titre: string; valeurs: ValeurFiltre[]; choix: ReadonlySet<string>; onChange: (choix: Set<string>) => void }) {
  const [recherche, setRecherche] = useState("");
  const visibles = valeurs.filter((v) => norme(v.nom).includes(norme(recherche)));
  const basculer = (cle: string) => {
    const suite = new Set(choix);
    if (suite.has(cle)) suite.delete(cle);
    else suite.add(cle);
    onChange(suite);
  };
  return (
    <section aria-label={titre} className="py-2">
      <div className="mb-1.5 flex items-center justify-between">
        <h3 className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">{titre}</h3>
        {choix.size > 0 && (
          <button type="button" onClick={() => onChange(new Set())} className="text-xs font-medium text-info hover:underline">
            Effacer ({choix.size})
          </button>
        )}
      </div>
      {valeurs.length > 8 && <Input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher…" aria-label={`Rechercher parmi les ${titre.toLowerCase()}s`} className="mb-1.5 h-8 text-sm" />}
      {valeurs.length === 0 && <p className="text-xs text-muted-foreground">Aucun pour l'instant.</p>}
      <ul className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto" aria-label={titre}>
        {visibles.map((v) => (
          <li key={v.cle}>
            <button
              type="button"
              aria-pressed={choix.has(v.cle)}
              onClick={() => basculer(v.cle)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                choix.has(v.cle) ? "border-primary bg-primary font-semibold text-primary-foreground" : "border-border bg-card text-foreground hover:bg-accent/10",
              )}
            >
              {v.nom}
              <span className="tabular-nums opacity-70">{v.nombre}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface Props {
  criteres: CriteresStock;
  onCriteres: (c: CriteresStock) => void;
  clients: ValeurFiltre[];
  fournisseurs: ValeurFiltre[];
  /** Nombre de mouvements par situation, les autres filtres appliqués. */
  comptes: Record<FiltreSituation, number>;
  prefs: PrefsTableauStock;
  onPrefs: (p: PrefsTableauStock) => void;
  /** Contrôles propres à la page (présentation, monnaie des cours), placés à droite de la barre. */
  droite?: ReactNode;
  /** Chiffres complémentaires et réglages de la rangée des situations, placés à droite (quantités, douane). */
  chiffres?: ReactNode;
  /** Mouvements affichés et total. */
  affiches: number;
  total: number;
}

const FIGURE_ACTIVE = "after:absolute after:inset-x-4 after:bottom-0 after:h-0.5 after:rounded after:bg-primary";

/**
 * Barre de filtres du stock, dans le style de Sociétés : une recherche large qui porte le bouton « Filtres » (client, fournisseur), le nombre
 * de mouvements, les contrôles de la page et le menu d'affichage ; dessous, les chiffres par situation qui font office de filtres.
 */
export function StockFiltres({ criteres, onCriteres, clients, fournisseurs, comptes, prefs, onPrefs, droite, chiffres, affiches, total }: Props) {
  const filtresTiers = criteres.clients.size + criteres.fournisseurs.size;
  const filtresActifs = filtresTiers + (criteres.situation !== "tous" ? 1 : 0) + (criteres.recherche.trim() ? 1 : 0);
  const changerColonne = (cle: ColonneStock, visible: boolean) => onPrefs({ ...prefs, colonnes: { ...prefs.colonnes, [cle]: visible } });
  const changerDensite = (densite: DensiteStock) => onPrefs({ ...prefs, densite });
  return (
    <div role="search" aria-label="Filtres du stock">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border/80 px-3 py-2">
        <div className="flex h-10 min-w-[14rem] flex-1 items-center gap-2 rounded-[10px] border border-border bg-muted/40 pl-3 pr-1.5 focus-within:ring-2 focus-within:ring-ring">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            value={criteres.recherche}
            onChange={(e) => onCriteres({ ...criteres, recherche: e.target.value })}
            placeholder="Rechercher un n° de facture, un client, un fournisseur…"
            aria-label="Rechercher un n° de facture, un client, un fournisseur"
            className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`Filtres${filtresTiers > 0 ? ` (${filtresTiers} actif${filtresTiers > 1 ? "s" : ""})` : ""}`}
                className={cn("inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg border bg-card px-2.5 text-[0.8125rem] font-semibold transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", filtresTiers > 0 ? "border-primary text-primary" : "border-border text-foreground")}
              >
                <Filter className="size-3.5" aria-hidden="true" />
                Filtres
                <span className={cn("min-w-4 rounded-full px-1 text-center text-[0.625rem] tabular-nums", filtresTiers > 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{filtresTiers}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[22rem] max-w-[calc(100vw-1rem)] divide-y divide-border p-3 py-1">
              <PucesMulti titre="Client" valeurs={clients} choix={criteres.clients} onChange={(c) => onCriteres({ ...criteres, clients: c })} />
              <PucesMulti titre="Fournisseur" valeurs={fournisseurs} choix={criteres.fournisseurs} onChange={(f) => onCriteres({ ...criteres, fournisseurs: f })} />
            </PopoverContent>
          </Popover>
        </div>
        <span className="flex items-center gap-2 whitespace-nowrap text-xs tabular-nums text-muted-foreground">
          {affiches !== total ? `${affiches} sur ${total}` : `${total} mouvement${total > 1 ? "s" : ""}`}
          {filtresActifs > 0 && (
            <button type="button" onClick={() => onCriteres({ situation: "tous", clients: new Set(), fournisseurs: new Set(), recherche: "" })} className="inline-flex items-center gap-1 font-medium text-info hover:underline">
              <X className="size-3" aria-hidden="true" />
              Effacer les filtres
            </button>
          )}
        </span>
        <span className="ml-auto flex flex-wrap items-center gap-2">
          {droite}
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" aria-label="Affichage" title="Affichage : colonnes et densité" className="inline-grid size-9 place-items-center rounded-[10px] border border-border bg-card text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <MoreHorizontal className="size-4" aria-hidden="true" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-60 p-2">
              <p className="px-2 pb-1 pt-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Colonnes</p>
              <ul aria-label="Colonnes affichées">
                {COLONNES_MASQUABLES.map((c) => (
                  <li key={c.cle}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent/10">
                      <Checkbox checked={prefs.colonnes[c.cle]} onCheckedChange={(v) => changerColonne(c.cle, v === true)} aria-label={c.nom} />
                      {c.nom}
                    </label>
                  </li>
                ))}
              </ul>
              <p className="px-2 pb-1 pt-2 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Densité</p>
              <span role="group" aria-label="Densité du tableau" className="mx-2 mb-1 inline-flex overflow-hidden rounded-md border border-border">
                {([["compact", "Compact"], ["aere", "Aéré"]] as const).map(([valeur, nom]) => (
                  <button
                    key={valeur}
                    type="button"
                    aria-pressed={prefs.densite === valeur}
                    onClick={() => changerDensite(valeur)}
                    className={cn("px-3 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", prefs.densite === valeur ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent/10")}
                  >
                    {nom}
                  </button>
                ))}
              </span>
            </PopoverContent>
          </Popover>
        </span>
      </div>
      <div data-tour="stock-summary" className="flex flex-wrap items-stretch gap-x-0.5 border-b border-border/80 bg-muted/20 px-3">
        <div role="group" aria-label="Situation des mouvements" className="flex flex-wrap items-stretch">
          {SITUATIONS.map((s) => {
            const actif = criteres.situation === s.valeur;
            const alerte = (s.valeur === "ecart" || s.valeur === "sans-achat") && comptes[s.valeur] > 0;
            return (
              <button
                key={s.valeur}
                type="button"
                aria-pressed={actif}
                onClick={() => onCriteres({ ...criteres, situation: s.valeur })}
                className={cn("relative flex items-baseline gap-2 px-4 py-3 text-[0.8125rem] transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", actif ? `font-semibold text-foreground ${FIGURE_ACTIVE}` : "text-muted-foreground")}
              >
                <b className={cn("text-xl font-bold leading-none tabular-nums tracking-tight", alerte ? "text-destructive" : comptes[s.valeur] === 0 ? "text-muted-foreground/50" : "text-primary")}>{comptes[s.valeur]}</b>
                {s.nom}
              </button>
            );
          })}
        </div>
        {chiffres && <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 py-1.5">{chiffres}</div>}
      </div>
    </div>
  );
}

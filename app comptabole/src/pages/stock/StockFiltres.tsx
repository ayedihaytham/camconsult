import { useState, type ReactNode } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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

/** Choix multiple dans une liste (clients ou fournisseurs) : recherche, nombre de mouvements par nom, « Effacer ». */
function FiltreMulti({ titre, valeurs, choix, onChange }: { titre: string; valeurs: ValeurFiltre[]; choix: ReadonlySet<string>; onChange: (choix: Set<string>) => void }) {
  const [recherche, setRecherche] = useState("");
  const visibles = valeurs.filter((v) => norme(v.nom).includes(norme(recherche)));
  const basculer = (cle: string) => {
    const suite = new Set(choix);
    if (suite.has(cle)) suite.delete(cle);
    else suite.add(cle);
    onChange(suite);
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className={cn("h-9 gap-1.5", choix.size > 0 && "border-primary bg-primary/[0.06] font-semibold")} aria-label={`Filtrer par ${titre.toLowerCase()}`}>
          {titre}
          {choix.size > 0 && <span className="rounded-full bg-primary px-1.5 text-[0.65rem] font-semibold text-primary-foreground">{choix.size}</span>}
          <ChevronDown className="size-3.5 opacity-60" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        {valeurs.length > 6 && (
          <Input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher…" aria-label={`Rechercher parmi les ${titre.toLowerCase()}s`} className="mb-1.5 h-8 text-sm" />
        )}
        <ul className="max-h-64 overflow-y-auto" aria-label={titre}>
          {visibles.length === 0 && <li className="px-2 py-3 text-center text-xs text-muted-foreground">{valeurs.length === 0 ? "Aucun pour l'instant." : "Aucun résultat."}</li>}
          {visibles.map((v) => (
            <li key={v.cle}>
              <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent/10">
                <Checkbox checked={choix.has(v.cle)} onCheckedChange={() => basculer(v.cle)} aria-label={v.nom} />
                <span className="min-w-0 flex-1 truncate">{v.nom}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{v.nombre}</span>
              </label>
            </li>
          ))}
        </ul>
        <div className="mt-1.5 flex justify-between border-t border-border pt-1.5">
          <button type="button" disabled={choix.size === 0} onClick={() => onChange(new Set())} className="text-xs font-medium text-info hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline">
            Effacer
          </button>
        </div>
      </PopoverContent>
    </Popover>
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
  /** Contrôles propres à la page (monnaie des cours), placés à droite. */
  droite?: ReactNode;
  /** Mouvements affichés et total. */
  affiches: number;
  total: number;
}

/** Barre de filtres du stock : recherche, client, fournisseur, situation, colonnes affichées et densité. */
export function StockFiltres({ criteres, onCriteres, clients, fournisseurs, comptes, prefs, onPrefs, droite, affiches, total }: Props) {
  const filtresActifs = criteres.clients.size + criteres.fournisseurs.size + (criteres.situation !== "tous" ? 1 : 0) + (criteres.recherche.trim() ? 1 : 0);
  const changerColonne = (cle: ColonneStock, visible: boolean) => onPrefs({ ...prefs, colonnes: { ...prefs.colonnes, [cle]: visible } });
  const changerDensite = (densite: DensiteStock) => onPrefs({ ...prefs, densite });
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-4 py-2.5" role="search" aria-label="Filtres du stock">
      <div className="relative min-w-[10rem] flex-1 sm:max-w-[15rem]">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input value={criteres.recherche} onChange={(e) => onCriteres({ ...criteres, recherche: e.target.value })} placeholder="Rechercher…" aria-label="Rechercher un n° de facture, un client, un fournisseur" className="h-9 pl-8 text-sm" />
      </div>
      <FiltreMulti titre="Client" valeurs={clients} choix={criteres.clients} onChange={(clientsChoisis) => onCriteres({ ...criteres, clients: clientsChoisis })} />
      <FiltreMulti titre="Fournisseur" valeurs={fournisseurs} choix={criteres.fournisseurs} onChange={(f) => onCriteres({ ...criteres, fournisseurs: f })} />
      <div role="group" aria-label="Situation des mouvements" className="flex flex-wrap gap-1.5">
        {SITUATIONS.map((s) => (
          <button
            key={s.valeur}
            type="button"
            aria-pressed={criteres.situation === s.valeur}
            onClick={() => onCriteres({ ...criteres, situation: s.valeur })}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              criteres.situation === s.valeur ? "border-primary bg-primary font-semibold text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-accent/10",
            )}
          >
            {s.nom}
            <span className="tabular-nums opacity-80">{comptes[s.valeur]}</span>
          </button>
        ))}
      </div>
      {filtresActifs > 0 && (
        <button type="button" onClick={() => onCriteres({ situation: "tous", clients: new Set(), fournisseurs: new Set(), recherche: "" })} className="inline-flex items-center gap-1 text-xs font-medium text-info hover:underline">
          <X className="size-3" aria-hidden="true" />
          Effacer les filtres
        </button>
      )}
      <span className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-2">
        {affiches !== total && <span className="text-[0.8125rem] tabular-nums text-muted-foreground">{affiches} sur {total}</span>}
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="hidden h-9 gap-1.5 xl:inline-flex">
              Affichage
              <ChevronDown className="size-3.5 opacity-60" aria-hidden="true" />
            </Button>
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
        {droite}
      </span>
    </div>
  );
}

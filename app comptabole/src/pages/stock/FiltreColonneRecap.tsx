import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ListFilter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { norme } from "@/lib/stockFiltres";
import { type FiltresRecap, type ValeurColonne } from "@/lib/filtresRecapSociete";

/** Filtre d'une colonne façon Excel : tri, recherche, « Sélectionner tout », valeurs à cocher avec leur nombre de lignes, puis OK. */
export function FiltreColonneRecap({
  colonneId,
  titre,
  valeurs,
  filtres,
  onFiltres,
}: {
  colonneId: string;
  titre: string;
  /** Valeurs proposées (celles des lignes que les filtres des autres colonnes laissent passer). */
  valeurs: ValeurColonne[];
  filtres: FiltresRecap;
  onFiltres: (f: FiltresRecap) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [choix, setChoix] = useState<Set<string>>(new Set());
  const retenues = filtres.colonnes[colonneId];
  const actif = (retenues?.size ?? 0) > 0;
  const tri = filtres.tri?.colonne === colonneId ? filtres.tri.sens : null;

  const visibles = useMemo(() => valeurs.filter((v) => norme(v.affichage).includes(norme(recherche))), [valeurs, recherche]);
  const toutesVisiblesCochees = visibles.length > 0 && visibles.every((v) => choix.has(v.cle));

  function ouvrir(o: boolean) {
    if (o) {
      // Sans filtre, tout est coché (c'est le point de départ d'Excel).
      setChoix(new Set(actif ? [...retenues!].filter((c) => valeurs.some((v) => v.cle === c)) : valeurs.map((v) => v.cle)));
      setRecherche("");
    }
    setOuvert(o);
  }

  function basculer(cle: string) {
    const suite = new Set(choix);
    if (suite.has(cle)) suite.delete(cle);
    else suite.add(cle);
    setChoix(suite);
  }

  function toutBasculer() {
    const suite = new Set(choix);
    for (const v of visibles) {
      if (toutesVisiblesCochees) suite.delete(v.cle);
      else suite.add(v.cle);
    }
    setChoix(suite);
  }

  function changerFiltre(retenir: ReadonlySet<string> | null) {
    const { [colonneId]: _ancien, ...autres } = filtres.colonnes;
    onFiltres({ ...filtres, colonnes: retenir ? { ...autres, [colonneId]: retenir } : autres });
  }

  function valider() {
    // Tout coché = pas de filtre ; rien coché ne se valide pas (Excel désactive OK).
    changerFiltre(valeurs.every((v) => choix.has(v.cle)) ? null : choix);
    setOuvert(false);
  }

  function trier(sens: "asc" | "desc") {
    onFiltres({ ...filtres, tri: tri === sens ? null : { colonne: colonneId, sens } });
    setOuvert(false);
  }

  return (
    <Popover open={ouvert} onOpenChange={ouvrir}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Filtrer la colonne ${titre}${actif ? " (filtre actif)" : ""}`}
          className={cn(
            "relative inline-flex size-5 shrink-0 items-center justify-center rounded text-primary-foreground/70 transition-colors hover:bg-primary-foreground/15 hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
            (actif || tri) && "bg-accent text-accent-foreground hover:bg-accent/90 hover:text-accent-foreground",
          )}
        >
          {tri === "asc" && !actif ? <ArrowUp className="size-3" aria-hidden="true" /> : tri === "desc" && !actif ? <ArrowDown className="size-3" aria-hidden="true" /> : <ListFilter className="size-3" aria-hidden="true" />}
          {actif && <span className="absolute -right-1.5 -top-1.5 rounded-full bg-card px-1 text-[0.5625rem] font-bold leading-4 text-primary shadow">{retenues!.size}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2 text-foreground">
        <p className="px-1 pb-1.5 text-xs font-semibold text-muted-foreground">{titre}</p>
        <div className="grid grid-cols-2 gap-1.5 pb-2">
          <Button type="button" size="sm" variant="outline" className={cn("h-8 gap-1 text-xs", tri === "asc" && "border-primary bg-primary/[0.06] font-semibold")} onClick={() => trier("asc")}>
            <ArrowUp className="size-3.5" aria-hidden="true" /> Trier A → Z
          </Button>
          <Button type="button" size="sm" variant="outline" className={cn("h-8 gap-1 text-xs", tri === "desc" && "border-primary bg-primary/[0.06] font-semibold")} onClick={() => trier("desc")}>
            <ArrowDown className="size-3.5" aria-hidden="true" /> Trier Z → A
          </Button>
        </div>
        {valeurs.length > 6 && (
          <Input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher…" aria-label={`Rechercher dans ${titre}`} className="mb-1.5 h-8 text-sm" />
        )}
        <label className="flex cursor-pointer items-center gap-2 rounded-md border-b border-border px-2 py-1.5 text-sm font-medium hover:bg-accent/10">
          <Checkbox checked={toutesVisiblesCochees} onCheckedChange={toutBasculer} aria-label="Sélectionner tout" />
          <span>(Sélectionner tout)</span>
        </label>
        <ul className="max-h-56 overflow-y-auto" aria-label={`Valeurs de ${titre}`}>
          {visibles.length === 0 && <li className="px-2 py-3 text-center text-xs text-muted-foreground">Aucun résultat.</li>}
          {visibles.map((v) => (
            <li key={v.cle}>
              <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent/10">
                <Checkbox checked={choix.has(v.cle)} onCheckedChange={() => basculer(v.cle)} aria-label={v.affichage} />
                <span className={cn("min-w-0 flex-1 truncate", v.cle === "" && "italic text-muted-foreground")}>{v.affichage}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{v.nombre}</span>
              </label>
            </li>
          ))}
        </ul>
        <div className="mt-1.5 flex items-center justify-between border-t border-border pt-2">
          <button
            type="button"
            disabled={!actif}
            onClick={() => {
              changerFiltre(null);
              setOuvert(false);
            }}
            className="text-xs font-medium text-info hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
          >
            Effacer le filtre
          </button>
          <Button type="button" size="sm" variant="ledger" className="h-8 px-4" disabled={choix.size === 0} onClick={valider}>
            OK
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

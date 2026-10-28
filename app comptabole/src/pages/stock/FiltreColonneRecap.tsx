import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { norme } from "@/lib/stockFiltres";
import { conditionValide, OPERATEURS, type ConditionRecap, type FiltresRecap, type OperateurRecap, type TypeColonne, type ValeurColonne } from "@/lib/filtresRecapSociete";

const CHAMP = "h-8 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Section repliable de la fenêtre (« Filtrer par condition », « Filtrer par valeurs »). */
function Section({ titre, ouverte, onBasculer, actif, children }: { titre: string; ouverte: boolean; onBasculer: () => void; actif: boolean; children: React.ReactNode }) {
  return (
    <div className="border-t border-border">
      <button type="button" aria-expanded={ouverte} onClick={onBasculer} className="flex w-full items-center gap-1.5 px-1 py-2 text-left text-sm font-medium hover:text-primary">
        {ouverte ? <ChevronDown className="size-3.5" aria-hidden="true" /> : <ChevronRight className="size-3.5" aria-hidden="true" />}
        {titre}
        {actif && <span className="ml-auto size-1.5 rounded-full bg-accent" aria-label="actif" />}
      </button>
      {ouverte && <div className="pb-2">{children}</div>}
    </div>
  );
}

/**
 * Filtre d'une colonne façon Excel : tri, filtre par condition (contient, supérieur à, date antérieure à…) et filtre par valeurs
 * (cases à cocher avec leur nombre de lignes). Condition et valeurs se cumulent ; rien ne s'applique avant « OK ».
 */
export function FiltreColonneRecap({
  colonneId,
  titre,
  type,
  valeurs,
  filtres,
  onFiltres,
}: {
  colonneId: string;
  titre: string;
  type: TypeColonne;
  /** Valeurs proposées (celles des lignes que les filtres des autres colonnes laissent passer). */
  valeurs: ValeurColonne[];
  filtres: FiltresRecap;
  onFiltres: (f: FiltresRecap) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [choix, setChoix] = useState<Set<string>>(new Set());
  const [condition, setCondition] = useState<ConditionRecap | null>(null);
  const [parCondition, setParCondition] = useState(false);
  const [parValeurs, setParValeurs] = useState(true);
  const retenues = filtres.colonnes[colonneId];
  const conditionActive = filtres.conditions[colonneId];
  const actif = (retenues?.size ?? 0) > 0 || Boolean(conditionActive);
  const tri = filtres.tri?.colonne === colonneId ? filtres.tri.sens : null;

  const visibles = useMemo(() => valeurs.filter((v) => norme(v.affichage).includes(norme(recherche))), [valeurs, recherche]);
  const operateur = condition ? OPERATEURS[type].find((o) => o.op === condition.op) : undefined;
  const conditionOk = !condition || conditionValide(type, condition);
  const toutesChoisies = valeurs.length > 0 && valeurs.every((v) => choix.has(v.cle));

  function ouvrir(o: boolean) {
    if (o) {
      // Sans filtre, tout est coché (point de départ d'Excel) ; la section qui porte un filtre s'ouvre.
      setChoix(new Set(retenues?.size ? [...retenues].filter((c) => valeurs.some((v) => v.cle === c)) : valeurs.map((v) => v.cle)));
      setCondition(conditionActive ?? null);
      setParCondition(Boolean(conditionActive));
      setParValeurs(!conditionActive || (retenues?.size ?? 0) > 0);
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

  function choisirOperateur(op: string) {
    setCondition(op === "" ? null : { op: op as OperateurRecap, v1: condition?.v1 ?? "", v2: condition?.v2 ?? "" });
  }

  function valider() {
    const { [colonneId]: _v, ...autresValeurs } = filtres.colonnes;
    const { [colonneId]: _c, ...autresConditions } = filtres.conditions;
    onFiltres({
      ...filtres,
      // Tout coché = pas de filtre par valeurs.
      colonnes: valeurs.every((v) => choix.has(v.cle)) ? autresValeurs : { ...autresValeurs, [colonneId]: choix },
      conditions: condition ? { ...autresConditions, [colonneId]: condition } : autresConditions,
    });
    setOuvert(false);
  }

  function retirer() {
    const { [colonneId]: _v, ...autresValeurs } = filtres.colonnes;
    const { [colonneId]: _c, ...autresConditions } = filtres.conditions;
    onFiltres({ ...filtres, colonnes: autresValeurs, conditions: autresConditions });
    setOuvert(false);
  }

  function trier(sens: "asc" | "desc") {
    onFiltres({ ...filtres, tri: tri === sens ? null : { colonne: colonneId, sens } });
    setOuvert(false);
  }

  const nbFiltres = (retenues?.size ?? 0) + (conditionActive ? 1 : 0);

  return (
    <Popover open={ouvert} onOpenChange={ouvrir}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Filtrer la colonne ${titre}${actif ? " (filtre actif)" : ""}`}
          className={cn(
            "relative inline-flex size-[18px] shrink-0 items-center justify-center rounded-[4px] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
            actif || tri
              ? "border-accent bg-accent text-accent-foreground"
              : "border-transparent text-primary-foreground/60 hover:border-primary-foreground/30 hover:bg-primary-foreground/10 hover:text-primary-foreground",
          )}
        >
          {tri === "asc" && !actif ? <ArrowUp className="size-3" aria-hidden="true" /> : tri === "desc" && !actif ? <ArrowDown className="size-3" aria-hidden="true" /> : <Filter className="size-3" aria-hidden="true" />}
          {actif && nbFiltres > 1 && <span className="absolute -right-1.5 -top-1.5 min-w-3.5 rounded-full bg-card px-0.5 text-center text-[0.5625rem] font-bold leading-[14px] text-primary shadow">{nbFiltres}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2.5 text-foreground">
        <p className="px-1 pb-1.5 text-xs font-semibold text-muted-foreground">{titre}</p>
        <div className="grid grid-cols-2 gap-1.5 pb-2">
          <Button type="button" size="sm" variant="outline" className={cn("h-8 gap-1 text-xs", tri === "asc" && "border-primary bg-primary/[0.06] font-semibold")} onClick={() => trier("asc")}>
            <ArrowUp className="size-3.5" aria-hidden="true" /> Trier A → Z
          </Button>
          <Button type="button" size="sm" variant="outline" className={cn("h-8 gap-1 text-xs", tri === "desc" && "border-primary bg-primary/[0.06] font-semibold")} onClick={() => trier("desc")}>
            <ArrowDown className="size-3.5" aria-hidden="true" /> Trier Z → A
          </Button>
        </div>

        <Section titre="Filtrer par condition" ouverte={parCondition} onBasculer={() => setParCondition(!parCondition)} actif={Boolean(conditionActive)}>
          <select aria-label="Condition" className={CHAMP} value={condition?.op ?? ""} onChange={(e) => choisirOperateur(e.target.value)}>
            <option value="">Aucun</option>
            {OPERATEURS[type].map((o) => <option key={o.op} value={o.op}>{o.nom}</option>)}
          </select>
          {condition && operateur && operateur.valeurs >= 1 && (
            <div className="mt-1.5 flex flex-col gap-1.5">
              <Input
                aria-label={operateur.valeurs === 2 ? "Valeur minimale" : "Valeur"}
                type={type === "date" ? "date" : "text"}
                inputMode={type === "nombre" ? "decimal" : undefined}
                placeholder={type === "date" ? undefined : type === "nombre" ? "Nombre" : "Valeur"}
                value={condition.v1}
                onChange={(e) => setCondition({ ...condition, v1: e.target.value })}
                className="h-8 text-sm"
              />
              {operateur.valeurs === 2 && (
                <Input aria-label="Valeur maximale" inputMode="decimal" placeholder="et" value={condition.v2} onChange={(e) => setCondition({ ...condition, v2: e.target.value })} className="h-8 text-sm" />
              )}
            </div>
          )}
        </Section>

        <Section titre="Filtrer par valeurs" ouverte={parValeurs} onBasculer={() => setParValeurs(!parValeurs)} actif={(retenues?.size ?? 0) > 0}>
          <div className="mb-1.5 flex items-center justify-between px-1 text-xs">
            <span>
              <button type="button" className="font-medium text-info hover:underline" onClick={() => setChoix(new Set([...choix, ...visibles.map((v) => v.cle)]))}>
                Sélectionner les {visibles.length}
              </button>
              {" · "}
              <button type="button" className="font-medium text-info hover:underline" onClick={() => setChoix(new Set([...choix].filter((c) => !visibles.some((v) => v.cle === c))))}>
                Effacer
              </button>
            </span>
            <span className="text-muted-foreground">Affichage de {visibles.length}</span>
          </div>
          {valeurs.length > 6 && <Input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher…" aria-label={`Rechercher dans ${titre}`} className="mb-1.5 h-8 text-sm" />}
          <ul className="max-h-48 overflow-y-auto rounded-md border border-border" aria-label={`Valeurs de ${titre}`}>
            {visibles.length === 0 && <li className="px-2 py-3 text-center text-xs text-muted-foreground">Aucun résultat.</li>}
            {visibles.map((v) => (
              <li key={v.cle}>
                <label className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent/10">
                  <Checkbox checked={choix.has(v.cle)} onCheckedChange={() => basculer(v.cle)} aria-label={v.affichage} />
                  <span className={cn("min-w-0 flex-1 truncate", v.cle === "" && "italic text-muted-foreground")}>{v.affichage}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">{v.nombre}</span>
                </label>
              </li>
            ))}
          </ul>
        </Section>

        <div className="flex items-center justify-between border-t border-border pt-2.5">
          <button type="button" disabled={!actif} onClick={retirer} className="text-xs font-medium text-info hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline">
            Retirer le filtre
          </button>
          <div className="flex gap-1.5">
            <Button type="button" size="sm" variant="outline" className="h-8 px-3" onClick={() => setOuvert(false)}>
              Annuler
            </Button>
            <Button type="button" size="sm" variant="ledger" className="h-8 px-4" disabled={!conditionOk || (valeurs.length > 0 && choix.size === 0 && !toutesChoisies)} onClick={valider}>
              OK
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

import { useMemo, useState } from "react";
import { Building2, Check, ChevronDown, Search, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePermissions } from "@/hooks/usePermissions";
import { useChoisirSociete, useSocieteActive } from "@/hooks/useSocieteActive";
import { cn } from "@/lib/utils";
import { useSocietes } from "@/store/data";

/** Choix de la société sur laquelle on travaille, présent dans la barre du haut :
 * les modules par société s'ouvrent ensuite directement sur elle. Inutile pour un
 * compte société, qui n'a qu'un seul dossier. */
export function SocieteActiveSelect() {
  const { canSeeSociete, lectureSeule } = usePermissions();
  const societes = useSocietes();
  const active = useSocieteActive();
  const choisir = useChoisirSociete();
  const [open, setOpen] = useState(false);
  const [recherche, setRecherche] = useState("");

  const visibles = useMemo(
    () =>
      societes
        .filter((s) => canSeeSociete(s.id))
        .sort((a, b) => a.raisonSociale.localeCompare(b.raisonSociale, "fr", { numeric: true })),
    // canSeeSociete change à chaque rendu : la liste ne dépend que des sociétés.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [societes],
  );

  if (lectureSeule) return null;

  const q = recherche.trim().toLocaleLowerCase("fr");
  const resultats = q
    ? visibles.filter((s) => `${s.raisonSociale} ${s.code}`.toLocaleLowerCase("fr").includes(q))
    : visibles;

  function pick(id: string | null) {
    choisir(id);
    setOpen(false);
    setRecherche("");
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setRecherche("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={active ? `Société active : ${active.raisonSociale}. Changer de société` : "Choisir la société sur laquelle travailler"}
          className={cn(
            "flex h-10 min-w-0 max-w-[9.5rem] items-center gap-2 rounded-lg border px-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:max-w-[16rem] lg:h-9",
            active
              ? "border-accent bg-accent/15 font-semibold text-primary"
              : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground",
          )}
        >
          <Building2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{active ? active.raisonSociale : "Toutes les sociétés"}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[min(22rem,calc(100vw-1.5rem))] rounded-xl p-0">
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            autoFocus
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && resultats.length > 0) pick(resultats[0].id);
            }}
            placeholder="Rechercher une société…"
            aria-label="Rechercher une société"
            className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
          />
        </div>
        <ul role="listbox" aria-label="Sociétés" className="max-h-80 overflow-y-auto p-1.5">
          {!q && (
            <li>
              <button
                type="button"
                role="option"
                aria-selected={!active}
                onClick={() => pick(null)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-secondary",
                  !active && "font-semibold text-primary",
                )}
              >
                <X className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="flex-1">Toutes les sociétés</span>
                {!active && <Check className="h-4 w-4 text-accent" aria-hidden="true" />}
              </button>
            </li>
          )}
          {resultats.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                role="option"
                aria-selected={active?.id === s.id}
                onClick={() => pick(s.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-secondary",
                  active?.id === s.id && "bg-accent/10 font-semibold text-primary",
                )}
              >
                <span className="min-w-0 flex-1 truncate">{s.raisonSociale}</span>
                {s.statut !== "actif" && <span className="text-xs text-muted-foreground">inactive</span>}
                {active?.id === s.id && <Check className="h-4 w-4 text-accent" aria-hidden="true" />}
              </button>
            </li>
          ))}
          {resultats.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">Aucune société trouvée.</li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

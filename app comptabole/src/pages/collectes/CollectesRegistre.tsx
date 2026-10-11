import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { collectionLabel, isOverdueCollection } from "@/lib/dashboard/dashboardData";
import type { Collecte, CollecteStatut } from "@/types";
import { cn, formatRelative, initials } from "@/lib/utils";

type SortKey = "priorite" | "societe" | "statut" | "echeance" | "avancement" | "activite";

const STATUT: Record<CollecteStatut, { label: string; tone: string; rank: number }> = {
  brouillon: { label: "Chez le client", tone: "bg-muted text-muted-foreground", rank: 0 },
  transmis: { label: "Transmis", tone: "bg-info/15 text-info", rank: 1 },
  a_corriger: { label: "À corriger", tone: "bg-warning/15 text-warning", rank: 2 },
  valide: { label: "Validée", tone: "bg-success/15 text-success", rank: 3 },
  archive: { label: "Archivée", tone: "bg-muted text-muted-foreground", rank: 4 },
};

function avancement(c: Collecte): number {
  const n = c.onglets?.length ?? 0;
  return n > 0 ? Math.min(100, Math.round((((c.tableauxTransmis ?? 0) + (c.tableauxValides ?? 0)) / n) * 100)) : 0;
}

function action(c: Collecte): string {
  if ((c.tableauxTransmis ?? 0) > 0 || c.statut === "a_corriger" || c.statut === "transmis") return "Examiner";
  if (c.statut === "brouillon") return "Ouvrir";
  return "Consulter";
}

const formatEcheance = (value: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(new Date(value));

/** Registre des collectes du cabinet : un vrai tableau triable, une ligne par collecte, une liste compacte sur téléphone. */
export function CollectesRegistre({ collectes, socNom, onDelete, pageSize = 15 }: {
  collectes: Collecte[];
  socNom: (societeId: string) => string;
  /** Suppression, réservée à l'admin : sans cette fonction, le menu d'actions n'existe pas. */
  onDelete?: (collecte: Collecte) => void;
  pageSize?: number;
}) {
  const navigate = useNavigate();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "priorite", dir: 1 });
  const [limite, setLimite] = useState(pageSize);
  const now = useMemo(() => new Date(), []);

  const rows = useMemo(() => {
    const valeur = (c: Collecte): string | number => {
      switch (sort.key) {
        case "societe": return socNom(c.societeId).toLowerCase();
        case "statut": return STATUT[c.statut].rank;
        case "echeance": return c.echeance ?? "9999";
        case "avancement": return avancement(c);
        case "activite": return c.majLe;
        // À examiner d'abord, puis en retard, puis les plus récentes.
        default: return -((c.tableauxTransmis ?? 0) > 0 ? 2 : 0) - (isOverdueCollection(c, now) ? 1 : 0);
      }
    };
    return [...collectes].sort((a, b) => {
      const va = valeur(a);
      const vb = valeur(b);
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return cmp ? cmp * sort.dir : b.majLe.localeCompare(a.majLe);
    });
  }, [collectes, sort, socNom, now]);
  const visibles = rows.slice(0, limite);

  const tri = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === "activite" || key === "avancement" ? -1 : 1 }));
  const entete = (key: SortKey, label: string) => (
    <th scope="col" aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"} className="px-4 py-2.5 text-left">
      <button
        type="button"
        onClick={() => tri(key)}
        className={cn("whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.08em] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", sort.key === key ? "text-foreground" : "text-muted-foreground")}
      >
        {label}{sort.key === key ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );

  return (
    <div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <caption className="sr-only">Registre des collectes</caption>
          <thead className="border-b border-border bg-muted/40">
            <tr>
              {entete("societe", "Société · collecte")}
              {entete("statut", "Statut")}
              {entete("echeance", "Échéance")}
              {entete("avancement", "Avancement")}
              {entete("activite", "Dernière activité")}
              <th scope="col" className="px-4 py-2.5"><span className="sr-only">Action</span></th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((c) => {
              const st = STATUT[c.statut];
              const retard = isOverdueCollection(c, now);
              const av = avancement(c);
              const nom = socNom(c.societeId);
              return (
                <tr key={c.id} onClick={() => navigate(`/collectes/${c.id}`)} className="cursor-pointer border-t border-border hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-md border border-border bg-secondary/60 text-[11px] font-extrabold text-primary">{initials(nom)}</span>
                      <div className="min-w-0"><p className="truncate font-semibold">{nom}</p><p className="truncate text-xs text-muted-foreground">{collectionLabel(c)}</p></div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", st.tone)}>{st.label}{(c.tableauxTransmis ?? 0) > 0 ? ` · ${c.tableauxTransmis} à examiner` : ""}</span>
                  </td>
                  <td className={cn("whitespace-nowrap px-4 py-3", retard && "font-semibold text-destructive")}>
                    {c.echeance ? <>{formatEcheance(c.echeance)}{retard ? " · en retard" : ""}</> : <span className="text-xs text-muted-foreground">Non définie</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2" role="img" aria-label={`Avancement ${av} %`}>
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${av}%` }} /></div>
                      <span className="text-xs tabular-nums text-muted-foreground">{(c.tableauxTransmis ?? 0) + (c.tableauxValides ?? 0)}/{c.onglets?.length ?? 0}</span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatRelative(c.majLe)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button type="button" variant="ghost" size="sm" className="min-h-9 gap-1 font-semibold text-primary" onClick={(e) => { e.stopPropagation(); navigate(`/collectes/${c.id}`); }} aria-label={`${action(c)} la collecte ${nom} — ${collectionLabel(c)}`}>
                        {action(c)}<ArrowRight className="size-3.5" aria-hidden="true" />
                      </Button>
                      {onDelete && <ActionsMenu collecte={c} nom={nom} onOpen={() => navigate(`/collectes/${c.id}`)} onDelete={onDelete} />}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-border md:hidden" aria-label="Collectes">
        {visibles.map((c) => {
          const st = STATUT[c.statut];
          const nom = socNom(c.societeId);
          const retard = isOverdueCollection(c, now);
          return (
            <li key={c.id} className="flex items-center gap-3 px-4 py-3">
              <button type="button" onClick={() => navigate(`/collectes/${c.id}`)} className="min-w-0 flex-1 text-left" aria-label={`${action(c)} la collecte ${nom} — ${collectionLabel(c)}`}>
                <p className="truncate text-sm font-semibold">{nom}</p>
                <p className="truncate text-xs text-muted-foreground">{collectionLabel(c)}{c.echeance ? ` · ${formatEcheance(c.echeance)}${retard ? " (en retard)" : ""}` : ""}</p>
                <span className={cn("mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold", st.tone)}>{st.label}{(c.tableauxTransmis ?? 0) > 0 ? ` · ${c.tableauxTransmis} à examiner` : ""}</span>
              </button>
              {onDelete && <ActionsMenu collecte={c} nom={nom} onOpen={() => navigate(`/collectes/${c.id}`)} onDelete={onDelete} />}
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
        <span className="tabular-nums">{visibles.length} sur {rows.length} collecte{rows.length > 1 ? "s" : ""}</span>
        {rows.length > limite && (
          <Button type="button" variant="outline" size="sm" className="min-h-9" onClick={() => setLimite((n) => n + pageSize)}>Afficher plus</Button>
        )}
      </div>
    </div>
  );
}

function ActionsMenu({ collecte, nom, onOpen, onDelete }: { collecte: Collecte; nom: string; onOpen: () => void; onDelete: (c: Collecte) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" className="size-10 lg:size-8" aria-label={`Actions pour ${nom}, ${collectionLabel(collecte)}`} onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onSelect={onOpen}><ArrowRight /> Ouvrir la collecte</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => onDelete(collecte)}><Trash2 /> Supprimer…</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

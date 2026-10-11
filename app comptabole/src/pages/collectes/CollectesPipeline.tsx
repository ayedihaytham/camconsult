import { useNavigate } from "react-router-dom";
import { collectionLabel } from "@/lib/dashboard/dashboardData";
import type { Collecte, CollecteStatut } from "@/types";
import { cn, formatRelative } from "@/lib/utils";

const COLONNES: { statut: CollecteStatut; titre: string; tone: string }[] = [
  { statut: "brouillon", titre: "Chez le client", tone: "bg-muted text-muted-foreground" },
  { statut: "transmis", titre: "Transmis", tone: "bg-info/15 text-info" },
  { statut: "a_corriger", titre: "À corriger", tone: "bg-warning/15 text-warning" },
  { statut: "valide", titre: "Validées", tone: "bg-success/15 text-success" },
];
const ARCHIVEES = { statut: "archive" as CollecteStatut, titre: "Archivées", tone: "bg-muted text-muted-foreground" };

/** Vue pipeline des collectes du cabinet : une colonne par étape, une carte par collecte. */
export function CollectesPipeline({ collectes, socNom }: { collectes: Collecte[]; socNom: (societeId: string) => string }) {
  const navigate = useNavigate();
  const colonnes = collectes.some((c) => c.statut === "archive") && collectes.every((c) => c.statut === "archive") ? [ARCHIVEES] : COLONNES;
  return (
    <div className={cn("grid gap-3 p-3 sm:p-4", colonnes.length === 1 ? "grid-cols-1" : "sm:grid-cols-2 xl:grid-cols-4")}>
      {colonnes.map((colonne) => {
        const items = collectes.filter((c) => c.statut === colonne.statut);
        return (
          <section key={colonne.statut} aria-label={colonne.titre} className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3">
            <h3 className="flex items-center justify-between text-sm font-semibold">
              {colonne.titre}
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums", colonne.tone)}>{items.length}</span>
            </h3>
            {items.length === 0 ? (
              <p className="py-2 text-xs text-muted-foreground">Aucune collecte</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {items.map((c) => {
                  const total = c.onglets?.length ?? 0;
                  const faits = (c.tableauxTransmis ?? 0) + (c.tableauxValides ?? 0);
                  const aExaminer = c.tableauxTransmis ?? 0;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => navigate(`/collectes/${c.id}`)}
                        className="w-full rounded-md border border-border bg-card p-3 text-left hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={`Ouvrir la collecte ${socNom(c.societeId)} — ${collectionLabel(c)}`}
                      >
                        <span className="block truncate text-sm font-semibold">{socNom(c.societeId)}</span>
                        <span className="block truncate text-xs text-muted-foreground">{collectionLabel(c)}</span>
                        <span className="mt-2 flex items-center gap-2">
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full bg-primary" style={{ width: `${total > 0 ? Math.min(100, Math.round((faits / total) * 100)) : 0}%` }} /></span>
                          <span className="text-[11px] tabular-nums text-muted-foreground">{faits}/{total}</span>
                        </span>
                        <span className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                          <span>{formatRelative(c.majLe)}</span>
                          {aExaminer > 0 && <span className="font-semibold text-warning">{aExaminer} à examiner</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

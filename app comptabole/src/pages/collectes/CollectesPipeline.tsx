import { useNavigate } from "react-router-dom";
import { collectionLabel } from "@/lib/dashboard/dashboardData";
import type { Collecte, CollecteStatut } from "@/types";
import { cn, formatRelative } from "@/lib/utils";

// `repere` colore le liseré de la colonne, le nombre et la barre d'avancement de ses cartes.
const COLONNES: { statut: CollecteStatut; titre: string; repere: string }[] = [
  { statut: "brouillon", titre: "Chez le client", repere: "#7284a1" },
  { statut: "transmis", titre: "À examiner", repere: "hsl(var(--primary))" },
  { statut: "a_corriger", titre: "À corriger", repere: "hsl(var(--accent))" },
  { statut: "valide", titre: "Validées", repere: "#2f7a55" },
];
const ARCHIVEES = { statut: "archive" as CollecteStatut, titre: "Archivées", repere: "#7284a1" };

/** Vue pipeline des collectes du cabinet : une colonne par étape, une carte par collecte. */
export function CollectesPipeline({ collectes, socNom }: { collectes: Collecte[]; socNom: (societeId: string) => string }) {
  const navigate = useNavigate();
  const colonnes = collectes.some((c) => c.statut === "archive") && collectes.every((c) => c.statut === "archive") ? [ARCHIVEES] : COLONNES;
  return (
    <div className={cn("grid gap-3 p-3 sm:p-4", colonnes.length === 1 ? "grid-cols-1" : "sm:grid-cols-2 xl:grid-cols-4")}>
      {colonnes.map((colonne) => {
        const items = collectes.filter((c) => c.statut === colonne.statut);
        return (
          <section key={colonne.statut} aria-label={colonne.titre} style={{ borderTopColor: colonne.repere }} className="flex min-w-0 flex-col gap-2 rounded-xl border-t-[3px] bg-background p-2.5">
            <h3 className="flex items-baseline gap-2 px-1 pb-1.5 pt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              {colonne.titre}
              <b className="ml-auto text-[17px] font-bold normal-case tracking-normal tabular-nums" style={{ color: colonne.repere }}>{items.length}</b>
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
                        className="w-full rounded-[10px] border border-border bg-card px-3 py-2.5 text-left transition-shadow hover:border-accent hover:shadow-[0_10px_20px_-14px_hsl(var(--primary)/0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={`Ouvrir la collecte ${socNom(c.societeId)} — ${collectionLabel(c)}`}
                      >
                        <span className="block truncate text-sm font-semibold">{socNom(c.societeId)}</span>
                        <span className="block truncate text-xs text-muted-foreground">{collectionLabel(c)}</span>
                        <span className="mt-2 flex items-center gap-2">
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full" style={{ background: colonne.repere, width: `${total > 0 ? Math.min(100, Math.round((faits / total) * 100)) : 0}%` }} /></span>
                          <span className="text-[11px] tabular-nums text-muted-foreground">{faits}/{total}</span>
                        </span>
                        <span className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                          <span>{formatRelative(c.majLe)}</span>
                          {aExaminer > 0 && <span className="font-semibold text-primary">{aExaminer} à examiner</span>}
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

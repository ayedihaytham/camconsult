import { useState } from "react";
import { Plus } from "lucide-react";
import { COLLECTE_TABS, etatDeTableau } from "@/lib/collecte/tabs";
import { cn } from "@/lib/utils";

interface Props {
  /** Tableaux déjà demandés dans la collecte. */
  demandes: string[];
  onAjouter: (key: string) => Promise<void>;
}

/** Tableaux que la collecte ne demande pas encore (par exemple les traites pour une collecte créée avant elles) : le cabinet les
 * ajoute d'un clic, et ils apparaissent alors dans la checklist et dans la barre d'onglets. */
export function TableauxNonDemandes({ demandes, onAjouter }: Props) {
  const [occupe, setOccupe] = useState<string | null>(null);
  const absents = COLLECTE_TABS.filter((t) => !demandes.includes(t.key));
  if (absents.length === 0) return null;

  async function ajouter(key: string) {
    setOccupe(key);
    try {
      await onAjouter(key);
    } catch {
      // l'erreur est déjà affichée par le store
    } finally {
      setOccupe(null);
    }
  }

  return (
    <section aria-label="Tableaux non demandés" className="border-t border-border bg-muted/20 px-4 py-3">
      <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Tableaux non demandés dans cette collecte</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">Ajoutez-les pour que le client les remplisse et qu'ils figurent dans la checklist.</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {absents.map((t) => {
          const etat = etatDeTableau(t.key);
          return (
            <li key={t.key}>
              <button
                type="button"
                disabled={occupe !== null}
                onClick={() => void ajouter(t.key)}
                className={cn(
                  "inline-flex min-h-9 items-center gap-1.5 rounded-md border border-dashed border-input bg-card px-2.5 py-1.5 text-xs text-foreground transition-colors hover:border-accent/60 hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                )}
              >
                {etat && <span className="rounded bg-accent/15 px-1 py-0.5 text-[10px] font-bold tracking-wide text-accent-foreground">{etat.code}</span>}
                <Plus className="size-3.5" aria-hidden="true" />
                <span>
                  Ajouter « {t.label} »{occupe === t.key ? "…" : ""}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

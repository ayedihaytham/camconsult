import { useState } from "react";
import { LoaderCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { COLLECTE_ETATS, COLLECTE_TABS, etatDeTableau } from "@/lib/collecte/tabs";

interface Props {
  /** Tableaux déjà demandés dans la collecte. */
  demandes: string[];
  onAjouter: (key: string) => Promise<void>;
}

/** Ajout ponctuel d'un tableau à la collecte, sans afficher une liste permanente dans la checklist. */
export function TableauxNonDemandes({ demandes, onAjouter }: Props) {
  const [occupe, setOccupe] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const absents = COLLECTE_TABS.filter((table) => !demandes.includes(table.key));
  if (absents.length === 0) return null;

  async function ajouter(key: string) {
    setOccupe(key);
    try {
      await onAjouter(key);
      setOpen(false);
    } catch {
      // L'erreur est déjà affichée par le store.
    } finally {
      setOccupe(null);
    }
  }

  return (
    <div className="border-t border-border px-4 py-2.5">
      <Dialog open={open} onOpenChange={(next) => !occupe && setOpen(next)}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="min-h-9 gap-2">
            <Plus className="size-4" aria-hidden="true" />
            Ajouter un tableau
            <span className="text-xs text-muted-foreground">({absents.length} disponibles)</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[85dvh] w-[calc(100vw-2rem)] max-w-2xl overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-5 py-4 pr-12">
            <DialogTitle>Ajouter un tableau</DialogTitle>
            <DialogDescription>
              Le tableau ajouté sera disponible dans la checklist et dans le sélecteur de travail.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[65dvh] space-y-5 overflow-y-auto px-5 py-4">
            {COLLECTE_ETATS.map((etat) => {
              const disponibles = etat.tableaux.filter((key) => absents.some((table) => table.key === key));
              if (disponibles.length === 0) return null;
              return (
                <section key={etat.key} aria-label={etat.label}>
                  <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">{etat.code}</span>
                    {etat.label}
                  </h3>
                  <ul className="divide-y divide-border rounded-lg border border-border">
                    {disponibles.map((key) => {
                      const table = COLLECTE_TABS.find((item) => item.key === key)!;
                      const busy = occupe === key;
                      return (
                        <li key={key}>
                          <button
                            type="button"
                            disabled={occupe !== null}
                            onClick={() => void ajouter(key)}
                            className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-60"
                          >
                            <span>{table.label}</span>
                            {busy ? <LoaderCircle className="size-4 animate-spin text-primary" aria-label="Ajout en cours" /> : <Plus className="size-4 text-primary" aria-hidden="true" />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
            {absents.some((table) => !etatDeTableau(table.key)) && (
              <section aria-label="Autres tableaux">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Autres tableaux</h3>
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {absents.filter((table) => !etatDeTableau(table.key)).map((table) => (
                    <li key={table.key}>
                      <button
                        type="button"
                        disabled={occupe !== null}
                        onClick={() => void ajouter(table.key)}
                        className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-60"
                      >
                        {table.label}
                        {occupe === table.key ? <LoaderCircle className="size-4 animate-spin text-primary" aria-label="Ajout en cours" /> : <Plus className="size-4 text-primary" aria-hidden="true" />}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

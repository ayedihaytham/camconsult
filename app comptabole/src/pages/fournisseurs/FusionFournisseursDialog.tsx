import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { RecapFournisseur } from "@/lib/fournisseurs";
import type { FusionFournisseur } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fournisseur affiché, celui qu'on regroupe avec un autre. */
  actif: RecapFournisseur | null;
  /** Les autres fournisseurs de la société. */
  autres: RecapFournisseur[];
  fusions: FusionFournisseur[];
  /** Nom affiché d'un fournisseur d'après sa clé. */
  nomDe: (cle: string) => string;
  onFusionner: (source: string, cible: string) => Promise<void>;
  onSeparer: (source: string) => Promise<void>;
}

/** Regroupe deux écritures d'un même fournisseur (« SOTACIB » et « SOTACIB KAIROUAN ») sans toucher aux factures du stock. */
export function FusionFournisseursDialog({ open, onOpenChange, actif, autres, fusions, nomDe, onFusionner, onSeparer }: Props) {
  const [cible, setCible] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setCible("");
  }, [open]);

  async function executer(action: () => Promise<void>) {
    setSaving(true);
    try {
      await action();
    } catch {
      // Le message d'erreur est déjà affiché par le store ; la fenêtre reste ouverte.
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Regrouper des fournisseurs</DialogTitle>
          <DialogDescription>
            Pour un fournisseur écrit de deux façons dans le stock. Les factures du stock ne sont pas modifiées : seul le suivi les regroupe, et vous pouvez le défaire.
          </DialogDescription>
        </DialogHeader>

        {actif && autres.length > 0 && (
          <fieldset className="space-y-2">
            <legend className="text-sm">
              « <span className="font-semibold">{actif.nom}</span> » est le même fournisseur que :
            </legend>
            {autres.map((a) => (
              <label key={a.cle} className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                <input type="radio" name="fusion-cible" value={a.cle} checked={cible === a.cle} onChange={() => setCible(a.cle)} />
                <span className="font-medium">{a.nom}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {a.nbFactures} facture{a.nbFactures > 1 ? "s" : ""}
                </span>
              </label>
            ))}
            <p className="text-xs text-muted-foreground">Le regroupement s'affiche sous l'écriture la plus fréquente dans le stock.</p>
          </fieldset>
        )}
        {actif && autres.length === 0 && fusions.length === 0 && (
          <p className="text-sm text-muted-foreground">Il n'y a pas d'autre fournisseur à regrouper avec « {actif.nom} ».</p>
        )}

        {fusions.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Regroupements en cours</h3>
            <ul className="divide-y divide-border rounded-md border border-border">
              {fusions.map((f) => (
                <li key={f.cleSource} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate">
                    « {f.nomSource} » regroupé avec « {nomDe(f.cleCible)} »
                  </span>
                  <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => void executer(() => onSeparer(f.cleSource))}>
                    Séparer
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
          {actif && autres.length > 0 && (
            <Button
              type="button"
              disabled={!cible || saving}
              onClick={() =>
                void executer(async () => {
                  await onFusionner(actif.cle, cible);
                  onOpenChange(false);
                })
              }
            >
              Regrouper
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

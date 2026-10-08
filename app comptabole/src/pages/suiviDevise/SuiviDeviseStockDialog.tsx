import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { fmtMontant } from "@/lib/stockRecap";
import { formatDate } from "@/lib/utils";
import type { SuiviDeviseStockVente } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  ventes: SuiviDeviseStockVente[];
  devise: string;
  /** Rejette en cas d'échec : la fenêtre reste ouverte. */
  onReprendre: (mouvementIds: string[]) => Promise<void>;
}

/** Ventes de la gestion de stock (même client, devise et exercice) à reprendre comme factures de la fiche. */
export function SuiviDeviseStockDialog({ open, onOpenChange, ventes, devise, onReprendre }: Props) {
  const [choix, setChoix] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // À l'ouverture, tout est coché : c'est le cas courant.
  useEffect(() => {
    if (open) setChoix(new Set(ventes.map((v) => v.mouvementId)));
  }, [open, ventes]);

  const toutes = ventes.length > 0 && choix.size === ventes.length;
  const total = Math.round(ventes.filter((v) => choix.has(v.mouvementId)).reduce((s, v) => s + v.montantTotal, 0) * 1000) / 1000;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Ventes de la gestion de stock</DialogTitle>
          <DialogDescription>
            Factures de vente du stock pour ce client, cet exercice et cette devise. Une fois reprises, elles suivent le mouvement de stock : le montant,
            la quantité ou la date se corrigent là-bas.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-80 overflow-auto rounded-md border border-border">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 bg-secondary text-left">
              <tr>
                <th className="px-2 py-1.5">
                  <Checkbox
                    checked={toutes}
                    aria-label="Tout sélectionner"
                    onCheckedChange={(c) => setChoix(c ? new Set(ventes.map((v) => v.mouvementId)) : new Set())}
                  />
                </th>
                <th className="px-2 py-1.5">Date</th>
                <th className="px-2 py-1.5">N° facture</th>
                <th className="px-2 py-1.5">Désignation</th>
                <th className="px-2 py-1.5">Fournisseur</th>
                <th className="px-2 py-1.5 text-right">Qté (T)</th>
                <th className="px-2 py-1.5 text-right">PU</th>
                <th className="px-2 py-1.5 text-right">Montant</th>
              </tr>
            </thead>
            <tbody>
              {ventes.map((v) => (
                <tr key={v.mouvementId} className="border-t border-border">
                  <td className="px-2 py-1.5">
                    <Checkbox
                      checked={choix.has(v.mouvementId)}
                      aria-label={`Facture ${v.nFacture}`}
                      onCheckedChange={(c) =>
                        setChoix((s) => {
                          const suite = new Set(s);
                          if (c) suite.add(v.mouvementId);
                          else suite.delete(v.mouvementId);
                          return suite;
                        })
                      }
                    />
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5">{v.dateFacture ? formatDate(v.dateFacture) : "—"}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 font-mono">{v.nFacture}</td>
                  <td className="px-2 py-1.5">{v.designationProduit || "—"}</td>
                  <td className="px-2 py-1.5">{v.fournisseur || "—"}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{fmtMontant(v.qteTonnes)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{fmtMontant(v.pu)}</td>
                  <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{fmtMontant(v.montantTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-muted-foreground">
          {choix.size} facture{choix.size > 1 ? "s" : ""} sélectionnée{choix.size > 1 ? "s" : ""} — <span className="tabular-nums">{fmtMontant(total)}</span> {devise}
        </p>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            type="button"
            variant="ledger"
            disabled={saving || choix.size === 0}
            onClick={async () => {
              setSaving(true);
              try {
                await onReprendre([...choix]);
                onOpenChange(false);
              } catch {
                // erreur déjà affichée par le store
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Reprise…" : `Reprendre ${choix.size} facture${choix.size > 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

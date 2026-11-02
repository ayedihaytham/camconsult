import { useEffect, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import { fmtMontant } from "@/lib/stockRecap";
import type { PropositionChange } from "@/lib/banqueChange";
import type { CompteBancaire } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  propositions: PropositionChange[];
  comptes: CompteBancaire[];
  onLier: (paires: { a: string; b: string }[]) => Promise<void>;
}

const montant = (m: { debit: number; credit: number }) => (m.debit > 0 ? m.debit : m.credit);

/** Les paires de lignes qui sont probablement les deux jambes d'un même change : les sûres sont cochées, les autres sont à vérifier. */
export function RelierChangesDialog({ open, onOpenChange, propositions, comptes, onLier }: Props) {
  const [choisies, setChoisies] = useState<Set<string>>(new Set());
  const [envoi, setEnvoi] = useState(false);
  const cle = (p: PropositionChange) => `${p.a.id}|${p.b.id}`;
  const devise = (compteId: string) => comptes.find((c) => c.id === compteId)?.devise ?? "";

  useEffect(() => {
    if (open) setChoisies(new Set(propositions.filter((p) => p.sure).map(cle)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const bascule = (k: string) =>
    setChoisies((prev) => {
      const suivant = new Set(prev);
      if (!suivant.delete(k)) suivant.add(k);
      return suivant;
    });

  async function lier() {
    setEnvoi(true);
    try {
      await onLier(propositions.filter((p) => choisies.has(cle(p))).map((p) => ({ a: p.a.id, b: p.b.id })));
      onOpenChange(false);
    } catch {
      // erreur déjà affichée par le store
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Relier les changes</DialogTitle>
          <DialogDescription>
            Une jambe sort d'un compte, l'autre entre sur le compte de l'autre devise. Une fois reliées, les deux lignes donnent le cours réel du change (dinars ÷ devise),
            proposé ensuite pour les règlements en devise. Ce cours reste une information : rien n'est recalculé avec.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2" aria-label="Changes à relier">
          {propositions.map((p) => {
            const k = cle(p);
            const sortie = p.a.debit > 0 ? p.a : p.b;
            const entree = p.a.debit > 0 ? p.b : p.a;
            return (
              <li key={k}>
                <label className={cn("flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 text-sm", choisies.has(k) ? "border-accent/60 bg-accent/10" : "border-border")}>
                  <input type="checkbox" className="mt-1" checked={choisies.has(k)} onChange={() => bascule(k)} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 font-medium tabular-nums">
                      {fmtMontant(montant(sortie))} {devise(sortie.compteId)}
                      <ArrowLeftRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
                      {fmtMontant(montant(entree))} {devise(entree.compteId)}
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold">cours {p.coursReel.toLocaleString("fr-FR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", p.sure ? "bg-success/15 text-success" : "bg-warning/20 text-warning")}>{p.sure ? "Sûre" : "À vérifier"}</span>
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Sortie le {formatDate(sortie.dateOp)} — {sortie.libelle || "sans libellé"} · Entrée le {formatDate(entree.dateOp)} — {entree.libelle || "sans libellé"}
                      {p.ecartJours > 0 ? ` · ${p.ecartJours} jour${p.ecartJours > 1 ? "s" : ""} d'écart` : ""}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="button" variant="ledger" disabled={envoi || choisies.size === 0} onClick={() => void lier()}>
            {envoi ? "Liaison…" : `Relier ${choisies.size} change${choisies.size > 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

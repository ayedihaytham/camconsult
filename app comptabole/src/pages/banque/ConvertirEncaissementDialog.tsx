import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { arrondi3 } from "../../../shared/arrondi.js";
import { changesPossibles, coursMoyenConversions, repartitionConversion } from "@/lib/banqueConversion";
import { formatDate } from "@/lib/utils";
import { fmtMontant } from "@/lib/stockRecap";
import type { MouvementBancaire } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** L'encaissement en devise à relier. */
  encaissement: MouvementBancaire | null;
  /** Tous les mouvements de la société (les changes possibles sont ceux du même compte). */
  mouvements: MouvementBancaire[];
  devise: string;
  onEnregistrer: (conversions: { changeId: string; montant: number }[]) => Promise<void>;
}

const cours4 = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 4, maximumFractionDigits: 4 });

/** Les changes qui ont converti un encaissement en devise : proposés dans l'ordre des dates, avec le cours réel de chacun et le cours moyen obtenu. */
export function ConvertirEncaissementDialog({ open, onOpenChange, encaissement, mouvements, devise, onEnregistrer }: Props) {
  const possibles = useMemo(() => (encaissement ? changesPossibles(encaissement, mouvements) : []), [encaissement, mouvements]);
  const [parts, setParts] = useState<Record<string, string>>({});
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    if (!open || !encaissement) return;
    // Déjà relié : on montre la répartition actuelle ; sinon, celle que l'on propose (dans l'ordre des dates).
    const actuelles = encaissement.conversions ?? [];
    const depart = actuelles.length > 0 ? actuelles.map((c) => ({ changeId: c.changeId, montant: c.montant })) : repartitionConversion(encaissement, possibles).parts;
    setParts(Object.fromEntries(depart.map((p) => [p.changeId, String(p.montant)])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, encaissement?.id]);

  if (!encaissement) return null;
  const nombre = (t: string | undefined) => {
    const n = Number((t ?? "").replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const choisies = possibles.map((c) => ({ c, montant: nombre(parts[c.mouvement.id]) })).filter((x) => x.montant > 0);
  const total = arrondi3(choisies.reduce((t, x) => t + x.montant, 0));
  const trop = total > encaissement.credit + 0.0005;
  const depasse = choisies.some((x) => x.montant > x.c.reste + 0.0005);
  const moyen = coursMoyenConversions(
    choisies.map((x) => ({ changeId: x.c.mouvement.id, montant: x.montant, dateOp: x.c.mouvement.dateOp, coursReel: x.c.mouvement.coursReel ?? null })),
  );

  async function enregistrer() {
    setEnvoi(true);
    try {
      await onEnregistrer(choisies.map((x) => ({ changeId: x.c.mouvement.id, montant: x.montant })));
      onOpenChange(false);
    } catch {
      // erreur déjà affichée par le store
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Relier l'encaissement à ses changes</DialogTitle>
          <DialogDescription>
            Encaissement du {formatDate(encaissement.dateOp)} « {encaissement.libelle.trim()} » : {fmtMontant(encaissement.credit)} {devise}. Indiquez quelle part de chaque
            change (sortie du même compte) l'a converti en dinars. Le cours réel est une information : rien n'est recalculé avec.
          </DialogDescription>
        </DialogHeader>

        {possibles.length === 0 ? (
          <p className="rounded-lg border border-border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
            Aucune sortie de change de ce compte, à cette date ou après, qui ait encore de quoi convertir. Importez le relevé qui contient le change, puis reliez ses deux jambes.
          </p>
        ) : (
          <>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setParts(Object.fromEntries(repartitionConversion(encaissement, possibles).parts.map((p) => [p.changeId, String(p.montant)])))}
              >
                Répartir automatiquement
              </Button>
            </div>
            <ul className="divide-y divide-border rounded-lg border border-border" aria-label="Changes possibles">
              {possibles.map(({ mouvement: m, reste }) => (
                <li key={m.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{m.libelle.trim()}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatDate(m.dateOp)} · {fmtMontant(m.debit)} {devise} vendus · reste {fmtMontant(reste)}
                      {m.coursReel ? ` · cours réel ${cours4(m.coursReel)}` : " · autre jambe non reliée : cours inconnu"}
                    </span>
                  </span>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="sr-only">Part de {m.libelle.trim()}</span>
                    <input
                      inputMode="decimal"
                      value={parts[m.id] ?? ""}
                      onChange={(e) => setParts((p) => ({ ...p, [m.id]: e.target.value }))}
                      placeholder="0"
                      aria-label={`Part de ${m.libelle.trim()}`}
                      className="h-9 w-32 rounded-md border border-input bg-card px-2 text-right tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    {devise}
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}

        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Converti</dt>
            <dd className={trop || depasse ? "font-semibold text-destructive" : "font-semibold"}>{fmtMontant(total)} {devise}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Non converti</dt>
            <dd className="font-semibold">{fmtMontant(Math.max(0, arrondi3(encaissement.credit - total)))} {devise}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Cours moyen obtenu</dt>
            <dd className="font-semibold">{moyen.cours ? `${cours4(moyen.cours)}${moyen.partiel ? " (partiel)" : ""}` : "—"}</dd>
          </div>
        </dl>
        {trop && <p role="alert" className="text-sm text-destructive">Le total dépasse le montant de l'encaissement.</p>}
        {!trop && depasse && <p role="alert" className="text-sm text-destructive">Une part dépasse ce qui reste du change.</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button variant="ledger" disabled={envoi || trop || depasse || (choisies.length === 0 && (encaissement.conversions ?? []).length === 0)} onClick={() => void enregistrer()}>
            {choisies.length === 0 ? "Retirer les liens" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

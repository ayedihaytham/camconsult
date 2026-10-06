import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AmountInput } from "@/components/common/AmountInput";
import { CARD_FIELD_INPUT, CardField } from "@/components/common/CardField";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSocietes } from "@/store/data";
import type { FactureInput } from "@/store/facturation";
import {
  DELAI_PAIEMENT_JOURS,
  TIMBRE_DEFAUT,
  TVA_TAUX,
  ajouterJours,
  calculerTotaux,
  formatTnd,
} from "@/lib/facturation";

interface LigneDraft {
  description: string;
  quantite: number;
  montantHt: number;
}

const emptyLigne = (): LigneDraft => ({ description: "", quantite: 1, montantHt: 0 });
const aujourdhui = () => new Date().toISOString().slice(0, 10);

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (data: FactureInput) => Promise<void> | void;
  /** Client proposé à l'ouverture (société active). */
  defaultSocieteId?: string;
}

export function FactureFormSheet({ open, onOpenChange, onSubmit, defaultSocieteId = "" }: Props) {
  const societes = useSocietes();
  const [societeId, setSocieteId] = useState("");
  const [dateEmission, setDateEmission] = useState(aujourdhui());
  const [echeance, setEcheance] = useState("");
  const [tvaTaux, setTvaTaux] = useState<number>(19);
  const [timbre, setTimbre] = useState<number>(TIMBRE_DEFAUT);
  const [note, setNote] = useState("");
  const [lignes, setLignes] = useState<LigneDraft[]>([emptyLigne()]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    const jour = aujourdhui();
    setSocieteId(defaultSocieteId);
    setDateEmission(jour);
    setEcheance(ajouterJours(jour, DELAI_PAIEMENT_JOURS));
    setTvaTaux(19);
    setTimbre(TIMBRE_DEFAUT);
    setNote("");
    setLignes([emptyLigne()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const totaux = useMemo(() => calculerTotaux(lignes, tvaTaux, timbre), [lignes, tvaTaux, timbre]);
  const lignesValides = lignes.filter((l) => l.description.trim() && Number(l.montantHt) > 0);
  const peutGenerer = Boolean(societeId) && lignesValides.length > 0 && !sending;

  const societesActives = useMemo(
    () => [...societes].sort((a, b) => a.raisonSociale.localeCompare(b.raisonSociale, "fr")),
    [societes],
  );

  function setLigne(i: number, patch: Partial<LigneDraft>) {
    setLignes((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function submit() {
    if (!peutGenerer) return;
    setSending(true);
    try {
      await onSubmit({
        societeId,
        dateEmission,
        echeance: echeance || null,
        tvaTaux,
        timbre,
        note: note.trim(),
        lignes: lignesValides.map((l) => ({
          description: l.description.trim(),
          quantite: Number(l.quantite) || 1,
          montantHt: Number(l.montantHt) || 0,
        })),
      });
      onOpenChange(false);
    } catch {
      // Le store a déjà affiché l'erreur : le formulaire reste ouvert pour corriger.
    } finally {
      setSending(false);
    }
  }

  const selectTrigger =
    "mt-1 h-auto w-full border-0 bg-transparent p-0 text-base text-foreground shadow-none focus:ring-0 focus:ring-offset-0 [&>svg]:size-4 [&>svg]:text-muted-foreground";
  const cell = "h-11 rounded-lg border-accent/35 bg-secondary/60 px-3 text-base focus-visible:border-primary focus-visible:bg-card";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-4xl flex-col gap-0 overflow-hidden rounded-2xl border-accent/30 p-0">
        <div className="shrink-0 border-b border-accent/30 px-6 pb-5 pt-6 sm:px-8">
          <DialogTitle className="pr-8 font-serif text-3xl font-medium text-primary">
            Nouvelle facture d'honoraires
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            Le numéro est attribué à la génération ; les totaux se calculent tout seuls.
          </DialogDescription>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6 sm:px-8">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <CardField id="facture-client" label="Client" className="col-span-2">
              <Select value={societeId} onValueChange={setSocieteId}>
                <SelectTrigger id="facture-client" className={selectTrigger}>
                  <SelectValue placeholder="Choisir la société" />
                </SelectTrigger>
                <SelectContent>
                  {societesActives.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.raisonSociale}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardField>
            <CardField id="facture-emission" label="Date d'émission">
              <input
                id="facture-emission"
                type="date"
                value={dateEmission}
                onChange={(e) => setDateEmission(e.target.value)}
                className={CARD_FIELD_INPUT}
              />
            </CardField>
            <CardField id="facture-echeance" label="Échéance de paiement">
              <input
                id="facture-echeance"
                type="date"
                value={echeance}
                onChange={(e) => setEcheance(e.target.value)}
                className={CARD_FIELD_INPUT}
              />
            </CardField>
            <CardField id="facture-tva" label="TVA">
              <Select value={String(tvaTaux)} onValueChange={(v) => setTvaTaux(Number(v))}>
                <SelectTrigger id="facture-tva" className={selectTrigger}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TVA_TAUX.map((t) => (
                    <SelectItem key={t} value={String(t)}>
                      {t} %
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardField>
            <CardField id="facture-timbre" label="Timbre fiscal (TND)">
              <AmountInput
                id="facture-timbre"
                value={timbre}
                onValueChange={setTimbre}
                allowNegative={false}
                className={CARD_FIELD_INPUT}
              />
            </CardField>
          </div>

          <div className="overflow-hidden rounded-xl border border-accent/30 bg-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-sm">
                <thead className="bg-accent/[0.08] text-sm text-primary">
                  <tr>
                    <th className="px-3 py-3 text-left font-semibold">Description</th>
                    <th className="w-28 px-2 py-3 text-right font-semibold">Quantité</th>
                    <th className="w-44 px-2 py-3 text-right font-semibold">Montant HT (TND)</th>
                    <th className="w-12 px-2 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((l, i) => (
                    <tr key={i} className="border-t border-accent/20">
                      <td className="px-1.5 py-2.5">
                        <Input
                          className={cell}
                          aria-label={`Description, ligne ${i + 1}`}
                          value={l.description}
                          onChange={(e) => setLigne(i, { description: e.target.value })}
                          placeholder="Honoraires de tenue comptable — janvier"
                        />
                      </td>
                      <td className="px-1.5 py-2.5">
                        <AmountInput
                          className={`${cell} text-right`}
                          aria-label={`Quantité, ligne ${i + 1}`}
                          value={l.quantite}
                          onValueChange={(n) => setLigne(i, { quantite: n })}
                          allowNegative={false}
                        />
                      </td>
                      <td className="px-1.5 py-2.5">
                        <AmountInput
                          className={`${cell} text-right`}
                          aria-label={`Montant HT, ligne ${i + 1}`}
                          value={l.montantHt}
                          onValueChange={(n) => setLigne(i, { montantHt: n })}
                          allowNegative={false}
                        />
                      </td>
                      <td className="px-1.5 py-2.5 text-center">
                        <button
                          type="button"
                          disabled={lignes.length === 1}
                          onClick={() => setLignes((ls) => ls.filter((_, idx) => idx !== i))}
                          className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                          aria-label={`Supprimer la ligne ${i + 1}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-lg px-5"
              onClick={() => setLignes((ls) => [...ls, emptyLigne()])}
            >
              <Plus className="h-4 w-4 text-accent" />
              Ajouter une ligne
            </Button>

            <dl className="w-full space-y-1.5 rounded-xl border border-accent/30 bg-accent/[0.07] px-5 py-4 text-base sm:w-80">
              <div className="flex justify-between text-muted-foreground">
                <dt>Total HT</dt>
                <dd className="tabular-nums">{formatTnd(totaux.totalHt)} TND</dd>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <dt>TVA ({tvaTaux} %)</dt>
                <dd className="tabular-nums">{formatTnd(totaux.tva)} TND</dd>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <dt>Timbre fiscal</dt>
                <dd className="tabular-nums">{formatTnd(timbre)} TND</dd>
              </div>
              <div className="flex justify-between border-t border-accent/30 pt-2 text-lg font-bold text-primary">
                <dt>Net à payer</dt>
                <dd className="tabular-nums">{formatTnd(totaux.netAPayer)} TND</dd>
              </div>
            </dl>
          </div>

          <CardField id="facture-note" label="Note (facultative)">
            <input
              id="facture-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={`${CARD_FIELD_INPUT} min-h-8`}
              placeholder="Mention affichée en bas de la facture"
            />
          </CardField>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-accent/30 px-6 py-4 sm:px-8">
          <p className="text-sm text-muted-foreground">
            {!societeId
              ? "Choisissez le client."
              : lignesValides.length === 0
                ? "Renseignez une description et un montant HT."
                : `${lignesValides.length} ligne${lignesValides.length > 1 ? "s" : ""} facturée${lignesValides.length > 1 ? "s" : ""}.`}
          </p>
          <div className="flex gap-3">
            <Button type="button" variant="outline" className="h-12 rounded-lg px-6" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button
              type="button"
              variant="ledger"
              className="h-12 rounded-lg px-6 text-sm uppercase tracking-[0.14em]"
              disabled={!peutGenerer}
              onClick={submit}
            >
              Générer la facture
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

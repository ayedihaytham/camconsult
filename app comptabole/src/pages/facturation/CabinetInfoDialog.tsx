import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CARD_FIELD_INPUT, CardField } from "@/components/common/CardField";
import type { FactureCabinet } from "@/types";

type Champs = Omit<FactureCabinet, "nom">;

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  cabinet: FactureCabinet | null;
  onSave: (data: Champs) => Promise<void>;
}

const VIDE: Champs = { adresse: "", matriculeFiscal: "", telephone: "", email: "", rib: "", mentions: "" };

/** Coordonnées imprimées en en-tête et pied de chaque facture. */
export function CabinetInfoDialog({ open, onOpenChange, cabinet, onSave }: Props) {
  const [v, setV] = useState<Champs>(VIDE);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setV(cabinet ? { ...cabinet } : VIDE);
  }, [open, cabinet]);

  const set = (patch: Partial<Champs>) => setV((s) => ({ ...s, ...patch }));

  async function save() {
    setSaving(true);
    try {
      await onSave(v);
      onOpenChange(false);
    } catch {
      // Message d'erreur déjà affiché par le store.
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-2xl flex-col gap-0 overflow-hidden rounded-2xl border-accent/30 p-0">
        <div className="shrink-0 border-b border-accent/30 px-6 pb-5 pt-6 sm:px-8">
          <DialogTitle className="pr-8 font-serif text-3xl font-medium text-primary">
            Informations du cabinet
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            Imprimées sur chaque facture : en-tête, coordonnées bancaires et mentions de pied de page.
          </DialogDescription>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-6 sm:px-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <CardField id="cab-mf" label="Matricule fiscal">
              <input id="cab-mf" value={v.matriculeFiscal} onChange={(e) => set({ matriculeFiscal: e.target.value })} className={CARD_FIELD_INPUT} />
            </CardField>
            <CardField id="cab-tel" label="Téléphone">
              <input id="cab-tel" value={v.telephone} onChange={(e) => set({ telephone: e.target.value })} className={CARD_FIELD_INPUT} />
            </CardField>
          </div>
          <CardField id="cab-adresse" label="Adresse">
            <textarea
              id="cab-adresse"
              rows={2}
              value={v.adresse}
              onChange={(e) => set({ adresse: e.target.value })}
              className={`${CARD_FIELD_INPUT} resize-none`}
            />
          </CardField>
          <div className="grid gap-4 sm:grid-cols-2">
            <CardField id="cab-email" label="E-mail">
              <input id="cab-email" type="email" value={v.email} onChange={(e) => set({ email: e.target.value })} className={CARD_FIELD_INPUT} />
            </CardField>
            <CardField id="cab-rib" label="RIB / IBAN">
              <input id="cab-rib" value={v.rib} onChange={(e) => set({ rib: e.target.value })} className={CARD_FIELD_INPUT} />
            </CardField>
          </div>
          <CardField id="cab-mentions" label="Mentions de pied de page" hint="Ex. : forme juridique, capital, registre de commerce.">
            <textarea
              id="cab-mentions"
              rows={2}
              value={v.mentions}
              onChange={(e) => set({ mentions: e.target.value })}
              className={`${CARD_FIELD_INPUT} resize-none`}
            />
          </CardField>
        </div>

        <div className="flex shrink-0 justify-end gap-3 border-t border-accent/30 px-6 py-4 sm:px-8">
          <Button type="button" variant="outline" className="h-12 rounded-lg px-6" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            type="button"
            variant="ledger"
            className="h-12 rounded-lg px-6 text-sm uppercase tracking-[0.14em]"
            disabled={saving}
            onClick={save}
          >
            Enregistrer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

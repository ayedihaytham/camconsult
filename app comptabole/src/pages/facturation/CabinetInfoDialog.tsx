import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CARD_FIELD_INPUT, CardField } from "@/components/common/CardField";
import { validerMatriculeFiscal } from "../../../shared/mf.js";
import type { FactureCabinet } from "@/types";

type Champs = Omit<FactureCabinet, "nom">;

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  cabinet: FactureCabinet | null;
  onSave: (data: Champs) => Promise<void>;
}

const VIDE: Champs = {
  adresse: "",
  matriculeFiscal: "",
  telephone: "",
  email: "",
  rib: "",
  mentions: "",
  raisonSociale: "",
  rue: "",
  ville: "",
  codePostal: "",
  pays: "TN",
  rc: "",
};

/** Coordonnées imprimées en en-tête et pied de chaque facture. */
export function CabinetInfoDialog({ open, onOpenChange, cabinet, onSave }: Props) {
  const [v, setV] = useState<Champs>(VIDE);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setV(cabinet ? { ...VIDE, ...cabinet } : VIDE);
  }, [open, cabinet]);

  const set = (patch: Partial<Champs>) => setV((s) => ({ ...s, ...patch }));
  const mf = validerMatriculeFiscal(v.matriculeFiscal);

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
            <CardField id="cab-mf" label="Matricule fiscal" hint={v.matriculeFiscal.trim() && !mf.ok ? mf.erreur : "13 caractères, ex. 1234567ABM000."}>
              <input id="cab-mf" value={v.matriculeFiscal} onChange={(e) => set({ matriculeFiscal: e.target.value })} aria-invalid={Boolean(v.matriculeFiscal.trim()) && !mf.ok} className={CARD_FIELD_INPUT} />
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
          <p className="border-t border-accent/30 pt-4 text-sm font-semibold text-primary">Facture électronique (El Fatoora)</p>
          <CardField id="cab-raison" label="Raison sociale" hint="Nom du cabinet tel qu'il figure sur la déclaration fiscale.">
            <input id="cab-raison" value={v.raisonSociale ?? ""} onChange={(e) => set({ raisonSociale: e.target.value })} className={CARD_FIELD_INPUT} />
          </CardField>
          <div className="grid gap-4 sm:grid-cols-2">
            <CardField id="cab-rue" label="Rue" hint="35 caractères au plus.">
              <input id="cab-rue" value={v.rue ?? ""} onChange={(e) => set({ rue: e.target.value })} className={CARD_FIELD_INPUT} />
            </CardField>
            <CardField id="cab-ville" label="Ville">
              <input id="cab-ville" value={v.ville ?? ""} onChange={(e) => set({ ville: e.target.value })} className={CARD_FIELD_INPUT} />
            </CardField>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <CardField id="cab-cp" label="Code postal">
              <input id="cab-cp" value={v.codePostal ?? ""} onChange={(e) => set({ codePostal: e.target.value })} className={CARD_FIELD_INPUT} />
            </CardField>
            <CardField id="cab-pays" label="Pays (code)" hint="2 lettres, ex. TN.">
              <input id="cab-pays" value={v.pays ?? ""} maxLength={2} onChange={(e) => set({ pays: e.target.value.toUpperCase() })} className={CARD_FIELD_INPUT} />
            </CardField>
            <CardField id="cab-rc" label="Registre de commerce" hint="Facultatif.">
              <input id="cab-rc" value={v.rc ?? ""} onChange={(e) => set({ rc: e.target.value })} className={CARD_FIELD_INPUT} />
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

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AmountInput } from "@/components/common/AmountInput";
import type { FactureFournisseur, FactureSuivi } from "@/types";

interface Props {
  facture: FactureFournisseur | null;
  onOpenChange: (o: boolean) => void;
  onSubmit: (mouvementId: string, data: FactureSuivi) => Promise<void>;
}

/** Suivi d'une facture d'achat : proforma, titre et chargement (colonnes facultatives de l'état fournisseur). */
export function SuiviFactureDialog({ facture, onOpenChange, onSubmit }: Props) {
  const [v, setV] = useState<FactureSuivi | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setV(facture ? { ...facture.suivi } : null);
  }, [facture]);

  const set = <K extends keyof FactureSuivi>(k: K, val: FactureSuivi[K]) => setV((s) => (s ? { ...s, [k]: val } : s));

  return (
    <Dialog open={Boolean(facture)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Suivi de la facture {facture?.numFacture || "sans numéro"}</DialogTitle>
          <DialogDescription>Proforma, titre et chargement : renseignez seulement ce qui vous sert.</DialogDescription>
        </DialogHeader>
        {v && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sv-pro">N° proforma</Label>
              <Input id="sv-pro" value={v.numProforma} onChange={(e) => set("numProforma", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sv-dpro">Date proforma</Label>
              <Input id="sv-dpro" type="date" value={v.dateProforma ?? ""} onChange={(e) => set("dateProforma", e.target.value || null)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sv-mpro">Montant proforma</Label>
              <AmountInput id="sv-mpro" value={v.montantProforma} allowNegative={false} onValueChange={(m) => set("montantProforma", m)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sv-qpro">Quantité proforma (T)</Label>
              <AmountInput id="sv-qpro" value={v.qteProforma} allowNegative={false} onValueChange={(m) => set("qteProforma", m)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sv-epro">État proforma</Label>
              <Input id="sv-epro" value={v.etatProforma} onChange={(e) => set("etatProforma", e.target.value)} placeholder="Ex. CLOT" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sv-titre">N° titre</Label>
              <Input id="sv-titre" value={v.numTitre} onChange={(e) => set("numTitre", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sv-charg">État de chargement</Label>
              <Input id="sv-charg" value={v.etatChargement} onChange={(e) => set("etatChargement", e.target.value)} placeholder="Ex. CHARGÉE" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sv-vu">Vu passé</Label>
              <Input id="sv-vu" value={v.vuPasse} onChange={(e) => set("vuPasse", e.target.value)} placeholder="OUI / NON" />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            type="button"
            variant="ledger"
            disabled={saving || !v || !facture}
            onClick={async () => {
              if (!v || !facture) return;
              setSaving(true);
              try {
                await onSubmit(facture.id, v);
                onOpenChange(false);
              } catch {
                // erreur déjà affichée par le store
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

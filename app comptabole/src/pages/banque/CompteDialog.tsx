import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AmountInput } from "@/components/common/AmountInput";
import type { CompteInput } from "@/store/banque";
import type { CompteBancaire } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Compte à modifier, ou null pour un nouveau. */
  compte: CompteBancaire | null;
  onSubmit: (data: CompteInput) => Promise<void>;
}

const vide: CompteInput = { banque: "", devise: "TND", numero: "", soldeDepart: 0, dateDepart: null, soldeReel: null, dateReel: null };

/** Compte bancaire d'une société : banque, devise, solde de départ et, pour contrôle, solde du relevé. */
export function CompteDialog({ open, onOpenChange, compte, onSubmit }: Props) {
  const [v, setV] = useState<CompteInput>(vide);
  const [avecReel, setAvecReel] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const { id: _id, ...donnees } = compte ?? { id: "", ...vide };
    void _id;
    setV(donnees);
    setAvecReel(compte?.soldeReel != null);
  }, [open, compte]);

  const set = <K extends keyof CompteInput>(k: K, val: CompteInput[K]) => setV((s) => ({ ...s, [k]: val }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{compte ? "Modifier le compte" : "Nouveau compte bancaire"}</DialogTitle>
          <DialogDescription>Un compte par banque et par devise, comme un onglet de votre classeur.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="cb-banque">Banque</Label>
            <Input id="cb-banque" value={v.banque} onChange={(e) => set("banque", e.target.value)} placeholder="Ex. BTL" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cb-devise">Devise</Label>
            <Input id="cb-devise" value={v.devise} onChange={(e) => set("devise", e.target.value.toUpperCase())} placeholder="TND, EUR…" />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="cb-numero">N° de compte (facultatif)</Label>
            <Input id="cb-numero" value={v.numero} onChange={(e) => set("numero", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cb-ddep">Date de départ</Label>
            <Input id="cb-ddep" type="date" value={v.dateDepart ?? ""} onChange={(e) => set("dateDepart", e.target.value || null)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cb-sdep">Solde de départ</Label>
            <AmountInput id="cb-sdep" value={v.soldeDepart} onValueChange={(m) => set("soldeDepart", m)} />
          </div>
          <label className="col-span-2 flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={avecReel}
              onChange={(e) => {
                setAvecReel(e.target.checked);
                if (!e.target.checked) setV((s) => ({ ...s, soldeReel: null, dateReel: null }));
                else setV((s) => ({ ...s, soldeReel: s.soldeReel ?? 0 }));
              }}
            />
            Contrôler avec le solde réel du relevé de la banque
          </label>
          {avecReel && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="cb-dreel">Date du solde réel</Label>
                <Input id="cb-dreel" type="date" value={v.dateReel ?? ""} onChange={(e) => set("dateReel", e.target.value || null)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cb-sreel">Solde réel</Label>
                <AmountInput id="cb-sreel" value={v.soldeReel ?? 0} onValueChange={(m) => set("soldeReel", m)} />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            type="button"
            variant="ledger"
            disabled={saving || !v.banque.trim()}
            onClick={async () => {
              setSaving(true);
              try {
                await onSubmit({ ...v, banque: v.banque.trim(), devise: v.devise.trim() || "TND" });
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

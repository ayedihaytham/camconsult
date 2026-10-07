import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AmountInput } from "@/components/common/AmountInput";
import { classerMouvement, TYPE_LABELS } from "@/lib/banque";
import type { MouvementInput } from "@/store/banque";
import type { MouvementBancaire, TypeMouvementBancaire } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Mouvement à modifier, ou null pour un nouveau. */
  mouvement: MouvementBancaire | null;
  devise: string;
  onSubmit: (data: MouvementInput) => Promise<void>;
}

const vide: MouvementInput = { dateOp: "", dateValeur: null, libelle: "", details: "", reference: "", numPiece: "", debit: 0, credit: 0, type: "autre" };

/** Mouvement d'un compte. Le sens (sortie ou entrée) est celui de la banque : débit = sortie du compte. */
export function MouvementDialog({ open, onOpenChange, mouvement, devise, onSubmit }: Props) {
  const [v, setV] = useState<MouvementInput>(vide);
  const [sens, setSens] = useState<"debit" | "credit">("debit");
  const [montant, setMontant] = useState(0);
  const [typeTouche, setTypeTouche] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mouvement) {
      setV({ ...mouvement });
      setSens(mouvement.credit > 0 ? "credit" : "debit");
      setMontant(mouvement.credit > 0 ? mouvement.credit : mouvement.debit);
      setTypeTouche(true);
    } else {
      setV(vide);
      setSens("debit");
      setMontant(0);
      setTypeTouche(false);
    }
  }, [open, mouvement]);

  const set = <K extends keyof MouvementInput>(k: K, val: MouvementInput[K]) => setV((s) => ({ ...s, [k]: val }));

  // Tant que le type n'a pas été choisi à la main, il suit le libellé et le sens.
  useEffect(() => {
    if (typeTouche) return;
    setV((s) => ({ ...s, type: classerMouvement(`${s.libelle} ${s.details}`, sens === "debit" ? montant : 0, sens === "credit" ? montant : 0) }));
  }, [typeTouche, v.libelle, v.details, sens, montant]);

  const valide = /^\d{4}-\d{2}-\d{2}$/.test(v.dateOp) && montant > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{mouvement ? "Modifier le mouvement" : "Nouveau mouvement"}</DialogTitle>
          <DialogDescription>Le débit sort du compte, le crédit y entre (sens de la banque).</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="mb-date">Date de l'opération</Label>
            <Input id="mb-date" type="date" value={v.dateOp} onChange={(e) => set("dateOp", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mb-valeur">Date de valeur</Label>
            <Input id="mb-valeur" type="date" value={v.dateValeur ?? ""} onChange={(e) => set("dateValeur", e.target.value || null)} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="mb-libelle">Description</Label>
            <Input id="mb-libelle" value={v.libelle} onChange={(e) => set("libelle", e.target.value)} placeholder="Ex. REGLEMENT INNORPI FAC N° 263500" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mb-details">Détails</Label>
            <Input id="mb-details" value={v.details} onChange={(e) => set("details", e.target.value)} placeholder="Ex. CHEQUE 3200117" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mb-ref">Réf.</Label>
            <Input id="mb-ref" value={v.reference} onChange={(e) => set("reference", e.target.value)} placeholder="Ex. VTE 05-2026" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mb-piece">N° pièce</Label>
            <Input id="mb-piece" value={v.numPiece} onChange={(e) => set("numPiece", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select
              value={v.type}
              onValueChange={(t) => {
                setTypeTouche(true);
                set("type", t as TypeMouvementBancaire);
              }}
            >
              <SelectTrigger aria-label="Type de mouvement">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_LABELS).map(([k, l]) => (
                  <SelectItem key={k} value={k}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Sens</Label>
            <Select value={sens} onValueChange={(s) => setSens(s as "debit" | "credit")}>
              <SelectTrigger aria-label="Sens du mouvement">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="debit">Débit (sortie)</SelectItem>
                <SelectItem value="credit">Crédit (entrée)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mb-montant">Montant ({devise})</Label>
            <AmountInput id="mb-montant" value={montant} allowNegative={false} onValueChange={setMontant} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            type="button"
            variant="ledger"
            disabled={saving || !valide}
            onClick={async () => {
              setSaving(true);
              try {
                await onSubmit({
                  dateOp: v.dateOp,
                  dateValeur: v.dateValeur,
                  libelle: v.libelle.trim(),
                  details: v.details.trim(),
                  reference: v.reference.trim(),
                  numPiece: v.numPiece.trim(),
                  debit: sens === "debit" ? montant : 0,
                  credit: sens === "credit" ? montant : 0,
                  type: v.type,
                });
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

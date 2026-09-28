import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AmountInput } from "@/components/common/AmountInput";
import { DEVISES } from "@/lib/soucheCheques/model";
import type { SoucheChequeInput } from "@/store/soucheCheques";
import type { SoucheCheque, SoucheChequeDevise } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  ligne?: SoucheCheque | null;
  /** Banques déjà saisies pour cette société (suggestions). */
  banques: string[];
  /** Rejette en cas d'erreur (ex. n° déjà existant) : le formulaire reste ouvert. */
  onSubmit: (data: SoucheChequeInput) => Promise<void>;
}

const today = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const empty = (): SoucheChequeInput => ({
  banque: "",
  numCheque: "",
  dateEmission: today(),
  beneficiaire: "",
  motif: "",
  montant: 0,
  devise: "TND",
  debite: false,
  dateDebit: null,
});

const fromLigne = (l: SoucheCheque): SoucheChequeInput => ({
  banque: l.banque,
  numCheque: l.numCheque,
  dateEmission: l.dateEmission,
  beneficiaire: l.beneficiaire,
  motif: l.motif,
  montant: l.montant,
  devise: l.devise,
  debite: l.debite,
  dateDebit: l.dateDebit,
});

export function SoucheChequeFormSheet({ open, onOpenChange, ligne, banques, onSubmit }: Props) {
  const isEdit = Boolean(ligne);
  const [v, setV] = useState<SoucheChequeInput>(empty());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setV(ligne ? fromLigne(ligne) : empty());
  }, [open, ligne]);

  function set<K extends keyof SoucheChequeInput>(key: K, value: SoucheChequeInput[K]) {
    setV((s) => ({ ...s, [key]: value }));
  }

  async function submit() {
    if (!v.numCheque.trim()) {
      toast.error("Le n° de chèque est obligatoire.");
      return;
    }
    if (!(v.montant > 0)) {
      toast.error("Saisissez le montant du chèque.");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        ...v,
        dateDebit: v.debite ? v.dateDebit || today() : null,
      });
      onOpenChange(false);
    } catch {
      // le store a déjà affiché l'erreur (doublon, réseau…) : on garde la saisie
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Modifier le chèque" : "Nouveau chèque"}</SheetTitle>
          <SheetDescription>
            Une ligne de la souche de chèques : émission, bénéficiaire, montant et statut de débit.
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Banque</Label>
              <Input
                list="souche-banques"
                value={v.banque}
                onChange={(e) => set("banque", e.target.value)}
                placeholder="Ex. BIAT, STB, Attijari…"
              />
              <datalist id="souche-banques">
                {banques.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label>N° de chèque</Label>
              <Input
                value={v.numCheque}
                onChange={(e) => set("numCheque", e.target.value)}
                placeholder="Ex. 0000001"
                className="font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Date d'émission</Label>
            <Input
              type="date"
              value={v.dateEmission ?? ""}
              onChange={(e) => set("dateEmission", e.target.value || null)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Bénéficiaire</Label>
            <Input
              value={v.beneficiaire}
              onChange={(e) => set("beneficiaire", e.target.value)}
              placeholder="Ex. Fournisseur ACME"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Motif / Description</Label>
            <Textarea
              rows={2}
              value={v.motif}
              onChange={(e) => set("motif", e.target.value)}
              placeholder="Ex. Achat matières premières, loyer septembre…"
            />
          </div>

          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <div className="space-y-1.5">
              <Label>Montant</Label>
              <AmountInput
                value={v.montant}
                onValueChange={(n) => set("montant", n)}
                allowNegative={false}
                className="text-right tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Devise</Label>
              <Select value={v.devise} onValueChange={(d) => set("devise", d as SoucheChequeDevise)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEVISES.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Débité ?</Label>
              <Select
                value={v.debite ? "oui" : "non"}
                onValueChange={(val) =>
                  setV((s) => ({
                    ...s,
                    debite: val === "oui",
                    dateDebit: val === "oui" ? s.dateDebit || today() : null,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="non">Non</SelectItem>
                  <SelectItem value="oui">Oui</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {v.debite && (
              <div className="space-y-1.5">
                <Label>Date de débit</Label>
                <Input
                  type="date"
                  value={v.dateDebit ?? ""}
                  onChange={(e) => set("dateDebit", e.target.value || null)}
                />
              </div>
            )}
          </div>
        </SheetBody>

        <SheetFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="button" variant="ledger" disabled={saving} onClick={submit}>
            {saving ? "Enregistrement…" : isEdit ? "Enregistrer" : "Ajouter le chèque"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

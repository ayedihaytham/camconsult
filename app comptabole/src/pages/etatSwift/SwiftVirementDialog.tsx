import { useEffect, useState } from "react";
import { Banknote, Building2, CalendarDays, Coins, Globe, Send, Text } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AmountInput } from "@/components/common/AmountInput";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { VirementInput } from "@/store/etatSwift";
import type { SwiftVirement } from "@/types";

const aujourdhui = () => new Date().toISOString().slice(0, 10);

function Champ({ id, label, icone: Icone, children }: { id: string; label: string; icone: typeof Text; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icone className="size-3.5" aria-hidden="true" />
        {label}
      </Label>
      {children}
    </div>
  );
}

/** Carte du comptable : le montant sorti de la banque en dinars, que la société détaillera par ses factures d'achat. */
export function SwiftVirementDialog({
  open,
  onOpenChange,
  virement,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  virement: SwiftVirement | null;
  onSubmit: (data: VirementInput) => Promise<void>;
}) {
  const [date, setDate] = useState(aujourdhui());
  const [montant, setMontant] = useState(0);
  const [libelle, setLibelle] = useState("");
  const [banque, setBanque] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDate(virement?.date ?? aujourdhui());
    setMontant(virement?.montant ?? 0);
    setLibelle(virement?.libelle ?? "");
    setBanque(virement?.banque ?? "");
    setErreur(null);
    setBusy(false);
  }, [open, virement]);

  async function valider(envoyer: boolean) {
    if (!date) return setErreur("La date est obligatoire.");
    if (!(montant > 0)) return setErreur("Le montant en dinar doit être supérieur à 0.");
    if (!libelle.trim()) return setErreur("Le libellé est obligatoire.");
    if (!banque.trim()) return setErreur("La banque est obligatoire.");
    setBusy(true);
    try {
      await onSubmit({ date, montant, libelle: libelle.trim(), banque: banque.trim(), envoyer });
      onOpenChange(false);
    } catch {
      setBusy(false);
    }
  }

  const dejaEnvoye = Boolean(virement?.envoye);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[540px] gap-0 p-0">
        <DialogHeader className="border-b border-border px-5 py-4 pr-12 text-left">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Globe className="size-5 text-accent" aria-hidden="true" />
            {virement ? "Modifier le virement SWIFT" : "Nouveau virement SWIFT"}
          </DialogTitle>
          <DialogDescription>Indiquez le montant sorti de la banque. La société détaillera les factures d'achat qui le composent.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3.5 px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Champ id="swift-date" label="Date" icone={CalendarDays}>
              <Input id="swift-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Champ>
            <Champ id="swift-montant" label="Montant en dinar (TND)" icone={Coins}>
              <AmountInput id="swift-montant" className="text-right tabular-nums" value={montant} onValueChange={setMontant} allowNegative={false} />
            </Champ>
          </div>
          <Champ id="swift-libelle" label="Libellé" icone={Text}>
            <Input id="swift-libelle" value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="Ex. Règlement fournisseurs import" />
          </Champ>
          <Champ id="swift-banque" label="Banque" icone={Building2}>
            <Input id="swift-banque" value={banque} onChange={(e) => setBanque(e.target.value)} placeholder="Ex. BIAT" />
          </Champ>
          <p className="flex items-start gap-2 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-[13px] text-foreground">
            <Send className="mt-0.5 size-4 shrink-0 text-accent-foreground" aria-hidden="true" />
            <span>
              <b>Enregistrer et envoyer</b> prévient la société par notification. Sinon le virement reste dans votre brouillon, invisible pour elle.
            </span>
          </p>
          {erreur && (
            <p role="alert" className="text-sm text-destructive">
              {erreur}
            </p>
          )}
        </div>
        <DialogFooter className="items-center gap-2 border-t border-border bg-muted/40 px-5 py-3 sm:justify-end">
          <span className="mr-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <Banknote className="size-3.5" aria-hidden="true" />
            Montants à 3 décimales
          </span>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={() => void valider(false)}>
            Enregistrer
          </Button>
          {!dejaEnvoye && (
            <Button type="button" className="gap-2" disabled={busy} onClick={() => void valider(true)}>
              <Send className="size-4" aria-hidden="true" />
              Enregistrer et envoyer
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

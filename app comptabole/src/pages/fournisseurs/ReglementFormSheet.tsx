import { useEffect, useMemo, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AmountInput } from "@/components/common/AmountInput";
import { calculerRs, MODE_LABELS, soldesFactures, type ReglementPrefill } from "@/lib/fournisseurs";
import { facturesCitees } from "@/lib/banque";
import { fmtMontant } from "@/lib/stockRecap";
import { formatDate } from "@/lib/utils";
import type { ReglementInput } from "@/store/fournisseurs";
import type { FactureFournisseur, ModeReglement, ReglementFournisseur } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  societeId: string;
  fournisseurCle: string;
  fournisseurNom: string;
  /** Factures de ce fournisseur. */
  factures: FactureFournisseur[];
  /** Tous les règlements de la société (pour connaître le solde de chaque facture). */
  reglements: ReglementFournisseur[];
  /** Règlement à modifier, ou null pour un nouveau. */
  reglement: ReglementFournisseur | null;
  /** Paiement bancaire d'où vient ce nouveau règlement (ignoré en modification). */
  initial?: ReglementPrefill | null;
  /** Rejette en cas d'échec : le formulaire reste ouvert avec la saisie. */
  onSubmit: (data: ReglementInput) => Promise<void>;
}

const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

export function ReglementFormSheet({
  open,
  onOpenChange,
  societeId,
  fournisseurCle,
  fournisseurNom,
  factures,
  reglements,
  reglement,
  initial = null,
  onSubmit,
}: Props) {
  const soldes = useMemo(() => soldesFactures(factures, reglements), [factures, reglements]);
  const dejaAffecte = (id: string) => reglement?.affectations.find((a) => a.mouvementId === id)?.montant ?? 0;
  /** Part de la facture qu'on peut encore régler (en modifiant, on récupère la part de ce règlement). */
  const disponible = (f: FactureFournisseur) => round3((soldes.get(f.id)?.solde ?? f.montant) + dejaAffecte(f.id));

  const devises = useMemo(() => [...new Set(factures.map((f) => f.devise))], [factures]);
  const [devise, setDevise] = useState("TND");
  const [date, setDate] = useState("");
  const [mode, setMode] = useState<ModeReglement>("virement");
  const [reference, setReference] = useState("");
  const [banque, setBanque] = useState("");
  const [cours, setCours] = useState(0);
  const [rsTaux, setRsTaux] = useState(1);
  const [rsMontant, setRsMontant] = useState(0);
  const [rsTouche, setRsTouche] = useState(false);
  const [rsNumero, setRsNumero] = useState("");
  const [note, setNote] = useState("");
  const [choix, setChoix] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  // Réinitialise à l'ouverture : valeurs du règlement modifié, ou du dernier règlement du fournisseur.
  useEffect(() => {
    if (!open) return;
    const dernier = [...reglements].reverse().find((r) => r.fournisseurCle === fournisseurCle);
    const source = reglement ?? null;
    const dev = source?.devise ?? factures.find((f) => disponible(f) > 0.0015)?.devise ?? devises[0] ?? "TND";
    setDevise(dev);
    setDate(source?.date ?? "");
    setMode(source?.mode ?? "virement");
    setReference(source?.reference ?? "");
    setBanque(source?.banque ?? dernier?.banque ?? "");
    setCours(source?.cours ?? 0);
    setRsTaux(source ? source.rsTaux : (dernier?.rsTaux ?? 1));
    setRsMontant(source?.rsMontant ?? 0);
    setRsTouche(Boolean(source));
    setRsNumero(source?.rsNumero ?? "");
    setNote(source?.note ?? "");
    setChoix(Object.fromEntries((source?.affectations ?? []).map((a) => [a.mouvementId, a.montant])));

    if (!source && initial) {
      // Règlement préparé d'après un paiement bancaire : date, mode, référence, banque, factures citées
      // dans le libellé, et retenue à la source = ce que le virement n'a pas couvert.
      const devisePaiement = devises.includes(initial.devise) ? initial.devise : dev;
      const citees = facturesCitees(
        initial.libelle,
        factures.filter((f) => f.devise === devisePaiement && disponible(f) > 0.0015),
      );
      const selection = Object.fromEntries(citees.map((id) => [id, disponible(factures.find((f) => f.id === id)!)]));
      const total = round3(Object.values(selection).reduce((s, m) => s + m, 0));
      const rs = total > 0 ? Math.max(0, round3(total - initial.montant)) : 0;
      setDevise(devisePaiement);
      setDate(initial.date);
      setMode(/CHEQ/i.test(initial.libelle) ? "cheque" : "virement");
      setReference(initial.reference);
      if (initial.banque) setBanque(initial.banque);
      setChoix(selection);
      if (rs > 0) {
        setRsTaux(round3((rs / total) * 100));
        setRsMontant(rs);
        setRsTouche(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reglement?.id, initial?.mouvementId]);

  const candidates = factures.filter((f) => f.devise === devise && (disponible(f) > 0.0015 || f.id in choix));
  const brut = round3(Object.values(choix).reduce((s, m) => s + m, 0));

  // Tant que la retenue n'a pas été corrigée à la main, elle suit le taux et le total choisi.
  useEffect(() => {
    if (!rsTouche) setRsMontant(calculerRs(brut, rsTaux));
  }, [brut, rsTaux, rsTouche]);

  const vire = round3(brut - rsMontant);
  const invalide = brut <= 0 || rsMontant > brut;

  function basculer(f: FactureFournisseur, coche: boolean) {
    setChoix((c) => {
      const suite = { ...c };
      if (coche) suite[f.id] = disponible(f);
      else delete suite[f.id];
      return suite;
    });
  }

  async function enregistrer() {
    setSaving(true);
    try {
      await onSubmit({
        societeId,
        fournisseurCle,
        dateReglement: date || null,
        mode,
        reference: reference.trim(),
        banque: banque.trim(),
        devise,
        cours: devise === "TND" ? 0 : cours,
        rsTaux,
        rsNumero: rsNumero.trim(),
        rsMontant,
        note: note.trim(),
        mouvementBancaireId: reglement ? reglement.mouvementBancaireId : (initial?.mouvementId ?? null),
        affectations: Object.entries(choix).map(([mouvementId, montant]) => ({ mouvementId, montant })),
      });
      onOpenChange(false);
    } catch {
      // le store a déjà affiché l'erreur : la saisie est conservée
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{reglement ? "Modifier le règlement" : "Nouveau règlement"}</SheetTitle>
          <SheetDescription>
            {fournisseurNom} — un règlement peut couvrir plusieurs factures ; la retenue à la source est déduite du virement.
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="space-y-4">
          {initial && !reglement && (
            <p className="rounded-md border border-accent/30 bg-accent/[0.07] px-3 py-2 text-sm text-foreground" role="status">
              Paiement bancaire du {formatDate(initial.date)} : <strong className="tabular-nums">{fmtMontant(initial.montant)} {initial.devise}</strong>
              {initial.libelle && <span className="block truncate text-xs text-muted-foreground">{initial.libelle}</span>}
              {brut > 0 && Math.abs(vire - initial.montant) > 0.0015 && (
                <span className="block text-xs text-destructive">
                  Écart avec le montant viré ci-dessous : {fmtMontant(round3(vire - initial.montant))} {initial.devise} — vérifiez les factures et la retenue.
                </span>
              )}
            </p>
          )}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rg-date">Date</Label>
              <Input id="rg-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as ModeReglement)}>
                <SelectTrigger aria-label="Mode de règlement">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MODE_LABELS).map(([k, l]) => (
                    <SelectItem key={k} value={k}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Devise</Label>
              <Select
                value={devise}
                onValueChange={(v) => {
                  setDevise(v);
                  setChoix({});
                }}
                disabled={devises.length < 2}
              >
                <SelectTrigger aria-label="Devise du règlement">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(devises.length ? devises : ["TND"]).map((d) => (
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
              <Label htmlFor="rg-ref">Référence (n° de chèque, de virement…)</Label>
              <Input id="rg-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Ex. CHQ N°4000110" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rg-banque">Banque</Label>
              <Input id="rg-banque" value={banque} onChange={(e) => setBanque(e.target.value)} placeholder="Ex. BTL" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Factures couvertes</Label>
            {candidates.length === 0 ? (
              <p className="rounded-md border border-dashed border-input px-3 py-4 text-sm text-muted-foreground">
                Aucune facture à régler en {devise} pour ce fournisseur.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-input">
                {candidates.map((f) => {
                  const coche = f.id in choix;
                  return (
                    <li key={f.id} className="flex items-center gap-3 px-3 py-2">
                      <Checkbox
                        checked={coche}
                        onCheckedChange={(c) => basculer(f, Boolean(c))}
                        aria-label={`Facture ${f.numFacture || "sans numéro"}`}
                      />
                      <span className="min-w-0 flex-1 text-sm">
                        <span className="block truncate font-medium text-foreground">{f.numFacture || "Sans numéro"}</span>
                        <span className="block text-xs text-muted-foreground">
                          {f.date ? formatDate(f.date) : "Sans date"} · reste {fmtMontant(disponible(f))} {f.devise}
                        </span>
                      </span>
                      {coche && (
                        <AmountInput
                          aria-label={`Montant réglé sur la facture ${f.numFacture}`}
                          className="h-8 w-32 text-right"
                          value={choix[f.id]}
                          allowNegative={false}
                          onValueChange={(m) => setChoix((c) => ({ ...c, [f.id]: m }))}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rg-taux">Retenue à la source (%)</Label>
              <AmountInput
                id="rg-taux"
                value={rsTaux}
                allowNegative={false}
                onValueChange={(t) => {
                  setRsTaux(t);
                  setRsTouche(false);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rg-rs">Montant RS</Label>
              <AmountInput
                id="rg-rs"
                value={rsMontant}
                allowNegative={false}
                onValueChange={(m) => {
                  setRsMontant(m);
                  setRsTouche(true);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rg-nrs">N° RS</Label>
              <Input id="rg-nrs" value={rsNumero} onChange={(e) => setRsNumero(e.target.value)} />
            </div>
          </div>

          {devise !== "TND" && (
            <div className="space-y-1.5">
              <Label htmlFor="rg-cours">Cours du jour (TND pour 1 {devise})</Label>
              <AmountInput id="rg-cours" decimals={5} allowNegative={false} value={cours} onValueChange={setCours} />
            </div>
          )}

          <dl className="grid grid-cols-3 gap-3 rounded-md border border-accent/30 bg-secondary/30 px-4 py-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Total des factures</dt>
              <dd className="font-semibold tabular-nums">
                {fmtMontant(brut)} {devise}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Retenue à la source</dt>
              <dd className="font-semibold tabular-nums">{fmtMontant(rsMontant)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Montant viré</dt>
              <dd className="font-bold tabular-nums text-primary">
                {fmtMontant(vire)} {devise}
                {devise !== "TND" && cours > 0 && (
                  <span className="block text-xs font-normal text-muted-foreground">≈ {fmtMontant(vire * cours)} TND</span>
                )}
              </dd>
            </div>
          </dl>

          <div className="space-y-1.5">
            <Label htmlFor="rg-note">Note</Label>
            <Textarea id="rg-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </SheetBody>

        <SheetFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="button" variant="ledger" disabled={saving || invalide} onClick={() => void enregistrer()}>
            {saving ? "Enregistrement…" : reglement ? "Enregistrer" : "Enregistrer le règlement"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

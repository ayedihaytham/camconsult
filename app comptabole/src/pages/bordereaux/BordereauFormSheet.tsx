import { useEffect, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BORDEREAU_TYPE_LABELS,
  BORDEREAU_VOLET_LABELS,
} from "@/types";
import type {
  Bordereau,
  BordereauLigne,
  BordereauType,
  BordereauVolet,
} from "@/types";
import type { BordereauInput } from "@/store/bordereaux";

type LigneDraft = Omit<BordereauLigne, "id">;

const emptyLigne = (): LigneDraft => ({
  ordre: 0,
  cheque: "",
  tiers: "",
  montant: 0,
  facture: "",
  remarque: "",
});

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  bordereau?: Bordereau | null;
  defaultType: BordereauType;
  onSubmit: (data: BordereauInput) => void;
}

export function BordereauFormSheet({
  open,
  onOpenChange,
  bordereau,
  defaultType,
  onSubmit,
}: Props) {
  const isEdit = Boolean(bordereau);
  const [type, setType] = useState<BordereauType>(defaultType);
  const [volet, setVolet] = useState<BordereauVolet>("client");
  const [numero, setNumero] = useState("");
  const [dateOperation, setDateOperation] = useState("");
  const [pointe, setPointe] = useState(false);
  const [note, setNote] = useState("");
  const [lignes, setLignes] = useState<LigneDraft[]>([emptyLigne()]);

  useEffect(() => {
    if (!open) return;
    if (bordereau) {
      setType(bordereau.type);
      setVolet(bordereau.volet);
      setNumero(bordereau.numero);
      setDateOperation(bordereau.dateOperation ?? "");
      setPointe(bordereau.pointe);
      setNote(bordereau.note);
      setLignes(
        bordereau.lignes.length
          ? bordereau.lignes.map((l) => ({ ...l }))
          : [emptyLigne()],
      );
    } else {
      setType(defaultType);
      setVolet("client");
      setNumero("");
      setDateOperation("");
      setPointe(false);
      setNote("");
      setLignes([emptyLigne()]);
    }
  }, [open, bordereau, defaultType]);

  const total = lignes.reduce((s, l) => s + (Number(l.montant) || 0), 0);

  function setLigne(i: number, patch: Partial<LigneDraft>) {
    setLignes((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function submit() {
    onSubmit({
      type,
      volet,
      numero: numero.trim(),
      dateOperation: dateOperation || null,
      pointe,
      note: note.trim(),
      lignes: lignes
        .filter((l) => l.tiers || l.cheque || Number(l.montant))
        .map((l, i) => ({ ...l, ordre: i, montant: Number(l.montant) || 0 })),
    });
    onOpenChange(false);
  }

  const selectTrigger =
    "mt-1 h-auto w-full border-0 bg-transparent p-0 text-base text-foreground shadow-none focus:ring-0 focus:ring-offset-0 [&>svg]:size-4 [&>svg]:text-muted-foreground";
  // Cases de saisie des lignes : cartes crème arrondies, comme les champs du reste du formulaire.
  const cell = "h-11 rounded-lg border-accent/35 bg-secondary/60 px-3 text-base focus-visible:border-primary focus-visible:bg-card";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-5xl flex-col gap-0 overflow-hidden rounded-2xl border-accent/30 p-0">
        <div className="shrink-0 border-b border-accent/30 px-6 pb-5 pt-6 sm:px-8">
          <DialogTitle className="pr-8 font-serif text-3xl font-medium text-primary">
            {isEdit ? "Modifier le bordereau" : "Nouveau bordereau"}
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            En-tête du bordereau puis ses lignes ; le sous-total se calcule tout seul.
          </DialogDescription>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6 sm:px-8">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <CardField id="bordereau-type" label="Type">
              <Select value={type} onValueChange={(v) => setType(v as BordereauType)}>
                <SelectTrigger id="bordereau-type" className={selectTrigger}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(BORDEREAU_TYPE_LABELS) as BordereauType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {BORDEREAU_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardField>
            <CardField id="bordereau-volet" label="Volet">
              <Select value={volet} onValueChange={(v) => setVolet(v as BordereauVolet)}>
                <SelectTrigger id="bordereau-volet" className={selectTrigger}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(BORDEREAU_VOLET_LABELS) as BordereauVolet[]).map((v) => (
                    <SelectItem key={v} value={v}>
                      {BORDEREAU_VOLET_LABELS[v]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardField>
            <CardField id="bordereau-numero" label="N° Bordereau">
              <input
                id="bordereau-numero"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="787115"
                className={CARD_FIELD_INPUT}
              />
            </CardField>
            <CardField id="bordereau-date" label="Date">
              <input
                id="bordereau-date"
                type="date"
                value={dateOperation}
                onChange={(e) => setDateOperation(e.target.value)}
                className={CARD_FIELD_INPUT}
              />
            </CardField>
          </div>

          <div className="overflow-hidden rounded-xl border border-accent/30 bg-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-sm">
                <thead className="bg-accent/[0.08] text-sm text-primary">
                  <tr>
                    <th className="w-12 px-3 py-3 text-left font-semibold">N°</th>
                    <th className="px-2 py-3 text-left font-semibold">Chq / Effet</th>
                    <th className="px-2 py-3 text-left font-semibold">
                      {volet === "client" ? "Client" : "Fournisseur"}
                    </th>
                    <th className="px-2 py-3 text-right font-semibold">Montant</th>
                    <th className="px-2 py-3 text-left font-semibold">Réf. facture</th>
                    <th className="px-2 py-3 text-left font-semibold">Remarque</th>
                    <th className="w-12 px-2 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((l, i) => (
                    <tr key={i} className="border-t border-accent/20">
                      <td className="px-3 py-2.5 text-base text-muted-foreground">{i + 1}</td>
                      <td className="px-1.5 py-2.5">
                        <Input
                          className={cell}
                          aria-label={`Chèque ou effet, ligne ${i + 1}`}
                          value={l.cheque}
                          onChange={(e) => setLigne(i, { cheque: e.target.value })}
                        />
                      </td>
                      <td className="px-1.5 py-2.5">
                        <Input
                          className={cell}
                          aria-label={`${volet === "client" ? "Client" : "Fournisseur"}, ligne ${i + 1}`}
                          value={l.tiers}
                          onChange={(e) => setLigne(i, { tiers: e.target.value })}
                        />
                      </td>
                      <td className="px-1.5 py-2.5">
                        <AmountInput
                          className={`${cell} text-right`}
                          aria-label={`Montant, ligne ${i + 1}`}
                          value={l.montant ?? 0}
                          onValueChange={(n) => setLigne(i, { montant: n })}
                        />
                      </td>
                      <td className="px-1.5 py-2.5">
                        <Input
                          className={cell}
                          aria-label={`Référence facture, ligne ${i + 1}`}
                          value={l.facture}
                          onChange={(e) => setLigne(i, { facture: e.target.value })}
                          placeholder="219+217+218"
                        />
                      </td>
                      <td className="px-1.5 py-2.5">
                        <Input
                          className={cell}
                          aria-label={`Remarque, ligne ${i + 1}`}
                          value={l.remarque}
                          onChange={(e) => setLigne(i, { remarque: e.target.value })}
                          placeholder="NON / RS…"
                        />
                      </td>
                      <td className="px-1.5 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => setLignes((ls) => ls.filter((_, idx) => idx !== i))}
                          className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
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
            <div className="flex items-center justify-end gap-10 border-t border-accent/25 bg-accent/[0.05] px-5 py-4">
              <span className="text-base text-muted-foreground">Sous-total du bordereau</span>
              <span className="min-w-24 text-right text-xl font-bold tabular-nums text-primary">
                {total.toLocaleString("fr-FR", {
                  minimumFractionDigits: 3,
                  maximumFractionDigits: 3,
                })}
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-lg px-5"
            onClick={() => setLignes((ls) => [...ls, emptyLigne()])}
          >
            <Plus className="h-4 w-4 text-accent" />
            Ajouter une ligne
          </Button>

          <div className="grid items-center gap-4 sm:grid-cols-[1fr_auto]">
            <CardField id="bordereau-note" label="Note / observation du bordereau">
              <input
                id="bordereau-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className={`${CARD_FIELD_INPUT} min-h-8`}
              />
            </CardField>
            <label className="flex items-center gap-3 sm:px-2">
              <Checkbox
                checked={pointe}
                onCheckedChange={(c) => setPointe(Boolean(c))}
                className="size-5 rounded-md"
              />
              <span className="text-base text-foreground">Pointé / rapproché</span>
            </label>
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-3 border-t border-accent/30 px-6 py-4 sm:px-8">
          <Button type="button" variant="outline" className="h-12 rounded-lg px-6" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            type="button"
            variant="ledger"
            className="h-12 rounded-lg px-6 text-sm uppercase tracking-[0.14em]"
            onClick={submit}
          >
            {isEdit ? "Enregistrer" : "Créer le bordereau"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

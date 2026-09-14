import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>
            {isEdit ? "Modifier le bordereau" : "Nouveau bordereau"}
          </SheetTitle>
          <SheetDescription>
            En-tête du bordereau puis ses lignes ; le sous-total se calcule tout
            seul.
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="space-y-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as BordereauType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    Object.keys(BORDEREAU_TYPE_LABELS) as BordereauType[]
                  ).map((t) => (
                    <SelectItem key={t} value={t}>
                      {BORDEREAU_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Volet</Label>
              <Select
                value={volet}
                onValueChange={(v) => setVolet(v as BordereauVolet)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    Object.keys(BORDEREAU_VOLET_LABELS) as BordereauVolet[]
                  ).map((v) => (
                    <SelectItem key={v} value={v}>
                      {BORDEREAU_VOLET_LABELS[v]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>N° Bordereau</Label>
              <Input
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="787115"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input
                type="date"
                value={dateOperation}
                onChange={(e) => setDateOperation(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-10 px-2 py-2">N°</th>
                  <th className="px-2 py-2 text-left font-medium">CHQ / Effet</th>
                  <th className="px-2 py-2 text-left font-medium">
                    {volet === "client" ? "Client" : "Fournisseur"}
                  </th>
                  <th className="px-2 py-2 text-left font-medium">Montant</th>
                  <th className="px-2 py-2 text-left font-medium">Réf. facture</th>
                  <th className="px-2 py-2 text-left font-medium">Remarque</th>
                  <th className="w-10 px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lignes.map((l, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1 text-center text-xs text-muted-foreground">
                      {i + 1}
                    </td>
                    <td className="px-1.5 py-1">
                      <Input
                        className="h-8"
                        value={l.cheque}
                        onChange={(e) => setLigne(i, { cheque: e.target.value })}
                      />
                    </td>
                    <td className="px-1.5 py-1">
                      <Input
                        className="h-8"
                        value={l.tiers}
                        onChange={(e) => setLigne(i, { tiers: e.target.value })}
                      />
                    </td>
                    <td className="px-1.5 py-1">
                      <Input
                        className="h-8"
                        type="number"
                        inputMode="decimal"
                        value={String(l.montant ?? "")}
                        onChange={(e) =>
                          setLigne(i, {
                            montant:
                              e.target.value === ""
                                ? 0
                                : Number(e.target.value),
                          })
                        }
                      />
                    </td>
                    <td className="px-1.5 py-1">
                      <Input
                        className="h-8"
                        value={l.facture}
                        onChange={(e) => setLigne(i, { facture: e.target.value })}
                        placeholder="219+217+218"
                      />
                    </td>
                    <td className="px-1.5 py-1">
                      <Input
                        className="h-8"
                        value={l.remarque}
                        onChange={(e) =>
                          setLigne(i, { remarque: e.target.value })
                        }
                        placeholder="NON / RS…"
                      />
                    </td>
                    <td className="px-1.5 py-1">
                      <button
                        onClick={() =>
                          setLignes((ls) => ls.filter((_, idx) => idx !== i))
                        }
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/30 font-medium">
                  <td colSpan={3} className="px-2 py-2 text-right text-muted-foreground">
                    Sous-total du bordereau
                  </td>
                  <td className="px-2 py-2">
                    {total.toLocaleString("fr-FR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setLignes((ls) => [...ls, emptyLigne()])}
          >
            <Plus className="h-4 w-4" />
            Ajouter une ligne
          </Button>

          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1.5">
              <Label>Note / observation du bordereau</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <label className="flex items-end gap-2 pb-2">
              <Checkbox
                checked={pointe}
                onCheckedChange={(c) => setPointe(Boolean(c))}
              />
              <span className="text-sm text-foreground">Pointé / rapproché</span>
            </label>
          </div>
        </SheetBody>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button variant="ledger" onClick={submit}>
            {isEdit ? "Enregistrer" : "Créer le bordereau"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

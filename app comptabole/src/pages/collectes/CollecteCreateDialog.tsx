import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useSocietes } from "@/store/data";
import { COLLECTE_TABS } from "@/lib/collecte/tabs";

interface CollecteFormData {
  societeId: string;
  periode: string;
  onglets: string[];
  devise: string;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreate: (data: CollecteFormData) => void;
  /** présent = mode édition (société figée) */
  initial?: CollecteFormData;
}

export function CollecteCreateDialog({
  open,
  onOpenChange,
  onCreate,
  initial,
}: Props) {
  const societes = useSocietes();
  const isEdit = Boolean(initial);
  const [societeId, setSocieteId] = useState("");
  const [periode, setPeriode] = useState("");
  const [devise, setDevise] = useState("EUR");
  const [onglets, setOnglets] = useState<string[]>(
    COLLECTE_TABS.map((t) => t.key),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSocieteId(initial?.societeId ?? "");
    setPeriode(initial?.periode ?? "");
    setDevise(initial?.devise ?? "EUR");
    setOnglets(initial?.onglets ?? COLLECTE_TABS.map((t) => t.key));
    setError(null);
  }, [open, initial]);

  function toggle(key: string) {
    setOnglets((o) =>
      o.includes(key) ? o.filter((k) => k !== key) : [...o, key],
    );
  }

  function submit() {
    if (!societeId) return setError("Choisissez une société.");
    if (periode.trim().length < 1) return setError("Indiquez une période.");
    if (onglets.length === 0)
      return setError("Sélectionnez au moins un tableau.");
    onCreate({ societeId, periode: periode.trim(), onglets, devise });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifier la collecte" : "Nouvelle collecte de pièces"}
          </DialogTitle>
          <DialogDescription>
            Choisissez le client, la période et les tableaux qu'il devra
            remplir.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Société cliente</Label>
              <Select
                value={societeId}
                onValueChange={setSocieteId}
                disabled={isEdit}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir…" />
                </SelectTrigger>
                <SelectContent>
                  {societes.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.raisonSociale}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Devise</Label>
              <Select value={devise} onValueChange={setDevise}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EUR">€ (euro)</SelectItem>
                  <SelectItem value="TND">DT (dinar tunisien)</SelectItem>
                  <SelectItem value="USD">$ (dollar américain)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Période concernée</Label>
            <Input
              value={periode}
              onChange={(e) => setPeriode(e.target.value)}
              placeholder="Ex. Janvier 2026, T1 2026, Exercice 2025…"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Tableaux demandés</Label>
              <button
                type="button"
                className="text-xs font-bold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
                onClick={() =>
                  setOnglets(
                    onglets.length === COLLECTE_TABS.length
                      ? []
                      : COLLECTE_TABS.map((t) => t.key),
                  )
                }
              >
                {onglets.length === COLLECTE_TABS.length
                  ? "Tout décocher"
                  : "Tout cocher"}
              </button>
            </div>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border p-2">
              {COLLECTE_TABS.map((t) => (
                <label
                  key={t.key}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-secondary"
                >
                  <Checkbox
                    checked={onglets.includes(t.key)}
                    onCheckedChange={() => toggle(t.key)}
                  />
                  <span className="text-sm text-foreground">{t.label}</span>
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button variant="ledger" onClick={submit}>
            {isEdit ? "Enregistrer" : "Créer la collecte"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

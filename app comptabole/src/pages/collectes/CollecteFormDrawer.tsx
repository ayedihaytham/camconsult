import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
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
import { useSocietes } from "@/store/data";
import { usePermissions } from "@/hooks/usePermissions";
import { COLLECTE_TABS } from "@/lib/collecte/tabs";

interface CollecteFormData {
  societeId: string;
  periode: string;
  onglets: string[];
  devise: string;
  echeance: string | null;
  relanceCadenceJours: number;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreate: (data: CollecteFormData) => Promise<void>;
  /** présent = mode édition (société figée) */
  initial?: CollecteFormData;
}

export function CollecteFormDrawer({
  open,
  onOpenChange,
  onCreate,
  initial,
}: Props) {
  const { canSeeSociete } = usePermissions();
  const societes = useSocietes().filter((s) => canSeeSociete(s.id));
  const isEdit = Boolean(initial);
  const [societeId, setSocieteId] = useState("");
  const [periode, setPeriode] = useState("");
  const [devise, setDevise] = useState("TND");
  const [echeance, setEcheance] = useState("");
  const [relanceCadenceJours, setRelanceCadenceJours] = useState(3);
  const [onglets, setOnglets] = useState<string[]>(
    COLLECTE_TABS.map((t) => t.key),
  );
  const [error, setError] = useState<string | null>(null);
  const submissionError =
    error ===
    "Enregistrement impossible. Vérifiez votre connexion puis réessayez."
      ? error
      : null;
  const [submitting, setSubmitting] = useState(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setSocieteId(initial?.societeId ?? "");
    setPeriode(initial?.periode ?? "");
    setDevise(initial?.devise ?? "TND");
    setEcheance(initial?.echeance ?? "");
    setRelanceCadenceJours(initial?.relanceCadenceJours ?? 3);
    setOnglets(initial?.onglets ?? COLLECTE_TABS.map((t) => t.key));
    setError(null);
  }, [open]);

  function toggle(key: string) {
    setOnglets((o) =>
      o.includes(key) ? o.filter((k) => k !== key) : [...o, key],
    );
  }

  async function submit() {
    if (submitting) return;
    if (!societeId) return setError("Choisissez une société.");
    if (onglets.length === 0) {
      return setError("Sélectionnez au moins un tableau.");
    }

    setError(null);
    setSubmitting(true);
    try {
      await onCreate({
        societeId,
        periode: periode.trim(),
        onglets,
        devise,
        echeance: echeance || null,
        relanceCadenceJours,
      });
      onOpenChange(false);
    } catch {
      setError("Enregistrement impossible. Vérifiez votre connexion puis réessayez.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (submitting && !nextOpen) return;
        onOpenChange(nextOpen);
      }}
    >
      <SheetContent
        side="right"
        className="h-dvh w-full max-w-[580px] gap-0 overflow-hidden rounded-none p-0 sm:max-w-[580px]"
        onOpenAutoFocus={() => {
          const activeElement = document.activeElement;
          returnFocusRef.current =
            activeElement instanceof HTMLElement ? activeElement : null;
        }}
        onCloseAutoFocus={(event) => {
          const returnFocus = returnFocusRef.current;
          returnFocusRef.current = null;
          if (returnFocus?.isConnected) {
            event.preventDefault();
            returnFocus.focus();
          }
        }}
      >
        <SheetHeader className="shrink-0 pr-12">
          <SheetTitle>
            {isEdit ? "Modifier la collecte" : "Nouvelle collecte de pièces"}
          </SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Modifiez les paramètres de cette collecte."
              : "Choisissez le client, la période et les tableaux qu'il devra remplir."}
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="space-y-5 px-5 py-5 sm:px-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="collecte-societe">Société cliente</Label>
              <Select
                value={societeId}
                onValueChange={setSocieteId}
                disabled={isEdit || submitting}
              >
                <SelectTrigger
                  id="collecte-societe"
                  aria-invalid={error === "Choisissez une société."}
                  aria-describedby={
                    error === "Choisissez une société."
                      ? "collecte-societe-error"
                      : undefined
                  }
                >
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
              {error === "Choisissez une société." && (
                <p id="collecte-societe-error" role="alert" className="text-xs text-destructive">
                  {error}
                </p>
              )}
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="collecte-devise">Devise</Label>
              <Select value={devise} onValueChange={setDevise} disabled={submitting}>
                <SelectTrigger id="collecte-devise">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TND">DT (dinar tunisien)</SelectItem>
                  <SelectItem value="EUR">€ (euro)</SelectItem>
                  <SelectItem value="USD">$ (dollar américain)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="collecte-periode">Période concernée (optionnel)</Label>
              <Input
                id="collecte-periode"
                value={periode}
                onChange={(e) => setPeriode(e.target.value)}
                disabled={submitting}
                placeholder="Ex. Janvier 2026, T1 2026, Exercice 2025…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="collecte-echeance">Échéance (optionnel)</Label>
              <Input
                id="collecte-echeance"
                type="date"
                value={echeance}
                onChange={(e) => setEcheance(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          {echeance && (
            <div className="space-y-1.5">
              <Label htmlFor="collecte-relance">Rythme des relances automatiques</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  id="collecte-relance"
                  min={1}
                  max={30}
                  className="w-20"
                  value={relanceCadenceJours}
                  disabled={submitting}
                  onChange={(e) =>
                    setRelanceCadenceJours(
                      Math.min(30, Math.max(1, Number(e.target.value) || 3)),
                    )
                  }
                />
                <span className="text-sm text-muted-foreground">
                  jour(s) entre deux relances, une fois l'échéance dépassée
                </span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label id="collecte-tableaux-label">Tableaux demandés</Label>
              <button
                type="button"
                className="text-xs font-bold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
                disabled={submitting}
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
            <div
              className="space-y-1 border-y border-border py-1"
              role="group"
              aria-labelledby="collecte-tableaux-label"
              aria-describedby={
                error === "Sélectionnez au moins un tableau."
                  ? "collecte-tableaux-error"
                  : undefined
              }
              aria-invalid={error === "Sélectionnez au moins un tableau."}
            >
              {COLLECTE_TABS.map((t) => (
                <label
                  key={t.key}
                  className="flex min-h-10 cursor-pointer items-center gap-2.5 px-2 py-1.5 hover:bg-secondary/70"
                >
                  <Checkbox
                    checked={onglets.includes(t.key)}
                    disabled={submitting}
                    onCheckedChange={() => toggle(t.key)}
                  />
                  <span className="text-sm text-foreground">{t.label}</span>
                </label>
              ))}
            </div>
            {error === "Sélectionnez au moins un tableau." && (
              <p id="collecte-tableaux-error" role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
          </div>

        </SheetBody>

        <SheetFooter className="shrink-0 flex-col items-stretch gap-2 px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:px-6">
          {submissionError && (
            <p role="alert" className="text-xs text-destructive">
              {submissionError}
            </p>
          )}
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 px-4"
              disabled={submitting}
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="ledger"
              className="min-h-11 px-5"
              disabled={submitting}
              aria-busy={submitting}
              onClick={() => void submit()}
            >
              {submitting && <LoaderCircle className="animate-spin" aria-hidden="true" />}
              {submitting
                ? "Enregistrement…"
                : isEdit
                  ? "Enregistrer"
                  : "Créer la collecte"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

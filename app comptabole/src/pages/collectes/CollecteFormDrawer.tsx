import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { periodeMois, periodesSuggerees } from "@/lib/collecte/periodes";
import { useSocietes } from "@/store/data";
import { usePermissions } from "@/hooks/usePermissions";
import { CollecteTableSelection } from "./CollecteTableSelection";

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
  /** Société proposée à la création (société active). */
  defaultSocieteId?: string;
}

export function CollecteFormDrawer({
  open,
  onOpenChange,
  onCreate,
  initial,
  defaultSocieteId,
}: Props) {
  const { canSeeSociete } = usePermissions();
  const societes = useSocietes().filter((s) => canSeeSociete(s.id));
  const isEdit = Boolean(initial);
  const [societeId, setSocieteId] = useState("");
  const [periode, setPeriode] = useState("");
  const [devise, setDevise] = useState("TND");
  const [echeance, setEcheance] = useState("");
  const [relanceCadenceJours, setRelanceCadenceJours] = useState(3);
  const [onglets, setOnglets] = useState<string[]>([]);
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
    setSocieteId(initial?.societeId ?? defaultSocieteId ?? "");
    setPeriode(initial ? initial.periode : periodeMois(new Date()));
    setDevise(initial?.devise ?? "TND");
    setEcheance(initial?.echeance ?? "");
    setRelanceCadenceJours(initial?.relanceCadenceJours ?? 3);
    setOnglets(initial?.onglets ?? []);
    setError(null);
  }, [open]);

  async function submit() {
    if (submitting) return;
    if (!societeId) return setError("Choisissez une société.");
    if (!periode.trim()) return setError("La période est obligatoire : elle identifie la collecte.");
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
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (submitting && !nextOpen) return;
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        className="flex max-h-[90dvh] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-0 overflow-hidden rounded-xl p-0"
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
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 pr-12 sm:px-6">
          <DialogTitle>
            {isEdit ? "Modifier la collecte" : "Nouvelle collecte de pièces"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Modifiez les paramètres de cette collecte."
              : "Choisissez le client, la période et les tableaux qu'il devra remplir."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
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

          <div className="space-y-1.5">
            <Label htmlFor="collecte-periode">Période concernée <span className="text-destructive" aria-hidden="true">*</span></Label>
            <Input
              id="collecte-periode"
              value={periode}
              onChange={(e) => { setPeriode(e.target.value); if (error?.startsWith("La période")) setError(null); }}
              disabled={submitting}
              required
              aria-invalid={error?.startsWith("La période") ? true : undefined}
              aria-describedby={error?.startsWith("La période") ? "collecte-periode-error" : undefined}
              placeholder="Ex. Octobre 2026, T3 2026, Exercice 2025"
            />
            <div className="flex flex-wrap gap-1.5 pt-1" role="group" aria-label="Périodes proposées">
              {periodesSuggerees(new Date()).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  disabled={submitting}
                  onClick={() => { setPeriode(suggestion); setError(null); }}
                  className={`min-h-8 rounded-full border px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${periode.trim() === suggestion ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-accent"}`}
                >
                  {suggestion}
                </button>
              ))}
            </div>
            {error?.startsWith("La période") && <p id="collecte-periode-error" role="alert" className="text-xs text-destructive">{error}</p>}
          </div>

          <section className="space-y-3 rounded-lg border border-border bg-muted/10 p-3.5">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Paramètres facultatifs</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Les valeurs par défaut conviennent à la plupart des collectes.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="collecte-devise">Devise</Label>
              <Select value={devise} onValueChange={setDevise} disabled={submitting}>
                <SelectTrigger id="collecte-devise"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TND">DT (dinar tunisien)</SelectItem>
                  <SelectItem value="EUR">€ (euro)</SelectItem>
                  <SelectItem value="USD">$ (dollar américain)</SelectItem>
                </SelectContent>
              </Select>
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
            </div>
          </section>

          <CollecteTableSelection
            selected={onglets}
            disabled={submitting}
            error={error === "Sélectionnez au moins un tableau." ? error : undefined}
            onChange={(keys) => {
              setOnglets(keys);
              if (error === "Sélectionnez au moins un tableau.") setError(null);
            }}
          />

        </div>

        <div className="shrink-0 flex-col items-stretch gap-2 border-t border-border px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:px-6">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}

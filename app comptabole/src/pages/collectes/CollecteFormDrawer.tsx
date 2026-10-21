import { useEffect, useRef, useState } from "react";
import { FileUp, LoaderCircle, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { lignesParTableau, type EcritureLivre } from "@/lib/collecte/grandLivre";
import { lireGrandLivrePdf } from "@/lib/collecte/lireGrandLivrePdf";
import { periodesSuggerees } from "@/lib/collecte/periodes";
import { TAB_BY_KEY, type TabRow } from "@/lib/collecte/tabs";
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
  envoiParLignes?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** `prerempli` : lignes à enregistrer dans chaque tableau de la nouvelle collecte (grand-livre importé à la création). */
  onCreate: (data: CollecteFormData, prerempli?: Record<string, TabRow[]>) => Promise<void>;
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
  const [envoiParLignes, setEnvoiParLignes] = useState(false);
  const [onglets, setOnglets] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const submissionError =
    error ===
    "Enregistrement impossible. Vérifiez votre connexion puis réessayez."
      ? error
      : null;
  const [submitting, setSubmitting] = useState(false);
  /** Grand-livre(s) importé(s) à la création : les écritures indiquent quels tableaux seront remplis. */
  const [livres, setLivres] = useState<{ nom: string; ecritures: EcritureLivre[] }[]>([]);
  const [lectureLivre, setLectureLivre] = useState(false);
  const [erreurLivre, setErreurLivre] = useState("");
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setSocieteId(initial?.societeId ?? defaultSocieteId ?? "");
    setPeriode(initial ? initial.periode : "");
    setDevise(initial?.devise ?? "TND");
    setEcheance(initial?.echeance ?? "");
    setRelanceCadenceJours(initial?.relanceCadenceJours ?? 3);
    setEnvoiParLignes(initial?.envoiParLignes ?? false);
    setOnglets(initial?.onglets ?? []);
    setError(null);
    setLivres([]);
    setErreurLivre("");
  }, [open]);

  // Une écriture lue deux fois (même fichier choisi deux fois) ne compte qu'une fois.
  const ecritures = [...new Map(livres.flatMap((l) => l.ecritures).map((e) => [e.origine, e])).values()];
  const detectes = Object.entries(lignesParTableau(ecritures)).map(([onglet, lignes]) => ({ onglet, n: lignes.length }));
  const nonImportables = ecritures.filter((e) => e.nature === "report" || e.nature === "autre").length;

  async function choisirLivres(e: React.ChangeEvent<HTMLInputElement>) {
    const fichiers = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (fichiers.length === 0) return;
    setLectureLivre(true);
    setErreurLivre("");
    const lus: { nom: string; ecritures: EcritureLivre[] }[] = [];
    for (const f of fichiers) {
      try {
        lus.push({ nom: f.name, ecritures: (await lireGrandLivrePdf(f)).ecritures });
      } catch (err) {
        setErreurLivre(`${f.name} : ${err instanceof Error ? err.message : "fichier illisible."}`);
      }
    }
    setLectureLivre(false);
    if (lus.length === 0) return;
    setLivres((courants) => [...courants, ...lus]);
    // Les tableaux que le grand-livre va remplir sont demandés d'office ; la sélection reste modifiable.
    const trouves = Object.keys(lignesParTableau(lus.flatMap((l) => l.ecritures)));
    setOnglets((courants) => [...new Set([...courants, ...trouves])]);
    setError(null);
  }

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
      const data = { societeId, periode: periode.trim(), onglets, devise, echeance: echeance || null, relanceCadenceJours, envoiParLignes };
      // Seuls les tableaux finalement demandés sont pré-remplis.
      const prerempli = lignesParTableau(ecritures, onglets);
      if (Object.keys(prerempli).length > 0) await onCreate(data, prerempli);
      else await onCreate(data);
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

          <div className="flex items-start gap-2.5 rounded-md border border-border bg-muted/30 p-3">
            <Checkbox
              id="collecte-envoi-lignes"
              className="mt-0.5"
              checked={envoiParLignes}
              disabled={submitting}
              onCheckedChange={(v) => setEnvoiParLignes(v === true)}
            />
            <div className="min-w-0">
              <Label htmlFor="collecte-envoi-lignes" className="cursor-pointer">Envoi par lignes</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Chaque ligne complétée par la société part au cabinet dès l'enregistrement (en vert pour vous) et disparaît de son tableau ;
                elle peut la reprendre en cas d'erreur.
              </p>
            </div>
          </div>
            </div>
          </section>

          {!isEdit && (
            <section className="space-y-3 rounded-lg border border-accent/30 bg-muted/10 p-3.5" aria-label="Grand-livre des comptes">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Grand-livre des comptes (facultatif)</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Importez le grand-livre (PDF Sage 100) : d'après les libellés, les tableaux à remplir (chèques, virements, effets) sont détectés, ajoutés à la sélection
                  ci-dessous et pré-remplis dès la création. Le document est lu dans votre navigateur, jamais envoyé au serveur.
                </p>
              </div>
              <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm font-medium transition-colors focus-within:ring-2 focus-within:ring-ring hover:border-accent/60 hover:bg-secondary">
                {lectureLivre ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <FileUp className="size-4" aria-hidden="true" />}
                {lectureLivre ? "Lecture en cours…" : livres.length > 0 ? "Ajouter un autre grand-livre" : "Choisir un grand-livre (.pdf)"}
                <input type="file" accept=".pdf,application/pdf" multiple disabled={submitting || lectureLivre} className="sr-only" onChange={choisirLivres} />
              </label>
              {erreurLivre && <p role="alert" className="text-xs text-destructive">{erreurLivre}</p>}
              {livres.length > 0 && (
                <div className="space-y-2">
                  <ul className="flex flex-wrap gap-2">
                    {livres.map((l, i) => (
                      <li key={`${l.nom}-${i}`} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs">
                        {l.nom} · {l.ecritures.length} écritures
                        <button type="button" aria-label={`Retirer ${l.nom}`} disabled={submitting} className="rounded-sm text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setLivres((courants) => courants.filter((_, j) => j !== i))}>
                          <X className="size-3.5" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                  {detectes.length > 0 ? (
                    <p className="text-xs text-foreground" role="status">
                      Tableaux détectés : {detectes.map((d) => `${TAB_BY_KEY[d.onglet].label} (${d.n})`).join(" · ")}.
                      {nonImportables > 0 && ` ${nonImportables} écriture${nonImportables > 1 ? "s" : ""} (solde antérieur ou à classer) ne ${nonImportables > 1 ? "seront" : "sera"} pas importée${nonImportables > 1 ? "s" : ""}.`}
                    </p>
                  ) : (
                    <p className="text-xs text-warning" role="status">Aucune écriture de ce grand-livre ne correspond à un tableau de la collecte.</p>
                  )}
                </div>
              )}
            </section>
          )}

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

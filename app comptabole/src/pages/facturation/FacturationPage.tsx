import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Ban,
  CheckCircle2,
  Download,
  FileText,
  PenLine,
  Plus,
  Printer,
  RotateCcw,
  Search,
} from "lucide-react";
import { SignatureLedgerBanner } from "@/components/ledger/SignatureLedgerBanner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { exportToCsv, type ExportColumn } from "@/lib/export";
import { estEnRetard, formatTnd, imprimerFacture } from "@/lib/facturation";
import { cn, formatDate } from "@/lib/utils";
import { useFacturation, type FactureInput } from "@/store/facturation";
import { FACTURE_STATUT_LABELS } from "@/types";
import type { Facture, FactureStatut } from "@/types";
import { FactureFormSheet } from "./FactureFormSheet";

const selectTriggerClass =
  "h-11 w-auto min-w-[10rem] gap-2 rounded-lg border border-accent/35 bg-card px-4 text-base text-primary shadow-none focus:ring-0 data-[placeholder]:text-muted-foreground";

const iconButton =
  "flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/15 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const CSV_COLUMNS: ExportColumn<Facture>[] = [
  { header: "Client", value: (f) => f.societeNom },
  { header: "N°", value: (f) => f.numero },
  { header: "Émission", value: (f) => f.dateEmission },
  { header: "Échéance", value: (f) => f.echeance ?? "" },
  { header: "Total HT", value: (f) => f.totalHt.toFixed(3) },
  { header: "TVA", value: (f) => f.tva.toFixed(3) },
  { header: "Timbre fiscal", value: (f) => f.timbre.toFixed(3) },
  { header: "Net à payer", value: (f) => f.netAPayer.toFixed(3) },
  { header: "Statut", value: (f) => FACTURE_STATUT_LABELS[f.statut] },
  { header: "Signature", value: (f) => (f.signeeLe ? "Signée" : "Non signée") },
];

export function FacturationPage() {
  const list = useFacturation((s) => s.list);
  const loading = useFacturation((s) => s.loading);
  const fetchList = useFacturation((s) => s.fetchList);
  const create = useFacturation((s) => s.create);
  const update = useFacturation((s) => s.update);

  const [statut, setStatut] = useState<"all" | FactureStatut>("all");
  const [retardSeul, setRetardSeul] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [selection, setSelection] = useState<string[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [aAnnuler, setAAnnuler] = useState<Facture | null>(null);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const filtered = useMemo(() => {
    const q = recherche.trim().toLocaleLowerCase("fr");
    return list.filter((f) => {
      if (statut !== "all" && f.statut !== statut) return false;
      if (retardSeul && !estEnRetard(f)) return false;
      if (q && !`${f.societeNom} ${f.numero}`.toLocaleLowerCase("fr").includes(q)) return false;
      return true;
    });
  }, [list, statut, retardSeul, recherche]);

  const actives = list.filter((f) => f.statut !== "annulee");
  const facture = actives.reduce((s, f) => s + f.netAPayer, 0);
  const encaisse = list.filter((f) => f.statut === "payee").reduce((s, f) => s + f.netAPayer, 0);
  const nbRetard = list.filter((f) => estEnRetard(f)).length;

  const toutSelectionne = filtered.length > 0 && filtered.every((f) => selection.includes(f.id));

  async function generer(data: FactureInput) {
    const f = await create(data);
    toast.success(`Facture ${f.numero} générée`);
  }

  async function basculerPaiement(f: Facture) {
    await update(f.id, { statut: f.statut === "payee" ? "emise" : "payee" });
    toast.success(f.statut === "payee" ? "Paiement retiré" : `Facture ${f.numero} marquée payée`);
  }

  async function basculerSignature(f: Facture) {
    await update(f.id, { signee: !f.signeeLe });
  }

  function exporter() {
    const lignes = selection.length ? list.filter((f) => selection.includes(f.id)) : filtered;
    if (!lignes.length) return toast.error("Rien à exporter");
    exportToCsv("Factures", lignes, CSV_COLUMNS);
  }

  function imprimer(f: Facture) {
    if (!imprimerFacture(f)) toast.error("Autorisez les fenêtres pop-up pour imprimer la facture");
  }

  return (
    <div className="flex flex-1 flex-col">
      <SignatureLedgerBanner
        icon={FileText}
        eyebrow="Comptabilité · Honoraires"
        title="Facturation"
        description="Factures d'honoraires du cabinet : émission, échéance, paiement et signature."
        metrics={[
          { label: list.length > 1 ? "Factures" : "Facture", value: list.length, loading },
          { label: "Facturé", value: formatTnd(facture), loading },
          { label: "Encaissé", value: formatTnd(encaisse), tone: "success", loading },
          { label: "En retard", value: nbRetard, tone: nbRetard > 0 ? "warning" : "default", loading },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="signature-ledger__action" onClick={exporter}>
              <Download className="h-4 w-4" />
              {selection.length ? `Exporter (${selection.length})` : "CSV"}
            </Button>
            <Button variant="ledger" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" />
              Nouvelle facture
            </Button>
          </div>
        }
      />

      <div className="mt-4 overflow-hidden rounded-xl border border-accent/30 bg-card">
        <div className="flex flex-wrap items-center gap-3 border-b border-accent/25 px-6 py-5">
          <Select value={statut} onValueChange={(v) => setStatut(v as "all" | FactureStatut)}>
            <SelectTrigger className={selectTriggerClass} aria-label="Statut">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              {(Object.keys(FACTURE_STATUT_LABELS) as FactureStatut[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {FACTURE_STATUT_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <label className="flex h-11 items-center gap-3 rounded-lg border border-accent/35 px-4 text-base text-primary">
            <Checkbox
              checked={retardSeul}
              onCheckedChange={(c) => setRetardSeul(Boolean(c))}
              className="size-5 rounded-md"
            />
            En retard uniquement
          </label>

          <div className="relative min-w-[14rem] flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Client ou n° de facture"
              aria-label="Rechercher une facture"
              className="h-11 w-full rounded-lg border border-accent/35 bg-card pl-10 pr-3 text-base outline-none placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_hsl(var(--accent)/0.22)]"
            />
          </div>

          <span className="ml-auto text-base text-muted-foreground">
            {filtered.length} facture{filtered.length > 1 ? "s" : ""} · total{" "}
            <span className="font-bold tabular-nums text-primary">
              {formatTnd(filtered.filter((f) => f.statut !== "annulee").reduce((s, f) => s + f.netAPayer, 0))}
            </span>
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="px-6 py-10">
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-accent/40 px-4 py-12 text-center">
              <span className="grid size-[60px] place-items-center rounded-full bg-accent/15 text-primary">
                <FileText className="size-6" aria-hidden="true" />
              </span>
              <p className="font-serif text-2xl font-medium text-primary">
                {loading ? "Chargement…" : list.length === 0 ? "Aucune facture" : "Aucune facture ne correspond"}
              </p>
              <p className="max-w-md text-base text-muted-foreground">
                {list.length === 0
                  ? "Créez une facture d'honoraires : client, lignes, TVA et timbre fiscal."
                  : "Modifiez les filtres pour retrouver une facture."}
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] text-base">
              <thead>
                <tr className="border-b border-accent/25 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  <th className="w-12 px-6 py-3.5 text-left">
                    <Checkbox
                      checked={toutSelectionne}
                      onCheckedChange={(c) => setSelection(c ? filtered.map((f) => f.id) : [])}
                      aria-label="Tout sélectionner"
                      className="size-5 rounded-md"
                    />
                  </th>
                  <th className="px-3 py-3.5 text-left">Client</th>
                  <th className="px-3 py-3.5 text-left">N°</th>
                  <th className="px-3 py-3.5 text-left">Émission</th>
                  <th className="px-3 py-3.5 text-left">Échéance</th>
                  <th className="px-3 py-3.5 text-right">Montant</th>
                  <th className="px-3 py-3.5 text-left">Statut</th>
                  <th className="px-3 py-3.5 text-left">Signature</th>
                  <th className="px-6 py-3.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((f) => {
                  const retard = estEnRetard(f);
                  return (
                    <tr
                      key={f.id}
                      className={cn(
                        "border-b border-accent/20 last:border-b-0 hover:bg-accent/[0.05]",
                        f.statut === "annulee" && "text-muted-foreground line-through decoration-muted-foreground/40",
                      )}
                    >
                      <td className="px-6 py-3.5">
                        <Checkbox
                          checked={selection.includes(f.id)}
                          onCheckedChange={(c) =>
                            setSelection((s) => (c ? [...s, f.id] : s.filter((id) => id !== f.id)))
                          }
                          aria-label={`Sélectionner la facture ${f.numero}`}
                          className="size-5 rounded-md"
                        />
                      </td>
                      <td className="max-w-[16rem] truncate px-3 py-3.5 font-medium text-primary" title={f.societeNom}>
                        {f.societeNom}
                      </td>
                      <td className="px-3 py-3.5 font-mono text-sm">{f.numero}</td>
                      <td className="px-3 py-3.5 text-muted-foreground">{formatDate(f.dateEmission)}</td>
                      <td className={cn("px-3 py-3.5", retard ? "font-semibold text-warning" : "text-muted-foreground")}>
                        {f.echeance ? formatDate(f.echeance) : "—"}
                      </td>
                      <td className="px-3 py-3.5 text-right font-semibold tabular-nums text-primary">
                        {formatTnd(f.netAPayer)}
                      </td>
                      <td className="px-3 py-3.5">
                        {retard ? (
                          <Badge variant="warning">En retard</Badge>
                        ) : (
                          <Badge
                            variant={f.statut === "payee" ? "success" : f.statut === "annulee" ? "muted" : "default"}
                          >
                            {FACTURE_STATUT_LABELS[f.statut]}
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-3.5">
                        {f.statut === "annulee" ? (
                          <span className="text-sm text-muted-foreground">—</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => basculerSignature(f)}
                            title={f.signeeLe ? "Retirer la signature" : "Marquer comme signée"}
                            className={cn(
                              "inline-flex items-center gap-2 text-sm font-medium",
                              f.signeeLe ? "text-success" : "text-muted-foreground hover:text-primary",
                            )}
                          >
                            <PenLine className="h-4 w-4" />
                            {f.signeeLe ? `Signée le ${formatDate(f.signeeLe)}` : "Non signée"}
                          </button>
                        )}
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex justify-end gap-1">
                          <button type="button" className={iconButton} onClick={() => imprimer(f)} aria-label={`Imprimer la facture ${f.numero}`} title="Imprimer / PDF">
                            <Printer className="h-4 w-4" />
                          </button>
                          {f.statut !== "annulee" && (
                            <>
                              <button
                                type="button"
                                className={iconButton}
                                onClick={() => basculerPaiement(f)}
                                aria-label={f.statut === "payee" ? `Retirer le paiement de ${f.numero}` : `Marquer ${f.numero} payée`}
                                title={f.statut === "payee" ? "Retirer le paiement" : "Marquer payée"}
                              >
                                {f.statut === "payee" ? <RotateCcw className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                              </button>
                              <button
                                type="button"
                                className={cn(iconButton, "hover:bg-destructive/10 hover:text-destructive")}
                                onClick={() => setAAnnuler(f)}
                                aria-label={`Annuler la facture ${f.numero}`}
                                title="Annuler la facture"
                              >
                                <Ban className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <FactureFormSheet open={formOpen} onOpenChange={setFormOpen} onSubmit={generer} />

      <ConfirmDialog
        open={Boolean(aAnnuler)}
        onOpenChange={(o) => !o && setAAnnuler(null)}
        title="Annuler cette facture ?"
        description={
          <>
            La facture <span className="font-medium text-foreground">{aAnnuler?.numero}</span> sera marquée
            annulée. Son numéro reste utilisé et elle ne pourra plus être modifiée.
          </>
        }
        confirmLabel="Annuler la facture"
        onConfirm={async () => {
          if (aAnnuler) {
            await update(aAnnuler.id, { statut: "annulee" });
            toast.success(`Facture ${aAnnuler.numero} annulée`);
          }
          setAAnnuler(null);
        }}
      />
    </div>
  );
}

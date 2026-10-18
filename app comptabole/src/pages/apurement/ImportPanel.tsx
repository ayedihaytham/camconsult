import { ApurementSelect } from "./ApurementSelect";
import { useState } from "react";
import {
  Upload,
  FileCheck2,
  AlertTriangle,
  CheckCircle2,
  Download,
  ArrowRight,
} from "lucide-react";
import { api } from "@/lib/api";
import { tnd, inputRate } from "@/lib/apurement";
import {
  importReviewIssues,
  importWarning,
  rowReviewRequired,
  sourceReviewRequired,
  type ImportPreview,
  type ImportRow,
} from "@/lib/apurementImport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LedgerTable as DataTable } from "@/components/ledger/LedgerTable";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { ApurementRecord, Quarter } from "@/types/apurement";

export function ImportPanel({
  societeId,
  societeName,
  annee,
  trimestre,
  bcs,
  onDone,
}: {
  societeId: string;
  societeName?: string;
  annee: number;
  trimestre: Quarter;
  bcs: ApurementRecord[];
  onDone: () => void;
}) {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [targets, setTargets] = useState<Record<number, string>>({});
  const [rate, setRate] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<unknown>(null);
  const [sourceNote, setSourceNote] = useState("");
  const [identityConfirmed, setIdentityConfirmed] = useState(false);
  const [groupNote, setGroupNote] = useState("");
  const [mobilePage, setMobilePage] = useState(1);
  const desktop = useMediaQuery("(min-width: 768px)");
  const issues = preview
    ? importReviewIssues(
        preview,
        selected,
        notes,
        targets,
        mapping,
        sourceNote,
        identityConfirmed,
      )
    : [];
  const locked = busy || Boolean(preview?.alreadyCommitted);
  const mismatch = preview?.warnings.some(
    (w) => w.code === "IDENTITE_DECLARANT_DIFFERENTE",
  );
  const selectedRows =
    preview?.rows.filter((r) => selected.includes(r.row)) || [];
  const selectedHt = selectedRows
    .reduce((s, r) => s + BigInt(r.montantHtMillimes || "0"), 0n)
    .toString();
  async function load() {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      if (file.size > 10485760)
        throw new Error(
          "Fichier limité à 10 Mo. Choisissez un fichier plus petit.",
        );
      const encoded = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1]);
        r.onerror = () =>
          reject(
            new Error("Lecture impossible. Sélectionnez à nouveau le fichier."),
          );
        r.readAsDataURL(file);
      });
      const p = await api.post<ImportPreview>("/apurement/imports/preview", {
        societeId,
        annee,
        trimestre,
        nom: file.name,
        contenuBase64: encoded,
        tauxTvaBps: inputRate(rate),
      });
      setPreview(p);
      setSelected([]);
      setMapping({});
      setNotes({});
      setTargets({});
      setSourceNote("");
      setIdentityConfirmed(false);
      setReport(null);
      setMobilePage(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import impossible");
    } finally {
      setBusy(false);
    }
  }
  async function commit() {
    if (!preview || locked) return;
    if (issues.length) {
      setError(issues[0].message);
      document.getElementById(issues[0].field || "import-review")?.focus();
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await api.post(`/apurement/imports/${preview.batchId}/commit`, {
        previewHash: preview.previewHash,
        motifEcartPied: sourceNote,
        rows: selected.map((row) => ({
          row,
          ...(mapping[row] ? { bcId: mapping[row] } : {}),
          ...(targets[row]
            ? {
                updateFactureId: targets[row],
                expectedVersion: preview.rows
                  .find((r) => r.row === row)
                  ?.matches?.find((m) => m.id === targets[row])?.version,
              }
            : {}),
          motif: notes[row] || "",
        })),
      });
      setReport(r);
      setPreview({ ...preview, alreadyCommitted: true });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import impossible");
    } finally {
      setBusy(false);
    }
  }
  function choice(r: ImportRow) {
    return (
      <input
        type="checkbox"
        className="h-4 w-4 accent-primary"
        aria-label={`Importer ligne ${r.row}`}
        disabled={locked || !!r.errors.length}
        checked={selected.includes(r.row)}
        onChange={(e) =>
          setSelected((s) =>
            e.target.checked ? [...s, r.row] : s.filter((x) => x !== r.row),
          )
        }
      />
    );
  }
  function decision(r: ImportRow) {
    const needsNote = rowReviewRequired(r, targets[r.row], mapping[r.row]);
    return (
      <div className="min-w-0 space-y-2">
        {r.errors.map((s, i) => (
          <p key={i} className="text-xs text-destructive">
            {s}
          </p>
        ))}
        {r.warnings.map((s) => (
          <p key={s} className="text-xs text-foreground">
            {importWarning(s)}
          </p>
        ))}
        {!!r.matches?.length && (
          <label className="block text-xs">
            Action sur la facture
            <ApurementSelect
              aria-label={`Action ligne ${r.row}`}
              disabled={locked}
              value={targets[r.row] || ""}
              onValueChange={(value) =>
                setTargets((t) => ({ ...t, [r.row]: value }))
              }
              options={[
                {
                  value: "",
                  label: <>Créer une facture distincte (justifier)</>,
                },
                ...r.matches.map((m) => ({
                  value: m.id,
                  label: (
                    <>
                      Mettre à jour · {m.date || "date incomplète"} · HT{" "}
                      {tnd(m.ht)} · v{m.version}
                    </>
                  ),
                })),
              ]}
            />
          </label>
        )}
        {needsNote && (
          <label className="block text-xs font-medium">
            Justification obligatoire
            <Input
              id={`import-note-${r.row}`}
              aria-label={`Justification ligne ${r.row}`}
              disabled={locked}
              value={notes[r.row] || ""}
              placeholder="Expliquez la décision après vérification"
              onChange={(e) =>
                setNotes((n) => ({ ...n, [r.row]: e.target.value }))
              }
            />
          </label>
        )}
        <details className="text-xs">
          <summary className="cursor-pointer py-1 text-muted-foreground underline underline-offset-4">
            BC et valeurs originales
          </summary>
          <label className="my-2 block">
            Bon de commande
            <ApurementSelect
              aria-label={`BC ligne ${r.row}`}
              disabled={locked}
              value={mapping[r.row] || ""}
              onValueChange={(value) =>
                setMapping((m) => ({ ...m, [r.row]: value }))
              }
              options={[
                { value: "", label: <>Créer / rapprocher BC {r.bcNumero}</> },
                ...bcs.map((b) => ({ value: b.id, label: <>{b.numero}</> })),
              ]}
            />
          </label>
          <pre className="max-w-64 whitespace-pre-wrap break-all bg-muted p-2">
            {JSON.stringify(r.raw, null, 2)}
          </pre>
        </details>
      </div>
    );
  }
  return (
    <section className="space-y-5" data-tour="apurement-import">
      <div>
        <h2 className="text-lg font-semibold">Importer des achats</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {societeName || "Société sélectionnée"} · {trimestre} {annee}.
          Vérifiez le fichier avant toute écriture.
        </p>
      </div>
      <ol
        aria-label="Étapes de l’import"
        className="flex flex-wrap gap-x-6 gap-y-2 border-b pb-3 text-sm"
      >
        {[
          "Choisir le fichier",
          "Vérifier les lignes",
          "Confirmer l’import",
        ].map((s, i) => (
          <li
            key={s}
            aria-current={
              (report != null ? 2 : preview ? 1 : 0) === i ? "step" : undefined
            }
            className={
              (report != null ? 2 : preview ? 1 : 0) === i
                ? "font-semibold text-primary"
                : "text-muted-foreground"
            }
          >
            <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs">
              {i + 1}
            </span>
            {s}
          </li>
        ))}
      </ol>
      <div className="rounded-lg border bg-background p-4">
        <div className="flex items-center gap-2 font-medium">
          <Upload className="h-4 w-4 text-primary" />
          Fichier d’achats
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Excel XLS/XLSX au modèle Factures, ou BCD reconnu. 10 Mo maximum. Le
          taux sert au calcul provisoire, sans modifier les montants source.
        </p>
        <div className="mt-4 grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_auto]">
          <label className="min-w-0 space-y-1 text-sm font-medium">
            Fichier
            <Input
              type="file"
              disabled={busy}
              className="min-w-0 file:mr-3 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setPreview(null);
                setReport(null);
                setError("");
              }}
            />
          </label>
          <label className="space-y-1 text-sm font-medium">
            Taux de TVA (%)
            <Input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={rate}
              disabled={busy || !!preview}
              placeholder="Ex. 19"
              onChange={(e) => setRate(e.target.value)}
            />
          </label>
          <Button disabled={!file || rate === "" || busy} onClick={load}>
            {busy
              ? "Traitement…"
              : preview
                ? "Relancer l’aperçu"
                : "Prévisualiser"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
        <a
          href="/apurement-aide/modele-achats.xlsx"
          download
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary underline underline-offset-4"
        >
          <Download className="h-4 w-4" />
          Télécharger le modèle Excel vierge
        </a>
      </div>
      {error && (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <strong>Import non effectué.</strong> {error} Vos choix sont
          conservés.
        </div>
      )}
      {preview && (
        <>
          <div
            id="import-review"
            tabIndex={-1}
            className="scroll-mt-24 space-y-3 outline-none"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 font-semibold">
                <FileCheck2 className="h-4 w-4" />
                {preview.rows.length} lignes reconnues
              </h3>
              <span className="text-xs text-muted-foreground">
                {preview.rows.filter((r) => r.errors.length).length} invalide(s)
                · {preview.rows.filter((r) => r.duplicate).length} doublon(s)
                possible(s)
              </span>
            </div>
            {preview.profil?.raisonSociale && (
              <p className="text-sm">
                Déclarant du fichier :{" "}
                <strong>{preview.profil.raisonSociale}</strong> · MF{" "}
                {preview.profil.matriculeFiscal || "non indiqué"}
              </p>
            )}
            {!!preview.warnings.length && (
              <div className="space-y-3 rounded-md border border-warning/40 bg-warning/5 p-4">
                <h4 className="flex items-center gap-2 text-sm font-semibold">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-foreground" />
                  Revue du fichier avant import
                </h4>
                {preview.warnings.map((w, i) => (
                  <p key={i} className="text-sm">
                    {w.message}
                    {w.tva ? ` Écart TVA : ${tnd(w.tva)}.` : ""}
                  </p>
                ))}
                {mismatch && (
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      id="import-identity-confirm"
                      type="checkbox"
                      className="mt-1 h-4 w-4 shrink-0 accent-primary"
                      disabled={locked}
                      checked={identityConfirmed}
                      onChange={(e) => setIdentityConfirmed(e.target.checked)}
                    />
                    <span>
                      J’ai vérifié que ce fichier appartient à{" "}
                      <strong>
                        {societeName || "la société sélectionnée"}
                      </strong>
                      . Sinon, je change de dossier avant de poursuivre.
                    </span>
                  </label>
                )}
                {sourceReviewRequired(preview) && (
                  <label className="block space-y-1 text-sm font-medium">
                    Justification des écarts du fichier (obligatoire)
                    <textarea
                      id="import-source-note"
                      className="min-h-20 w-full rounded-md border border-input bg-background p-3 text-sm font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      disabled={locked}
                      value={sourceNote}
                      onChange={(e) => setSourceNote(e.target.value)}
                      placeholder="Décrivez les vérifications effectuées et le traitement retenu. Aucun écart n’est corrigé automatiquement."
                    />
                  </label>
                )}
              </div>
            )}
          </div>
          {!preview.alreadyCommitted && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  setSelected(
                    preview.rows
                      .filter((r) => !r.errors.length && !r.duplicate)
                      .map((r) => r.row),
                  )
                }
              >
                Sélectionner les lignes valides sans doublon
              </Button>
              <Button
                variant="ghost"
                disabled={busy || !selected.length}
                onClick={() => setSelected([])}
              >
                Tout désélectionner
              </Button>
              <details className="w-full text-sm">
                <summary className="cursor-pointer py-2 text-muted-foreground underline underline-offset-4">
                  Appliquer une justification aux lignes sélectionnées
                </summary>
                <div className="flex flex-wrap gap-2">
                  <Input
                    aria-label="Justification groupée"
                    className="max-w-lg"
                    value={groupNote}
                    onChange={(e) => setGroupNote(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    disabled={busy || !groupNote.trim() || !selected.length}
                    onClick={() =>
                      setNotes((n) => ({
                        ...n,
                        ...Object.fromEntries(
                          selected.map((r) => [r, groupNote]),
                        ),
                      }))
                    }
                  >
                    Appliquer aux {selected.length} lignes
                  </Button>
                </div>
              </details>
            </div>
          )}
          {desktop ? (
            <div className="apurement-data-table min-w-0">
              <DataTable
                data={preview.rows}
                getRowId={(r) => String(r.row)}
                pageSize={15}
                columns={[
                  { id: "choix", header: "Choix", cell: choice },
                  {
                    id: "facture",
                    header: "Facture / fournisseur",
                    cell: (r) => (
                      <div className="max-w-56 break-words">
                        <span className="font-medium">{r.numeroFacture}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {r.fournisseur}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {r.dateFacture || r.dateBrute} · BC {r.bcNumero}
                        </span>
                      </div>
                    ),
                  },
                  {
                    id: "montants",
                    header: "HT / TVA (TND)",
                    align: "right",
                    cell: (r) => (
                      <div className="whitespace-nowrap text-sm tabular-nums">
                        {tnd(r.montantHtMillimes)}
                        <span className="block text-xs text-muted-foreground">
                          TVA {tnd(r.tvaSuspendueMillimes)}
                        </span>
                      </div>
                    ),
                  },
                  {
                    id: "decision",
                    header: "Vérification / décision",
                    cell: (r) => (
                      <div className="min-w-48 max-w-sm">{decision(r)}</div>
                    ),
                  },
                ]}
              />
            </div>
          ) : (
            <div className="divide-y rounded-md border bg-background">
              {preview.rows
                .slice((mobilePage - 1) * 10, mobilePage * 10)
                .map((r) => (
                  <article key={r.row} className="space-y-3 p-3">
                    <div className="flex items-start gap-3">
                      {choice(r)}
                      <div className="min-w-0 flex-1">
                        <p className="break-words font-medium">
                          {r.numeroFacture}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {r.fournisseur} · {r.dateFacture || r.dateBrute}
                        </p>
                      </div>
                    </div>
                    <p className="flex flex-wrap justify-between gap-2 text-sm tabular-nums">
                      <span>HT {tnd(r.montantHtMillimes)}</span>
                      <span>TVA {tnd(r.tvaSuspendueMillimes)}</span>
                    </p>
                    {decision(r)}
                  </article>
                ))}
              <div className="flex items-center justify-between gap-2 p-3 text-sm">
                <Button
                  variant="outline"
                  disabled={mobilePage === 1}
                  onClick={() => setMobilePage((p) => p - 1)}
                >
                  Précédent
                </Button>
                <span>
                  {mobilePage} /{" "}
                  {Math.max(1, Math.ceil(preview.rows.length / 10))}
                </span>
                <Button
                  variant="outline"
                  disabled={mobilePage * 10 >= preview.rows.length}
                  onClick={() => setMobilePage((p) => p + 1)}
                >
                  Suivant
                </Button>
              </div>
            </div>
          )}
          {!preview.alreadyCommitted && (
            <div className="bottom-0 z-10 space-y-2 rounded-md border bg-background p-4 md:sticky">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm">
                  <strong>{selected.length} ligne(s) sélectionnée(s)</strong>
                  <span className="ml-3 tabular-nums">
                    HT {tnd(selectedHt)}
                  </span>
                </p>
                <Button disabled={busy || !!issues.length} onClick={commit}>
                  {busy
                    ? "Import en cours…"
                    : `Confirmer l’import de ${selected.length} ligne(s)`}
                </Button>
              </div>
              {!!issues.length ? (
                <div
                  aria-live="polite"
                  className="text-xs text-muted-foreground"
                >
                  <p className="font-medium">Avant de confirmer :</p>
                  <ul className="mt-1 list-inside list-disc">
                    {issues.slice(0, 4).map((i, n) => (
                      <li key={n}>
                        {i.field ? (
                          <button
                            className="text-left underline underline-offset-2"
                            onClick={() =>
                              document.getElementById(i.field!)?.focus()
                            }
                          >
                            {i.message}
                          </button>
                        ) : (
                          i.message
                        )}
                      </li>
                    ))}
                  </ul>
                  {issues.length > 4 && (
                    <p>Et {issues.length - 4} autre(s) point(s) à compléter.</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Prêt à importer. Les dates incomplètes resteront à compléter
                  avant la déclaration.
                </p>
              )}
            </div>
          )}
          {preview.alreadyCommitted && (
            <div
              role="status"
              className="flex items-start gap-3 rounded-md border border-success/30 bg-success/5 p-4"
            >
              <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
              <div>
                <p className="font-medium">
                  {report != null
                    ? "Import validé."
                    : "Ce fichier a déjà été importé."}{" "}
                  Aucun doublon créé par réimport.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Vérifiez les matricules fournisseurs, complétez les dates puis
                  ouvrez les contrôles du trimestre.
                </p>
              </div>
            </div>
          )}
        </>
      )}
      {report != null && (
        <Button
          variant="outline"
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([JSON.stringify(report, null, 2)], {
                type: "application/json",
              }),
            );
            const a = document.createElement("a");
            a.href = url;
            a.download = "rapport-import-apurement.json";
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          <Download className="mr-2 h-4 w-4" />
          Télécharger le rapport d’import
        </Button>
      )}
    </section>
  );
}

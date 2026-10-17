import { useState } from "react";
import { api } from "@/lib/api";
import { tnd, inputRate } from "@/lib/apurement";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/common/DataTable";
import type { ApurementRecord, Quarter } from "@/types/apurement";
type Row = {
  row: number;
  numeroFacture: string;
  fournisseur: string;
  bcNumero: string;
  dateFacture: string | null;
  dateBrute: string;
  datePrecision: string;
  montantHtMillimes: string;
  tvaSuspendueMillimes: string;
  warnings: string[];
  errors: string[];
  duplicate: boolean;
  matches?: {
    id: string;
    version: number;
    date: string | null;
    ht: string;
    tva: string;
  }[];
  raw: unknown;
};
type Preview = {
  profil?: { raisonSociale?: string; matriculeFiscal?: string };
  batchId: string;
  previewHash: string;
  profile: string;
  rows: Row[];
  warnings: { message: string; tva?: string }[];
  alreadyCommitted?: boolean;
};
export function ImportPanel({
  societeId,
  annee,
  trimestre,
  bcs,
  onDone,
}: {
  societeId: string;
  annee: number;
  trimestre: Quarter;
  bcs: ApurementRecord[];
  onDone: () => void;
}) {
  const [preview, setPreview] = useState<Preview | null>(null),
    [selected, setSelected] = useState<number[]>([]),
    [notes, setNotes] = useState<Record<number, string>>({}),
    [mapping, setMapping] = useState<Record<number, string>>({}),
    [updateTargets, setUpdateTargets] = useState<Record<number, string>>({}),
    [rate, setRate] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<unknown>(null);
  const [footerNote, setFooterNote] = useState("");
  const [groupNote, setGroupNote] = useState("");
  async function load() {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      if (file.size > 10485760) throw new Error("Fichier limité à 10 Mo.");
      const encoded = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1]);
        r.onerror = () => reject(new Error("Lecture impossible"));
        r.readAsDataURL(file);
      });
      const p = await api.post<Preview>("/apurement/imports/preview", {
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
      setUpdateTargets({});
      setFooterNote("");
      setReport(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import impossible");
    } finally {
      setBusy(false);
    }
  }
  async function commit() {
    if (!preview) return;
    setBusy(true);
    setError("");
    try {
      const r = await api.post(`/apurement/imports/${preview.batchId}/commit`, {
        previewHash: preview.previewHash,
        motifEcartPied: footerNote,
        rows: selected.map((row) => ({
          row,
          ...(mapping[row] ? { bcId: mapping[row] } : {}),
          ...(updateTargets[row]
            ? {
                updateFactureId: updateTargets[row],
                expectedVersion: preview.rows
                  .find((r) => r.row === row)
                  ?.matches?.find((m) => m.id === updateTargets[row])?.version,
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
  return (
    <section className="space-y-3 border-t pt-4" data-tour="apurement-import">
      <h2 className="font-semibold">Importer des achats</h2>
      <p className="text-sm text-muted-foreground">
        Classeur Factures XLS/XLSX ou BCD observé. L’aperçu ne crée aucune
        facture. Taux à confirmer explicitement pour le calcul provisoire.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-0 text-sm">
          Fichier (10 Mo maximum)
          <Input
            type="file"
            disabled={busy}
            onChange={(e) => {
              setFile(e.target.files?.[0] || null);
              setPreview(null);
            }}
          />
        </label>
        <label className="text-sm">
          Taux de TVA (%)
          <Input
            type="number"
            min={0}
            max={100}
            step="0.01"
            required
            value={rate}
            placeholder="Ex. 19"
            onChange={(e) => setRate(e.target.value)}
            className="w-40"
          />
        </label>
        <Button disabled={!file || !rate || busy} onClick={load}>
          {busy ? "Lecture…" : "Prévisualiser"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {preview && (
        <>
          <p className="text-sm">
            {preview.profile} · {preview.rows.length} lignes reconnues ·{" "}
            {preview.alreadyCommitted
              ? "Import déjà validé"
              : "Aucune écriture métier à ce stade"}
          </p>
          {preview?.profil?.raisonSociale && (
            <p className="break-words text-sm">
              Déclarant source : {preview.profil.raisonSociale} · MF{" "}
              {preview.profil.matriculeFiscal || "non indiqué"}. Le profil du
              dossier reste à vérifier séparément.
            </p>
          )}
          {preview.warnings.map((w, i) => (
            <p key={i} role="alert" className="text-sm text-amber-700">
              {w.message}
              {w.tva ? ` Écart TVA : ${tnd(w.tva)}` : ""}
            </p>
          ))}
          {!!preview.warnings.length && (
            <label className="block text-sm">
              Revue de l’écart du fichier source
              <Input
                value={footerNote}
                onChange={(e) => setFooterNote(e.target.value)}
                placeholder="Justification des écarts du document source"
              />
            </label>
          )}
          {!preview.alreadyCommitted && (
            <div className="flex flex-wrap items-end gap-2">
              <Button
                variant="outline"
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
              <label className="text-sm">
                Justification groupée
                <Input
                  value={groupNote}
                  onChange={(e) => setGroupNote(e.target.value)}
                />
              </label>
              <Button
                variant="outline"
                disabled={!groupNote.trim() || !selected.length}
                onClick={() =>
                  setNotes((n) => ({
                    ...n,
                    ...Object.fromEntries(selected.map((r) => [r, groupNote])),
                  }))
                }
              >
                Appliquer aux lignes sélectionnées
              </Button>
            </div>
          )}
          <div className="max-w-full overflow-x-auto">
            <DataTable
              data={preview.rows}
              getRowId={(r) => String(r.row)}
              pageSize={15}
              columns={[
                {
                  id: "choix",
                  header: "Importer",
                  cell: (r) => (
                    <input
                      type="checkbox"
                      aria-label={`Importer ligne ${r.row}`}
                      disabled={!!r.errors.length || preview.alreadyCommitted}
                      checked={selected.includes(r.row)}
                      onChange={(e) =>
                        setSelected((s) =>
                          e.target.checked
                            ? [...s, r.row]
                            : s.filter((x) => x !== r.row),
                        )
                      }
                    />
                  ),
                },
                {
                  id: "numero",
                  header: "Facture / source",
                  cell: (r) => (
                    <div className="min-w-36">
                      {r.numeroFacture}
                      <span className="block text-xs">{r.fournisseur}</span>
                      <details>
                        <summary className="cursor-pointer text-xs underline">
                          Valeurs originales
                        </summary>
                        <pre className="max-w-64 whitespace-pre-wrap break-all text-xs">
                          {JSON.stringify(r.raw, null, 2)}
                        </pre>
                      </details>
                    </div>
                  ),
                },
                {
                  id: "date",
                  header: "Date",
                  cell: (r) => (
                    <div>
                      {r.dateFacture || r.dateBrute}
                      <span className="block text-xs">
                        {r.datePrecision === "month"
                          ? "Mois seul : à compléter"
                          : r.datePrecision}
                      </span>
                    </div>
                  ),
                },
                {
                  id: "ht",
                  header: "HT / TVA",
                  cell: (r) => (
                    <div className="whitespace-nowrap tabular-nums">
                      {tnd(r.montantHtMillimes)}
                      <span className="block">
                        {tnd(r.tvaSuspendueMillimes)}
                      </span>
                    </div>
                  ),
                },
                {
                  id: "controle",
                  header: "Contrôles / décision",
                  cell: (r) => (
                    <div className="min-w-52 space-y-2">
                      <p className="text-xs text-destructive">
                        {r.errors.join(" · ")}
                      </p>
                      <p className="text-xs text-amber-700">
                        {r.warnings.join(" · ")}
                      </p>
                      {!!r.matches?.length && (
                        <select
                          aria-label={`Action ligne ${r.row}`}
                          className="h-9 w-full rounded border bg-background px-2 text-xs"
                          disabled={preview.alreadyCommitted}
                          value={updateTargets[r.row] || ""}
                          onChange={(e) =>
                            setUpdateTargets((t) => ({
                              ...t,
                              [r.row]: e.target.value,
                            }))
                          }
                        >
                          <option value="">
                            Créer une facture distincte (justifier le doublon)
                          </option>
                          {r.matches.map((m) => (
                            <option key={m.id} value={m.id}>
                              Mettre à jour · {m.date || "date incomplète"} · HT{" "}
                              {tnd(m.ht)} · TVA {tnd(m.tva)} · v{m.version}
                            </option>
                          ))}
                        </select>
                      )}
                      <select
                        aria-label={`BC ligne ${r.row}`}
                        className="h-9 w-full rounded border bg-background px-2 text-xs"
                        value={mapping[r.row] || ""}
                        onChange={(e) =>
                          setMapping((m) => ({ ...m, [r.row]: e.target.value }))
                        }
                      >
                        <option value="">
                          Créer / rapprocher BC {r.bcNumero}
                        </option>
                        {bcs.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.numero}
                          </option>
                        ))}
                      </select>
                      <Input
                        aria-label={`Justification ligne ${r.row}`}
                        placeholder="Justification TVA / doublon / mise à jour"
                        value={notes[r.row] || ""}
                        onChange={(e) =>
                          setNotes((n) => ({ ...n, [r.row]: e.target.value }))
                        }
                      />
                    </div>
                  ),
                },
              ]}
            />
          </div>
          <Button
            disabled={!selected.length || busy || preview.alreadyCommitted}
            onClick={commit}
          >
            Confirmer l’import de {selected.length} ligne(s)
          </Button>
        </>
      )}
      {report != null && (
        <div className="space-y-2">
          <p role="status">
            Import validé. Les matricules importés restent à vérifier par le
            cabinet.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              const blob = new Blob([JSON.stringify(report, null, 2)], {
                type: "application/json",
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "rapport-import-apurement.json";
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
          >
            Télécharger le rapport d’import
          </Button>
        </div>
      )}
    </section>
  );
}

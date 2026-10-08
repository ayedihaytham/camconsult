import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Download, FileSpreadsheet, FileText, Save, TriangleAlert, Upload } from "lucide-react";
import { LedgerSheet } from "@/components/ledger/LedgerSheet";
import { LedgerSegmented } from "@/components/ledger/LedgerSegmented";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { download } from "@/lib/export";
import { COMPTE_BANQUE, ecrituresDepuisReleve, pdfEcritures } from "@/lib/ecrituresReleve";
import {
  aUnTableauDeMouvements,
  classeurExcel,
  feuillesDePdf,
  lireFichierPdf,
  nombreDeCaracteres,
  type PdfTextItem,
} from "@/lib/pdfToTables";

interface PdfItem {
  id: string;
  name: string;
  baseName: string;
  status: "ok" | "erreur";
  detail: string;
  /** Texte positionné de chaque page : permet de recalculer le tableau quand une option change. */
  pages: PdfTextItem[][];
  pdfUrl: string | null;
  /** Vrai une fois la conversion enregistrée : l'aperçu et le téléchargement ne sont proposés qu'ensuite. */
  enregistre: boolean;
}

const MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Conversion PDF vers Excel : lecture du texte du PDF dans le navigateur, reconstruction des lignes et
 * colonnes d'après la position du texte, puis export .xlsx. Un PDF scanné (image) n'a pas de texte : il
 * est refusé avec un message clair plutôt que converti en classeur vide. */
export function PdfVersExcel() {
  const [converting, setConverting] = useState(false);
  const [items, setItems] = useState<PdfItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeSheet, setActiveSheet] = useState(0);
  const [nombres, setNombres] = useState(true);
  const [uneSeuleFeuille, setUneSeuleFeuille] = useState(false);
  const [tableauSeul, setTableauSeul] = useState(true);
  const [compte, setCompte] = useState(COMPTE_BANQUE);
  const [ecrituresUrl, setEcrituresUrl] = useState<string | null>(null);
  const urlsRef = useRef<string[]>([]);

  useEffect(() => {
    const urls = urlsRef.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setConverting(true);
    const results: PdfItem[] = [];
    for (const file of files) {
      const baseName = file.name.replace(/\.pdf$/i, "");
      const erreur = (detail: string): PdfItem => ({
        id: crypto.randomUUID(), name: file.name, baseName, status: "erreur", detail, pages: [], pdfUrl: null, enregistre: false,
      });
      try {
        const pages = await lireFichierPdf(file);
        if (nombreDeCaracteres(pages) === 0) {
          results.push(erreur("PDF scanné (image) : il ne contient pas de texte à extraire"));
          continue;
        }
        const pdfUrl = URL.createObjectURL(file);
        urlsRef.current.push(pdfUrl);
        results.push({
          id: crypto.randomUUID(), name: file.name, baseName, status: "ok",
          detail: `${pages.length} page${pages.length > 1 ? "s" : ""} lue${pages.length > 1 ? "s" : ""}`,
          pages, pdfUrl, enregistre: false,
        });
      } catch {
        results.push(erreur("Fichier illisible — PDF protégé ou endommagé"));
      }
    }
    setItems((prev) => [...results, ...prev]);
    setConverting(false);
    const echecs = results.filter((r) => r.status !== "ok").length;
    if (echecs > 0) toast.error(`${echecs} fichier${echecs > 1 ? "s" : ""} non converti${echecs > 1 ? "s" : ""}`);
  }

  const options = useMemo(() => ({ nombres, uneSeuleFeuille, tableauSeul }), [nombres, uneSeuleFeuille, tableauSeul]);
  const active = items.find((i) => i.id === activeId && i.enregistre) ?? null;
  const feuilles = useMemo(() => (active ? feuillesDePdf(active.pages, options) : []), [active, options]);
  const feuille = feuilles[Math.min(activeSheet, Math.max(0, feuilles.length - 1))] ?? null;

  /** Version PDF du relevé converti : les écritures (deux lignes par mouvement), régénérée quand le tableau ou le compte change. */
  const ecritures = useMemo(() => (tableauSeul && feuilles[0] ? ecrituresDepuisReleve(feuilles[0].rows, compte.trim() || COMPTE_BANQUE) : null), [tableauSeul, feuilles, compte]);
  useEffect(() => {
    if (!ecritures) {
      setEcrituresUrl(null);
      return;
    }
    let url: string | null = null;
    let annule = false;
    void pdfEcritures(ecritures).then((blob) => {
      if (annule) return;
      url = URL.createObjectURL(blob);
      setEcrituresUrl(url);
    });
    return () => {
      annule = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [ecritures]);

  function enregistrer(item: PdfItem) {
    if (feuillesDePdf(item.pages, options).length === 0) {
      toast.error("Aucun tableau à enregistrer");
      return;
    }
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, enregistre: true, detail: `${i.detail} · enregistré` } : i)));
    setActiveId(item.id);
    setActiveSheet(0);
    toast.success("Conversion enregistrée — vérifiez l'aperçu puis téléchargez si besoin");
  }

  async function telecharger(item: PdfItem) {
    const f = feuillesDePdf(item.pages, options);
    if (f.length === 0) {
      toast.error("Aucun tableau à enregistrer");
      return;
    }
    try {
      download(new Blob([await classeurExcel(f)], { type: MIME_XLSX }), `${item.baseName}.xlsx`);
    } catch {
      toast.error("Excel impossible");
    }
  }

  async function telechargerEcritures(item: PdfItem) {
    if (!ecritures) return;
    download(await pdfEcritures(ecritures), `${item.baseName} - écritures.pdf`);
  }

  return (
    <>
      <LedgerSheet className="mt-4">
        <div className="border-b border-border px-[18px] py-3.5">
          <h2 className="flex items-center gap-2 text-[0.86rem] font-bold text-foreground">
            <FileSpreadsheet className="h-4 w-4 text-accent" />
            PDF vers Excel
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Traitement entièrement local dans le navigateur — le fichier n'est jamais envoyé au serveur. Fonctionne avec les PDF
            qui contiennent du texte (relevés, balances, états) ; un PDF scanné n'est pas lisible. Cliquez sur Enregistrer pour afficher l'aperçu, puis téléchargez si le résultat vous convient.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-border px-[18px] py-3">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground">
            <Checkbox checked={tableauSeul} onCheckedChange={(c) => setTableauSeul(Boolean(c))} />
            Mouvements bancaires seulement (lignes du tableau)
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground">
            <Checkbox checked={nombres} onCheckedChange={(c) => setNombres(Boolean(c))} />
            Convertir les montants en nombres
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground">
            <Checkbox checked={uneSeuleFeuille} onCheckedChange={(c) => setUneSeuleFeuille(Boolean(c))} />
            Toutes les pages dans une seule feuille
          </label>
        </div>

        <div className="p-[18px]">
          <label
            data-tour="conversions-upload"
            className="flex flex-col items-center gap-3 rounded-sm border border-dashed border-input px-4 py-10 text-center transition-colors hover:border-accent/50 hover:bg-secondary/40"
          >
            <Upload className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-foreground">
              {converting ? (
                "Lecture en cours…"
              ) : (
                <>
                  Cliquez pour choisir un ou plusieurs fichiers <span className="font-semibold underline underline-offset-2">.pdf</span>
                </>
              )}
            </p>
            <input type="file" accept=".pdf,application/pdf" multiple disabled={converting} className="hidden" onChange={handleFiles} />
          </label>
        </div>

        {items.length > 0 && (
          <ul className="divide-y divide-border border-t border-border">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (item.status !== "ok" || !item.enregistre) return;
                    setActiveId(item.id);
                    setActiveSheet(0);
                  }}
                  className={`flex w-full items-center gap-3 px-[18px] py-2.5 text-left transition-colors ${
                    item.status === "ok" ? "hover:bg-secondary/40" : "cursor-default"
                  } ${activeId === item.id ? "bg-secondary/60" : ""}`}
                >
                  {item.status === "ok" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                  ) : (
                    <TriangleAlert className="h-4 w-4 shrink-0 text-destructive" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                  {item.status === "ok" && !item.enregistre && (
                    <Button
                      type="button"
                      variant="ledger"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        enregistrer(item);
                      }}
                    >
                      <Save className="h-3.5 w-3.5" />
                      Enregistrer
                    </Button>
                  )}
                  {item.status === "ok" && item.enregistre && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        void telecharger(item);
                      }}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Télécharger l'Excel
                    </Button>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </LedgerSheet>

      {active && feuille && (
        <LedgerSheet data-tour="conversions-results" className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-[18px] py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{active.name}</p>
              <p className="text-xs text-muted-foreground">
                {tableauSeul && !aUnTableauDeMouvements(active.pages) && (
                  <span className="mb-1 block font-medium text-destructive">
                    Aucun tableau de mouvements reconnu (en-tête Date / Libellé / Débit / Crédit…) : le document complet est converti.
                  </span>
                )}
                Comparez le PDF d'origine (gauche) et le tableau reconstruit (droite) : les lignes qui se répartissent sur plusieurs
                lignes du PDF restent séparées.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {ecrituresUrl && (
                <Button type="button" variant="outline" size="sm" onClick={() => void telechargerEcritures(active)}>
                  <FileText className="h-4 w-4" />
                  Télécharger le PDF des écritures
                </Button>
              )}
              <Button type="button" variant="ledger" size="sm" onClick={() => void telecharger(active)}>
                <Download className="h-4 w-4" />
                Télécharger l'Excel
              </Button>
            </div>
          </div>
          {feuilles.length > 1 && (
            <div className="px-[18px] pt-3">
              <LedgerSegmented
                value={String(activeSheet)}
                onChange={(v) => setActiveSheet(Number(v))}
                options={feuilles.map((f, i) => ({ value: String(i), label: f.name }))}
                ariaLabel="Choisir une feuille"
              />
            </div>
          )}
          <div className="grid gap-4 p-[18px] lg:grid-cols-2">
            <div className="min-w-0">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Aperçu PDF</p>
              <iframe src={active.pdfUrl ?? undefined} title="Aperçu PDF" className="h-[600px] w-full rounded-lg border border-border" />
            </div>
            <div className="min-w-0">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Aperçu Excel — {feuille.rows.length} ligne{feuille.rows.length > 1 ? "s" : ""}
              </p>
              <div className="max-h-[600px] overflow-auto rounded-lg border border-border">
                <table className="w-full border-collapse text-xs">
                  <tbody>
                    {feuille.rows.map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => (
                          <td
                            key={ci}
                            className={`whitespace-nowrap border border-border px-2 py-1 ${typeof cell === "number" ? "text-right tabular-nums" : ""}`}
                          >
                            {typeof cell === "number" ? cell.toLocaleString("fr-FR", { maximumFractionDigits: 6 }) : String(cell ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          {ecrituresUrl && (
            <div className="border-t border-border p-[18px]">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  PDF des écritures — {(ecritures?.length ?? 0) / 2} mouvements, deux lignes chacun
                </p>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  Compte de banque
                  <Input value={compte} onChange={(e) => setCompte(e.target.value)} className="h-7 w-32 text-xs" inputMode="numeric" />
                </label>
              </div>
              <iframe src={ecrituresUrl} title="Aperçu du PDF des écritures" className="h-[420px] w-full rounded-lg border border-border" />
            </div>
          )}
        </LedgerSheet>
      )}
    </>
  );
}

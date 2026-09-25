import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Download, FileOutput, TriangleAlert, Upload } from "lucide-react";
import type { jsPDF as JsPDF } from "jspdf";
import { LedgerPageHeader } from "@/components/ledger/LedgerPageHeader";
import { LedgerSheet } from "@/components/ledger/LedgerSheet";
import { LedgerSegmented } from "@/components/ledger/LedgerSegmented";
import { Button } from "@/components/ui/button";
import { buildTablesPdf, type PdfSheet } from "@/lib/pdfTables";

interface ConvItem {
  id: string;
  name: string;
  baseName: string;
  status: "ok" | "erreur";
  detail: string;
  sheets: PdfSheet[];
  pdfDoc: JsPDF | null;
  pdfUrl: string | null;
}

/** Lit toutes les feuilles d'un classeur Excel — même lecture que
 * ImportBalanceDialog.tsx, mais sur toutes les feuilles plutôt que la
 * première seule. */
async function readSheets(file: File): Promise<PdfSheet[]> {
  const buf = await file.arrayBuffer();
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buf, { type: "array" });
  return wb.SheetNames.map((name) => ({
    name,
    headerRow: true,
    rows: XLSX.utils.sheet_to_json(wb.Sheets[name], {
      header: 1,
      raw: true,
      defval: "",
    }) as (string | number)[][],
  })).filter((sheet) => sheet.rows.some((r) => r.some((v) => v !== "" && v != null)));
}

export function ConversionsPage() {
  const [converting, setConverting] = useState(false);
  const [items, setItems] = useState<ConvItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeSheet, setActiveSheet] = useState(0);
  const urlsRef = useRef<string[]>([]);

  // Les blob URL vivent tant que la page est ouverte — les révoquer au
  // démontage pour ne pas fuir la mémoire du navigateur.
  useEffect(() => {
    return () => {
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setConverting(true);
    const results: ConvItem[] = [];
    for (const file of files) {
      const baseName = file.name.replace(/\.xlsx?$/i, "");
      try {
        const sheets = await readSheets(file);
        if (sheets.length === 0) {
          results.push({
            id: crypto.randomUUID(), name: file.name, baseName,
            status: "erreur", detail: "Fichier vide", sheets: [], pdfDoc: null, pdfUrl: null,
          });
          continue;
        }
        const pdfDoc = await buildTablesPdf({
          title: baseName,
          subtitle: `${sheets.length} feuille${sheets.length > 1 ? "s" : ""} · converti le ${new Date().toLocaleDateString("fr-FR")}`,
          sheets,
          fileName: `${baseName}.pdf`,
          plain: true,
        });
        // Le type jsPDF déclare `output("bloburl")` -> URL, mais renvoie en
        // réalité une string (voir jspdf.node.js : "bloburi'/'bloburl' -> (string)").
        const pdfUrl = pdfDoc.output("bloburl") as unknown as string;
        urlsRef.current.push(pdfUrl);
        results.push({
          id: crypto.randomUUID(), name: file.name, baseName,
          status: "ok", detail: `${sheets.length} feuille${sheets.length > 1 ? "s" : ""} prête${sheets.length > 1 ? "s" : ""}`,
          sheets, pdfDoc, pdfUrl,
        });
      } catch {
        results.push({
          id: crypto.randomUUID(), name: file.name, baseName,
          status: "erreur", detail: "Fichier illisible — export Excel (.xlsx) attendu",
          sheets: [], pdfDoc: null, pdfUrl: null,
        });
      }
    }
    setItems((prev) => [...results, ...prev]);
    const firstOk = results.find((r) => r.status === "ok");
    if (firstOk) {
      setActiveId(firstOk.id);
      setActiveSheet(0);
    }
    setConverting(false);
    const ok = results.filter((r) => r.status === "ok").length;
    const failed = results.length - ok;
    if (failed > 0) toast.error(`${failed} fichier${failed > 1 ? "s" : ""} non converti${failed > 1 ? "s" : ""}`);
  }

  function download(item: ConvItem) {
    item.pdfDoc?.save(`${item.baseName}.pdf`);
  }

  const active = items.find((i) => i.id === activeId) ?? null;
  const sheetOptions = active?.sheets.map((s, i) => ({ value: String(i), label: s.name })) ?? [];
  const activeSheetData = active?.sheets[activeSheet] ?? null;

  return (
    <div>
      <LedgerPageHeader
        title="Conversions"
        description="Convertit un ou plusieurs fichiers Excel en PDF."
      />

      <LedgerSheet className="mt-4">
        <div className="border-b border-border px-[18px] py-3.5">
          <h2 className="flex items-center gap-2 text-[0.86rem] font-bold text-foreground">
            <FileOutput className="h-4 w-4 text-accent" />
            Excel vers PDF
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Traitement entièrement local dans le navigateur — le fichier n'est jamais envoyé au serveur.
            Vérifiez l'aperçu avant de télécharger.
          </p>
        </div>
        <div className="p-[18px]">
          <label className="flex flex-col items-center gap-3 rounded-sm border border-dashed border-input px-4 py-10 text-center transition-colors hover:border-accent/50 hover:bg-secondary/40">
            <Upload className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-foreground">
              {converting ? (
                "Conversion en cours…"
              ) : (
                <>
                  Cliquez pour choisir un ou plusieurs fichiers{" "}
                  <span className="font-semibold underline underline-offset-2">.xlsx / .xls</span>
                </>
              )}
            </p>
            <input
              type="file"
              accept=".xlsx,.xls"
              multiple
              disabled={converting}
              className="hidden"
              onChange={handleFiles}
            />
          </label>
        </div>

        {items.length > 0 && (
          <ul className="divide-y divide-border border-t border-border">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (item.status !== "ok") return;
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
                  {item.status === "ok" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        download(item);
                      }}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Télécharger le PDF
                    </Button>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </LedgerSheet>

      {active && activeSheetData && (
        <LedgerSheet className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-[18px] py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{active.name}</p>
              <p className="text-xs text-muted-foreground">Comparez la lecture Excel (gauche) et le PDF généré (droite).</p>
            </div>
            <Button type="button" variant="ledger" size="sm" onClick={() => download(active)}>
              <Download className="h-4 w-4" />
              Télécharger le PDF
            </Button>
          </div>
          {sheetOptions.length > 1 && (
            <div className="px-[18px] pt-3">
              <LedgerSegmented
                value={String(activeSheet)}
                onChange={(v) => setActiveSheet(Number(v))}
                options={sheetOptions}
                ariaLabel="Choisir une feuille"
              />
            </div>
          )}
          <div className="grid gap-4 p-[18px] lg:grid-cols-2">
            <div className="min-w-0">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Aperçu Excel
              </p>
              <div className="max-h-[600px] overflow-auto rounded-lg border border-border">
                <table className="w-full border-collapse text-xs">
                  <tbody>
                    {activeSheetData.rows.map((row, ri) => (
                      <tr key={ri} className={ri === 0 && activeSheetData.headerRow ? "bg-muted/60 font-semibold" : ""}>
                        {row.map((cell, ci) => (
                          <td key={ci} className="whitespace-nowrap border border-border px-2 py-1">
                            {String(cell ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="min-w-0">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Aperçu PDF
              </p>
              <iframe
                src={active.pdfUrl ?? undefined}
                title="Aperçu PDF"
                className="h-[600px] w-full rounded-lg border border-border"
              />
            </div>
          </div>
        </LedgerSheet>
      )}
    </div>
  );
}

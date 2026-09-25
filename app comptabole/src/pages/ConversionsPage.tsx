import { useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, FileOutput, TriangleAlert, Upload } from "lucide-react";
import { LedgerPageHeader } from "@/components/ledger/LedgerPageHeader";
import { LedgerSheet } from "@/components/ledger/LedgerSheet";
import { downloadTablesPdf, type PdfSheet } from "@/lib/pdfTables";

interface ConvertedFile {
  id: string;
  name: string;
  status: "ok" | "erreur";
  detail: string;
}

/** Convertit un classeur Excel en PdfSheet[] (une feuille tableur = une
 * partie du PDF) — même lecture que ImportBalanceDialog.tsx, mais sur
 * toutes les feuilles plutôt que la première seule. */
async function xlsxToPdfSheets(file: File): Promise<PdfSheet[]> {
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
  const fileRef = useRef<HTMLInputElement>(null);
  const [converting, setConverting] = useState(false);
  const [processed, setProcessed] = useState<ConvertedFile[]>([]);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setConverting(true);
    const results: ConvertedFile[] = [];
    for (const file of files) {
      const base = file.name.replace(/\.xlsx?$/i, "");
      try {
        const sheets = await xlsxToPdfSheets(file);
        if (sheets.length === 0) {
          results.push({ id: crypto.randomUUID(), name: file.name, status: "erreur", detail: "Fichier vide" });
          continue;
        }
        await downloadTablesPdf({
          title: base,
          subtitle: `${sheets.length} feuille${sheets.length > 1 ? "s" : ""} converties le ${new Date().toLocaleDateString("fr-FR")}`,
          sheets,
          fileName: `${base}.pdf`,
          plain: true,
        });
        results.push({
          id: crypto.randomUUID(),
          name: file.name,
          status: "ok",
          detail: `${sheets.length} feuille${sheets.length > 1 ? "s" : ""} — PDF téléchargé`,
        });
      } catch {
        results.push({
          id: crypto.randomUUID(),
          name: file.name,
          status: "erreur",
          detail: "Fichier illisible — export Excel (.xlsx) attendu",
        });
      }
    }
    setProcessed((prev) => [...results, ...prev]);
    setConverting(false);
    const ok = results.filter((r) => r.status === "ok").length;
    if (ok > 0) toast.success(`${ok} PDF téléchargé${ok > 1 ? "s" : ""}`);
    const failed = results.length - ok;
    if (failed > 0) toast.error(`${failed} fichier${failed > 1 ? "s" : ""} non converti${failed > 1 ? "s" : ""}`);
  }

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
            Chaque feuille du classeur devient une partie du PDF.
          </p>
        </div>
        <div className="p-[18px]">
          <label className="flex flex-col items-center gap-3 rounded-sm border border-dashed border-input px-4 py-12 text-center transition-colors hover:border-accent/50 hover:bg-secondary/40">
            <Upload className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-foreground">
              {converting
                ? "Conversion en cours…"
                : (
                  <>
                    Cliquez pour choisir un ou plusieurs fichiers{" "}
                    <span className="font-semibold underline underline-offset-2">.xlsx / .xls</span>
                  </>
                )}
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              multiple
              disabled={converting}
              className="hidden"
              onChange={handleFiles}
            />
          </label>
        </div>

        {processed.length > 0 && (
          <ul className="divide-y divide-border border-t border-border">
            {processed.map((f) => (
              <li key={f.id} className="flex items-center gap-3 px-[18px] py-2.5">
                {f.status === "ok" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                ) : (
                  <TriangleAlert className="h-4 w-4 shrink-0 text-destructive" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{f.name}</p>
                  <p className="text-xs text-muted-foreground">{f.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </LedgerSheet>
    </div>
  );
}

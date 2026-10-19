import type { PdfSheet } from "@/lib/pdfTables";

/** « 2026-10-19 » -> « 19/10/2026 » à partir des composantes UTC (SheetJS place les dates à minuit UTC). */
const jjmmaaaa = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;

/**
 * Toutes les feuilles non vides d'un classeur Excel, ligne par ligne. Les dates restent des dates (« 24/01/2026 », comme Excel les affiche) :
 * lues sans cette précaution, elles deviennent des numéros de série (46 024,000) dans le PDF ou le texte.
 */
export async function feuillesDeClasseur(buf: ArrayBuffer | Uint8Array): Promise<PdfSheet[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  return wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name];
    const debut = ws["!ref"] ? XLSX.utils.decode_range(ws["!ref"]).s : { r: 0, c: 0 };
    const rows = (XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" }) as unknown[][]).map((ligne, i) =>
      ligne.map((v, j) => {
        if (!(v instanceof Date)) return v as string | number;
        // texte tel qu'Excel l'affiche (format de la case), à défaut jj/mm/aaaa
        const w = ws[XLSX.utils.encode_cell({ r: debut.r + i, c: debut.c + j })]?.w;
        return typeof w === "string" && w.trim() !== "" ? w : jjmmaaaa(v);
      }),
    );
    return { name, headerRow: true, rows };
  }).filter((sheet) => sheet.rows.some((r) => r.some((v) => v !== "" && v != null)));
}

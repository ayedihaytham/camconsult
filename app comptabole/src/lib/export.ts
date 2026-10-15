/** Colonne d'export : libellé d'en-tête + accès à la valeur. */
export interface ExportColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

export type ExportFormat = "csv" | "xlsx";

/** Un texte qui commence par = + - @ (ou tabulation / retour chariot) serait exécuté comme formule à l'ouverture dans Excel : on le
 * préfixe d'une apostrophe. Les nombres (type number) et les textes qui ne sont qu'un montant (« -4 500,500 ») restent intacts. */
export function neutraliserFormule(valeur: string): string {
  // Espaces et caractères de contrôle avant le premier caractère : ignorés par certains tableurs, donc sautés pour le contrôle.
  const debut = valeur.replace(/^[\s\u0000-\u001f\u007f]+/, "");
  if (!/^[=+\-@]/.test(debut) && !/^[\t\r]/.test(valeur)) return valeur;
  if (/^[+-]?[\d\s.,]+$/.test(debut) && /\d/.test(debut) && !/^[\t\r]/.test(valeur)) return valeur;
  return "'" + valeur;
}

function escapeCsv(value: string | number | null | undefined): string {
  const s = typeof value === "string" ? neutraliserFormule(value) : value == null ? "" : String(value);
  if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Construit la chaîne CSV (séparateur `;`, BOM UTF-8 pour Excel FR). Pur, testable. */
export function buildCsv<T>(rows: T[], columns: ExportColumn<T>[]): string {
  const head = columns.map((c) => escapeCsv(c.header)).join(";");
  const body = rows
    .map((row) => columns.map((c) => escapeCsv(c.value(row))).join(";"))
    .join("\n");
  return "﻿" + head + "\n" + body;
}

/** CSV (séparateur `;`, BOM UTF-8 pour Excel FR). */
export function exportToCsv<T>(
  filename: string,
  rows: T[],
  columns: ExportColumn<T>[],
): void {
  download(
    new Blob([buildCsv(rows, columns)], {
      type: "text/csv;charset=utf-8;",
    }),
    filename.endsWith(".csv") ? filename : `${filename}.csv`,
  );
}

/** Excel (.xlsx) — la lib SheetJS est chargée à la demande. */
export async function exportToXlsx<T>(
  filename: string,
  rows: T[],
  columns: ExportColumn<T>[],
  sheetName = "Export",
): Promise<void> {
  const XLSX = await import("xlsx");
  const aoa = [
    columns.map((c) => c.header),
    ...rows.map((row) => columns.map((c) => c.value(row) ?? "")),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = columns.map((c) => ({
    wch: Math.min(
      48,
      Math.max(
        c.header.length + 2,
        ...rows.map((r) => String(c.value(r) ?? "").length + 2),
      ),
    ),
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(
    wb,
    filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`,
  );
}

/** Point d'entrée commun : choisit le format. */
export function exportRows<T>(
  filename: string,
  rows: T[],
  columns: ExportColumn<T>[],
  format: ExportFormat = "csv",
): void {
  if (format === "xlsx") void exportToXlsx(filename, rows, columns);
  else exportToCsv(filename, rows, columns);
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

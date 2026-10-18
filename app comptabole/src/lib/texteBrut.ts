import type { PdfCell } from "@/lib/pdfTables";

const cellule = (v: PdfCell | null | undefined): string => {
  if (typeof v === "number") return v.toLocaleString("fr-FR", { useGrouping: false, maximumFractionDigits: 6 });
  // une tabulation ou un retour à la ligne dans une cellule décalerait les colonnes du fichier texte
  return String(v ?? "").replace(/[\t\r\n]+/g, " ").trim();
};

/** Texte brut d'un classeur ou d'un PDF : une ligne par ligne du tableau, colonnes séparées par une tabulation,
 * montants avec la virgule décimale. Plusieurs feuilles : chacune est précédée de son nom entre crochets. */
export function texteDepuisFeuilles(feuilles: { name: string; rows: PdfCell[][] }[]): string {
  const multi = feuilles.length > 1;
  return feuilles
    .map((f) => {
      const lignes = f.rows.map((r) => r.map(cellule).join("\t").replace(/\t+$/, "")).filter((l) => l !== "");
      return (multi ? [`[${f.name}]`, ...lignes] : lignes).join("\r\n");
    })
    .join("\r\n\r\n");
}

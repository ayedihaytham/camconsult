import { buildTablesPdf, type PdfCell, type PdfSheet } from "@/lib/pdfTables";
import { round3 } from "@/lib/amount";
import { HONORAIRE_TYPE_LABELS, type HonoraireLigne } from "@/types";

const fmt3 = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export interface EtatClientTotals {
  solde: number;
  honoraires: number;
  reglements: number;
}

export function etatClientTotals(list: HonoraireLigne[]): EtatClientTotals {
  return {
    solde: list.length > 0 ? list[list.length - 1].solde : 0,
    honoraires: round3(list.reduce((s, l) => s + l.honoraire, 0)),
    reglements: round3(list.reduce((s, l) => s + l.reglement, 0)),
  };
}

/** Lignes du PDF : en-tête, une ligne par déclaration (avec le nom de la pièce
 * jointe), puis une ligne TOTAL — même colonnes que le tableau à l'écran. */
export function etatClientRows(list: HonoraireLigne[]): PdfCell[][] {
  const header: PdfCell[] = [
    "Type", "Libellé", "CNSS", "N° Quittance", "Mt déclaration",
    "Honoraire", "Total", "Règlement", "Solde", "Pièce jointe",
  ];
  const body: PdfCell[][] = list.map((l) => [
    HONORAIRE_TYPE_LABELS[l.type],
    l.libelle,
    l.cnss,
    l.numQuittance,
    l.montantDeclaration,
    l.honoraire,
    l.total,
    l.reglement || "",
    l.solde,
    l.aPiece ? l.pieceNom : "",
  ]);
  const declarations = round3(list.reduce((s, l) => s + l.montantDeclaration, 0));
  const t = etatClientTotals(list);
  const totalLignes = round3(list.reduce((s, l) => s + l.total, 0));
  const total: PdfCell[] = [
    "TOTAL", "", "", "", declarations, t.honoraires, totalLignes, t.reglements, t.solde, "",
  ];
  return [header, ...body, total];
}

export function etatClientSheets(list: HonoraireLigne[]): PdfSheet[] {
  return [{ name: "État client", headerRow: true, rows: etatClientRows(list) }];
}

/** PDF de l'état client d'une société, avec le gabarit CAMCONSULT habituel. */
export async function buildEtatClientPdf(list: HonoraireLigne[], societeNom: string) {
  const t = etatClientTotals(list);
  const fileName = `Etat_client_${societeNom.replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "")}.pdf`;
  const doc = await buildTablesPdf({
    title: `État client — ${societeNom}`,
    subtitle: `Solde actuel : ${fmt3(t.solde)} TND · Total honoraires : ${fmt3(t.honoraires)} TND · Total règlements reçus : ${fmt3(t.reglements)} TND`,
    sheets: etatClientSheets(list),
    fileName,
  });
  return { doc, fileName };
}

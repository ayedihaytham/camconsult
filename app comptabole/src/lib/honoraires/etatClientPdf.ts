import { buildTablesPdf, type PdfCell, type PdfSheet } from "@/lib/pdfTables";
import { round3 } from "@/lib/amount";
import { recapSociete, type RecapGroupe } from "@/lib/honoraires/recap";
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

/** Tableau d'un détail du récapitulatif (par type ou par année), avec sa ligne de total.
 * Le nombre de lignes est un texte : les nombres du PDF sont toujours écrits avec 3 décimales. */
function groupesRows(libelle: string, groupes: RecapGroupe[], total: RecapGroupe): PdfCell[][] {
  const ligne = (g: RecapGroupe): PdfCell[] => [g.libelle, String(g.nbLignes), g.declare, g.honoraires, g.total, g.reglements, g.solde];
  return [
    [libelle, "Lignes", "Déclaré", "Honoraires", "Total", "Règlements", "Solde"],
    ...groupes.map(ligne),
    ligne({ ...total, libelle: "TOTAL" }),
  ];
}

/** Récapitulatif d'une société : chiffres clés, puis détail par type de déclaration et par année. */
export function etatClientRecapSheets(list: HonoraireLigne[]): PdfSheet[] {
  const r = recapSociete(list);
  const total: RecapGroupe = { cle: "", libelle: "TOTAL", nbLignes: r.nbLignes, declare: r.declare, honoraires: r.honoraires, total: r.total, reglements: r.reglements, solde: r.solde };
  return [
    {
      name: "Récapitulatif",
      headerRow: true,
      rows: [
        ["Indicateur", "Montant (TND)"],
        ["Déclarations à reverser", r.declare],
        ["Honoraires", r.honoraires],
        ["Total dû", r.total],
        ["Règlements reçus", r.reglements],
        ["Solde dû", r.solde],
        ["Dernier règlement", r.dernierReglement ? r.dernierReglement.split("-").reverse().join("/") : "—"],
      ],
    },
    { name: "Par type de déclaration", headerRow: true, totalRows: 1, rows: groupesRows("Type", r.parType, total) },
    { name: "Par année", headerRow: true, totalRows: 1, rows: groupesRows("Année", r.parAnnee, total) },
  ];
}

export function etatClientSheets(list: HonoraireLigne[]): PdfSheet[] {
  return [
    ...(list.length > 0 ? etatClientRecapSheets(list) : []),
    { name: "Registre des déclarations", headerRow: true, rows: etatClientRows(list) },
  ];
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

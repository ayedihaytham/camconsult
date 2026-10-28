// Classeur Excel « façon cabinet » pour les fichiers convertis : même présentation que l'export des tableaux de Collecte
// (src/lib/collecte/exportStyled.ts) : titre bleu, sous-titre gris, bandeau d'en-têtes bleu foncé, bordures grises fines,
// lignes blanches et gris clair en alternance, montants à trois décimales, dates en jj/mm/aaaa, volet figé sous les en-têtes.
// ExcelJS est chargé à la demande (lourd), au moment du téléchargement seulement.
import type { Cell, Worksheet } from "exceljs";
import type { PdfSheet } from "@/lib/pdfTables";
import { nomsDeFeuilles } from "@/lib/pdfToTables";

const BLEU = "FF1F4E79";
const GRIS_BORD = "FFC8C8C8";
const GRIS_LIGNE = "FFF7F8FA";
const MONTANT = "#,##0.000";
const ENTIER = "#,##0";
/** Ligne des en-têtes : sous le titre, le sous-titre et une ligne vide (comme les tableaux de Collecte). */
export const LIGNE_ENTETES = 4;

const fill = (argb: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } });
const bordure = {
  top: { style: "thin" as const, color: { argb: GRIS_BORD } },
  left: { style: "thin" as const, color: { argb: GRIS_BORD } },
  bottom: { style: "thin" as const, color: { argb: GRIS_BORD } },
  right: { style: "thin" as const, color: { argb: GRIS_BORD } },
};

/** « 02-01-2026 » ou « 02/01/2026 » (jour, mois et année valides) : une vraie date Excel ; sinon null. */
export function dateDepuisTexte(valeur: unknown): Date | null {
  const m = /^(\d{2})[-/](\d{2})[-/](\d{4})$/.exec(String(valeur ?? "").trim());
  if (!m) return null;
  const [j, mo, a] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(a, mo - 1, j));
  return date.getUTCFullYear() === a && date.getUTCMonth() === mo - 1 && date.getUTCDate() === j ? date : null;
}

/** Format d'une colonne de nombres : trois décimales dès qu'une valeur en a, sinon des entiers (n° de pièce, compte). */
function formatColonne(valeurs: unknown[]): string {
  const nombres = valeurs.filter((v): v is number => typeof v === "number");
  return nombres.some((n) => !Number.isInteger(n)) ? MONTANT : ENTIER;
}

export interface OptionsModele {
  /** Titre du document (par défaut le nom de la feuille). */
  titre?: string;
  /** Mention sous le titre (par défaut : date de conversion et nombre de lignes). */
  sousTitre?: string;
  /** Nom du cabinet, pour les propriétés du fichier et le pied de page. */
  cabinet?: string;
}

function habillerFeuille(ws: Worksheet, f: PdfSheet, options: OptionsModele, avecTitre: boolean) {
  const nbCols = Math.max(1, ...f.rows.map((r) => r.length));
  const entetes = f.headerRow && f.rows.length > 0 ? f.rows[0] : null;
  const donnees = entetes ? f.rows.slice(1) : f.rows;
  const premiere = LIGNE_ENTETES + (entetes ? 1 : 0);

  const t = ws.getCell("A1");
  t.value = (avecTitre && options.titre) || f.name;
  t.font = { bold: true, size: 16, color: { argb: BLEU } };
  const s = ws.getCell("A2");
  s.value = options.sousTitre ?? `Converti le ${new Date().toLocaleDateString("fr-FR")} · ${donnees.length} ligne${donnees.length > 1 ? "s" : ""}`;
  s.font = { italic: true, size: 10, color: { argb: "FF7F7F7F" } };

  if (entetes) {
    const r = ws.getRow(LIGNE_ENTETES);
    for (let j = 0; j < nbCols; j++) {
      const c = r.getCell(j + 1);
      c.value = String(entetes[j] ?? "");
      c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      c.fill = fill(BLEU);
      c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      c.border = bordure;
    }
    r.height = 30;
  }

  // Bandeaux de groupes (ex. VENTE, ACHAT) sur la ligne vide au-dessus des en-têtes.
  if (entetes && f.groupes?.length) {
    f.groupes.forEach((g, i) => {
      ws.mergeCells(LIGNE_ENTETES - 1, g.de + 1, LIGNE_ENTETES - 1, g.a + 1);
      const c = ws.getCell(LIGNE_ENTETES - 1, g.de + 1);
      c.value = g.titre;
      c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
      c.fill = fill(i % 2 === 0 ? BLEU : "FF2E75B6");
      c.alignment = { horizontal: "center", vertical: "middle" };
      c.border = bordure;
    });
  }

  const formats = Array.from({ length: nbCols }, (_, j) => formatColonne(donnees.map((r) => r[j])));
  donnees.forEach((ligne, i) => {
    const r = ws.getRow(premiere + i);
    for (let j = 0; j < nbCols; j++) {
      const brut = ligne[j];
      const c: Cell = r.getCell(j + 1);
      const date = typeof brut === "string" ? dateDepuisTexte(brut) : null;
      if (date) {
        c.value = date;
        c.numFmt = "dd/mm/yyyy";
        c.alignment = { horizontal: "center", vertical: "middle" };
      } else if (typeof brut === "number") {
        c.value = brut;
        c.numFmt = formats[j];
        c.alignment = { horizontal: "right", vertical: "middle" };
      } else if (brut !== "" && brut != null) {
        c.value = String(brut);
        c.alignment = { horizontal: "left", vertical: "middle" };
      }
      c.border = bordure;
      const total = i >= donnees.length - (f.totalRows ?? 0);
      c.fill = fill(total ? "FFE8EEF5" : i % 2 === 1 ? GRIS_LIGNE : "FFFFFFFF");
      if (total) c.font = { bold: true, color: { argb: BLEU } };
    }
  });

  ws.columns = Array.from({ length: nbCols }, (_, j) => ({
    width: Math.min(60, Math.max(12, ...f.rows.map((r) => String(r[j] ?? "").length + 3))),
  }));
  // Volet figé sous les en-têtes, filtre sur la ligne d'en-têtes, impression : paysage si large, ajusté à la largeur, en-têtes répétés.
  ws.views = [{ state: "frozen", ySplit: entetes ? LIGNE_ENTETES : 3 }];
  if (entetes && donnees.length > 0) ws.autoFilter = { from: { row: LIGNE_ENTETES, column: 1 }, to: { row: LIGNE_ENTETES, column: nbCols } };
  ws.pageSetup = {
    orientation: nbCols >= 6 ? "landscape" : "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    ...(entetes ? { printTitlesRow: `${LIGNE_ENTETES}:${LIGNE_ENTETES}` } : {}),
  };
  ws.headerFooter = { oddFooter: `&L${options.cabinet ?? "Document converti"}&RPage &P / &N` };
}

/** Classeur .xlsx (octets) aux couleurs du cabinet : une feuille par tableau, mêmes données que le classeur simple. */
export async function classeurExcelModele(feuilles: PdfSheet[], options: OptionsModele = {}): Promise<Uint8Array<ArrayBuffer>> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = options.cabinet ?? "CamConsult";
  wb.created = new Date();
  const noms = nomsDeFeuilles(feuilles.map((f) => f.name));
  feuilles.forEach((f, i) => habillerFeuille(wb.addWorksheet(noms[i]), f, options, feuilles.length === 1));
  const tampon = await wb.xlsx.writeBuffer();
  return new Uint8Array(tampon as ArrayBuffer);
}

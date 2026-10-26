import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { classeurExcelModele, dateDepuisTexte, LIGNE_ENTETES } from "./modeleExcelCabinet";
import type { PdfSheet } from "./pdfTables";

const releve: PdfSheet = {
  name: "Releve",
  headerRow: true,
  rows: [
    ["Date", "Libellé de l'opération", "N° pièce", "Débit", "Crédit"],
    ["31-12-2025", "Solde au: 31/12/2025", 1, 0, 16426.68],
    ["02-01-2026", "TVA sur Com", 2, 0.95, 0],
    ["02-01-2026", "Commission de Negociation LC", 3, 189.844, 0],
    ["13-01-2026", "ACHAT VENTE DEVISE", 4, 0, 67100],
  ],
};

async function lire(feuilles: PdfSheet[], options = {}) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await classeurExcelModele(feuilles, options)) as unknown as ArrayBuffer);
  return wb;
}
const couleur = (c: ExcelJS.Cell) => (c.fill as ExcelJS.FillPattern | undefined)?.fgColor?.argb;

describe("classeur Excel au modèle du cabinet", () => {
  it("reprend la présentation de Collecte : titre bleu, sous-titre, bandeau d'en-têtes bleu foncé, volet figé", async () => {
    const wb = await lire([releve], { titre: "Releve_compte_mensuel1-2026" });
    const ws = wb.getWorksheet("Releve")!;
    expect(ws.getCell("A1").value).toBe("Releve_compte_mensuel1-2026");
    expect(ws.getCell("A1").font).toMatchObject({ bold: true, size: 16, color: { argb: "FF1F4E79" } });
    expect(String(ws.getCell("A2").value)).toMatch(/Converti le .* · 4 lignes/);
    for (let j = 1; j <= 5; j++) {
      const c = ws.getRow(LIGNE_ENTETES).getCell(j);
      expect(couleur(c)).toBe("FF1F4E79");
      expect(c.font).toMatchObject({ bold: true, color: { argb: "FFFFFFFF" } });
    }
    expect(ws.getCell(LIGNE_ENTETES, 2).value).toBe("Libellé de l'opération");
    expect(ws.views[0]).toMatchObject({ state: "frozen", ySplit: LIGNE_ENTETES });
    expect(ws.autoFilter).toBeTruthy();
    expect(ws.pageSetup).toMatchObject({ fitToPage: true, fitToWidth: 1, orientation: "portrait" });
  });

  it("met les dates en vraies dates, les montants à trois décimales, les n° en entiers, et alterne les lignes", async () => {
    const ws = (await lire([releve])).getWorksheet("Releve")!;
    const premiere = LIGNE_ENTETES + 1;
    const date = ws.getCell(premiere, 1);
    expect(date.value).toBeInstanceOf(Date);
    expect((date.value as Date).toISOString().slice(0, 10)).toBe("2025-12-31");
    expect(date.numFmt).toBe("dd/mm/yyyy");
    expect(ws.getCell(premiere + 1, 4).value).toBe(0.95);
    expect(ws.getCell(premiere + 1, 4).numFmt).toBe("#,##0.000");
    expect(ws.getCell(premiere + 1, 4).alignment?.horizontal).toBe("right");
    expect(ws.getCell(premiere, 3).numFmt).toBe("#,##0");
    expect(ws.getCell(premiere, 2).alignment?.horizontal).toBe("left");
    expect(couleur(ws.getCell(premiere, 2))).toBe("FFFFFFFF");
    expect(couleur(ws.getCell(premiere + 1, 2))).toBe("FFF7F8FA");
    expect(ws.getCell(premiere, 2).border?.top?.color?.argb).toBe("FFC8C8C8");
  });

  it("ne touche pas aux valeurs : mêmes montants, mêmes textes, même nombre de lignes", async () => {
    const ws = (await lire([releve])).getWorksheet("Releve")!;
    const lues = [];
    for (let i = LIGNE_ENTETES + 1; i < LIGNE_ENTETES + 5; i++) lues.push([ws.getCell(i, 2).value, ws.getCell(i, 4).value, ws.getCell(i, 5).value]);
    expect(lues).toEqual([["Solde au: 31/12/2025", 0, 16426.68], ["TVA sur Com", 0.95, 0], ["Commission de Negociation LC", 189.844, 0], ["ACHAT VENTE DEVISE", 0, 67100]]);
  });

  it("un document sans ligne d'en-têtes n'a pas de bandeau : les données suivent le titre, et plusieurs tableaux gardent leur nom", async () => {
    const wb = await lire([{ name: "Page 1", rows: [["a", "b"], ["c", "d"]] }, { name: "Page 2", rows: [["e", "f"]] }]);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Page 1", "Page 2"]);
    const ws = wb.getWorksheet("Page 1")!;
    expect(ws.getCell("A1").value).toBe("Page 1");
    expect(ws.getCell(LIGNE_ENTETES, 1).value).toBe("a");
    expect(ws.autoFilter).toBeFalsy();
  });

  it("n'accepte comme date que des dates valides en quatre chiffres", () => {
    expect(dateDepuisTexte("02-01-2026")?.toISOString().slice(0, 10)).toBe("2026-01-02");
    expect(dateDepuisTexte("02/01/2026")?.toISOString().slice(0, 10)).toBe("2026-01-02");
    expect(dateDepuisTexte("31-02-2026")).toBeNull();
    expect(dateDepuisTexte("2/1/26")).toBeNull();
    expect(dateDepuisTexte("Solde au: 31/12/2025")).toBeNull();
    expect(dateDepuisTexte("")).toBeNull();
  });

  it("un relevé large passe en paysage", async () => {
    const large: PdfSheet = { name: "Large", headerRow: true, rows: [Array.from({ length: 7 }, (_, i) => `C${i}`), Array.from({ length: 7 }, (_, i) => i)] };
    expect((await lire([large])).getWorksheet("Large")!.pageSetup.orientation).toBe("landscape");
  });
});

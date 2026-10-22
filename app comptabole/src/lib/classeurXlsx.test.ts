import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import * as XLSX from "xlsx";

/**
 * Garde-fou de la bibliothèque Excel (SheetJS 0.20.3, copie locale dans vendor/) : un vrai classeur écrit par un autre lecteur (exceljs) est lu
 * avec les options des écrans d'import (`cellDates`, `header: 1`, `raw`, `defval`), et les montants ne bougent pas d'un millime.
 * Données synthétiques. Un changement de version qui modifierait une valeur lue fait échouer ce test.
 */
async function classeur(): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Récapitulatif été");
  ws.addRow(["Libellé", "Montant", "Taux", "Code", "Date"]);
  ws.addRow(["Facture A", 999999999.999, 3.2842, "00123", new Date(Date.UTC(2026, 7, 31, 12, 0, 0))]);
  ws.addRow(["Facture B", 0.1 + 0.2, 3.3167, "7", null]);
  ws.addRow(["", null, null, "", null]);
  ws.addRow(["Total", { formula: "B2+B3", result: 1000000000.299 }, null, null, null]);
  ws.mergeCells("A6:C6");
  ws.getCell("A6").value = "Fusion";
  wb.addWorksheet("Vide");
  const tampon = await wb.xlsx.writeBuffer();
  return tampon instanceof ArrayBuffer ? tampon : (tampon as Uint8Array).buffer.slice((tampon as Uint8Array).byteOffset, (tampon as Uint8Array).byteOffset + (tampon as Uint8Array).byteLength) as ArrayBuffer;
}

describe("lecture d'un classeur .xlsx (SheetJS)", () => {
  it("garde les noms de feuilles accentués, les montants au millime, le texte numérique et les formules", async () => {
    const wb = XLSX.read(await classeur(), { type: "array", cellDates: true });
    expect(wb.SheetNames).toEqual(["Récapitulatif été", "Vide"]);
    const lignes = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets["Récapitulatif été"], { header: 1, raw: true, defval: "" });
    expect(lignes[0]).toEqual(["Libellé", "Montant", "Taux", "Code", "Date"]);
    expect(lignes[1][1]).toBe(999999999.999);
    expect(lignes[1][2]).toBe(3.2842);
    expect(lignes[1][3]).toBe("00123"); // le zéro initial n'est pas perdu
    expect(Math.round(Number(lignes[2][1]) * 1000) / 1000).toBe(0.3);
    expect(lignes[4][1]).toBe(1000000000.299); // valeur en cache de la formule
    expect(lignes[5][0]).toBe("Fusion");
    expect(wb.Sheets["Récapitulatif été"]["!merges"]?.length).toBe(1);
  });

  it("lit les dates Excel en vraies dates (cellDates) et laisse vides les cellules vides", async () => {
    const wb = XLSX.read(await classeur(), { type: "array", cellDates: true });
    const lignes = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets["Récapitulatif été"], { header: 1, raw: true, defval: "" });
    const date = lignes[1][4];
    expect(date).toBeInstanceOf(Date);
    expect((date as Date).getUTCFullYear()).toBe(2026);
    expect((date as Date).getUTCMonth()).toBe(7);
    expect(lignes[2][4]).toBe("");
    expect(XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets["Vide"], { header: 1 }).flat()).toEqual([]);
  });

  it("un fichier qui n'est pas un classeur lève une erreur (jamais un blocage)", () => {
    expect(() => XLSX.read(new Uint8Array([1, 2, 3, 4]).buffer, { type: "array" })).not.toThrow(RangeError);
  });

  it("n'est pas exposé à la pollution de prototype par un nom de feuille", () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["a"]]), "__proto__x");
    const relu = XLSX.read(XLSX.write(wb, { type: "array", bookType: "xlsx" }), { type: "array" });
    expect(relu.SheetNames).toEqual(["__proto__x"]);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("une écriture/relecture garde les montants avec leur format à trois décimales", () => {
    const ws = XLSX.utils.aoa_to_sheet([["Montant"], [1234.567], [0.001]]);
    ws["A2"].z = "#,##0.000";
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Feuille1");
    const relu = XLSX.read(XLSX.write(wb, { type: "array", bookType: "xlsx" }), { type: "array" });
    const lignes = XLSX.utils.sheet_to_json<unknown[]>(relu.Sheets["Feuille1"], { header: 1, raw: true });
    expect(lignes[1][0]).toBe(1234.567);
    expect(lignes[2][0]).toBe(0.001);
  });
});

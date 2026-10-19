import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { feuillesDeClasseur } from "./classeurFeuilles";

function classeur(feuilles: Record<string, unknown[][]>, formatsDate = "dd/mm/yyyy") {
  const wb = XLSX.utils.book_new();
  for (const [nom, rows] of Object.entries(feuilles)) {
    const ws = XLSX.utils.aoa_to_sheet(rows, { cellDates: true });
    for (const adr of Object.keys(ws)) if (ws[adr]?.t === "d") ws[adr].z = formatsDate;
    XLSX.utils.book_append_sheet(wb, ws, nom);
  }
  return XLSX.write(wb, { type: "array", bookType: "xlsx", cellDates: true }) as ArrayBuffer;
}

describe("feuillesDeClasseur", () => {
  it("garde les dates comme dates (jj/mm/aaaa) et les montants comme nombres", async () => {
    const buf = classeur({ Banque: [["Date", "Libellé", "Montant"], [new Date(Date.UTC(2026, 0, 24)), "Paiement", 37500], [new Date(Date.UTC(2026, 11, 5)), "Virement", 100.5]] });
    const [f] = await feuillesDeClasseur(buf);
    expect(f.name).toBe("Banque");
    expect(f.rows[1]).toEqual(["24/01/2026", "Paiement", 37500]);
    expect(f.rows[2]).toEqual(["05/12/2026", "Virement", 100.5]);
  });

  it("une feuille qui ne commence pas en A1 garde ses dates à la bonne place", async () => {
    const ws = XLSX.utils.sheet_add_aoa({} as XLSX.WorkSheet, [["Date", "Montant"], [new Date(Date.UTC(2026, 2, 1)), 10]], { cellDates: true, origin: "C3" });
    ws["C4"].z = "dd/mm/yyyy";
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Décalée");
    const [f] = await feuillesDeClasseur(XLSX.write(wb, { type: "array", bookType: "xlsx", cellDates: true }) as ArrayBuffer);
    expect(f.rows.flat().filter((c) => c !== "")).toEqual(["Date", "Montant", "01/03/2026", 10]);
  });

  it("ignore les feuilles vides", async () => {
    const buf = classeur({ Vide: [[]], Pleine: [["a", "b"], [1, 2]] });
    expect((await feuillesDeClasseur(buf)).map((f) => f.name)).toEqual(["Pleine"]);
  });
});

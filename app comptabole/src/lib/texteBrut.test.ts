import { describe, expect, it } from "vitest";
import { buildTablesPdf } from "./pdfTables";
import { texteDepuisFeuilles } from "./texteBrut";

describe("texteDepuisFeuilles", () => {
  it("une feuille : lignes séparées par des tabulations, virgule décimale, sans espace de milliers", () => {
    const t = texteDepuisFeuilles([{ name: "A", rows: [["Date", "Montant"], ["01/10", 1234.5], ["", ""], ["Total", ""]] }]);
    expect(t).toBe("Date\tMontant\r\n01/10\t1234,5\r\nTotal");
  });

  it("plusieurs feuilles : chacune est précédée de son nom ; tabulations et retours dans une cellule aplatis", () => {
    const t = texteDepuisFeuilles([
      { name: "Un", rows: [["a\tb\nc"]] },
      { name: "Deux", rows: [["x"]] },
    ]);
    expect(t).toBe("[Un]\r\na b c\r\n\r\n[Deux]\r\nx");
  });
});

describe("buildTablesPdf : modèle complet (logo, coordonnées, en-tête courant, pied de page)", () => {
  const lignes = Array.from({ length: 80 }, (_, i) => [`Ligne ${i + 1}`, i * 10]);
  const base = { title: "Balance", subtitle: "1 feuille", sheets: [{ name: "S", rows: [["Libellé", "Montant"], ...lignes], headerRow: true }], fileName: "x.pdf", plain: true };

  it("sans logo : le nom du cabinet le remplace, plusieurs pages, coordonnées dans le pied de page", async () => {
    const doc = await buildTablesPdf({ ...base, logo: null, cabinet: { nom: "Cabinet Test", adresse: "1 rue A", matriculeFiscal: "123", telephone: "71 000 000", email: "a@b.tn" } });
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    const pdf = doc.output();
    expect(pdf).toContain("Cabinet Test");
    expect(pdf).toContain("MF 123");
    expect(pdf).toContain("Page 2 /");
  });

  it("logo illisible : le PDF est tout de même fabriqué", async () => {
    const doc = await buildTablesPdf({ ...base, logo: "data:image/png;base64,AAAA", cabinet: null });
    expect(doc.getNumberOfPages()).toBeGreaterThan(0);
  });

  it("sans en-tête : aucun bloc de cabinet", async () => {
    const doc = await buildTablesPdf({ ...base, entete: false, logo: null, cabinet: { nom: "Cabinet Test" } });
    expect(doc.output()).not.toContain("Cabinet Test");
  });
});

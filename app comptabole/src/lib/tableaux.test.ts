import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { feuillesDePdf, lireTextePdf, modeDePdf } from "./pdfToTables";
import { detecterTableaux } from "./tableaux";

describe("detecterTableaux", () => {
  it("garde le tableau et écarte le titre, l'adresse et les mentions qui l'entourent", () => {
    const t = detecterTableaux([
      ["SOCIÉTÉ EXEMPLE"],
      ["12 rue A, Tunis"],
      [],
      ["Balance 2026"],
      ["Compte", "Libellé", "Débit", "Crédit"],
      ["601000", "Achats", 100, ""],
      ["622600", "Honoraires", "", 50],
      ["TOTAL", "", 100, 50],
      [],
      ["Établi par : le cabinet"],
    ]);
    expect(t).toHaveLength(1);
    expect(t[0].nom).toBe("Balance 2026");
    expect(t[0].rows).toEqual([["Compte", "Libellé", "Débit", "Crédit"], ["601000", "Achats", 100, ""], ["622600", "Honoraires", "", 50], ["TOTAL", "", 100, 50]]);
    expect([t[0].debut, t[0].fin]).toEqual([4, 7]);
  });

  it("une ligne blanche sépare deux tableaux ; un intitulé isolé au milieu ne coupe pas un tableau", () => {
    const t = detecterTableaux([
      ["A", "B"], [1, 2], [3, 4],
      [],
      ["Date", "Montant"], ["PRODUITS"], ["01/01", 10], ["02/01", 20],
    ]);
    expect(t).toHaveLength(2);
    expect(t[0].rows).toHaveLength(3);
    expect(t[1].rows).toHaveLength(4);
    expect(t[1].rows[1]).toEqual(["PRODUITS", ""]);
    expect(t.map((x) => x.nom)).toEqual(["Tableau 1", "Tableau 2"]);
  });

  it("retire les colonnes entièrement vides (colonnes d'espacement d'un classeur)", () => {
    const t = detecterTableaux([["Date", "", "", "Montant"], ["01/01", "", "", 10], ["02/01", "", "", 20]]);
    expect(t[0].rows).toEqual([["Date", "Montant"], ["01/01", 10], ["02/01", 20]]);
  });

  it("ne prend pas pour un tableau une ligne seule, une liste d'une colonne ou un texte", () => {
    expect(detecterTableaux([["Titre"], ["Une note"], ["Une autre note"]])).toEqual([]);
    expect(detecterTableaux([["a", "b"]])).toEqual([]);
    expect(detecterTableaux([])).toEqual([]);
  });

  it("seuils réglables : un PDF exige au moins 3 colonnes et 3 lignes", () => {
    const rows = [["Texte", "suite"], ["autre", "texte"], ["a", "b", "c"], ["d", "e", "f"], ["g", "h", "i"]];
    const t = detecterTableaux(rows, { minColonnes: 3, minLignes: 3 });
    expect(t).toHaveLength(1);
    expect(t[0].rows).toHaveLength(3);
  });
});

const PDF = "samples/cah_charg_dep_fact_compressed.pdf";
describe.skipIf(!existsSync(PDF))("PDF réel : « tableaux seulement »", () => {
  it("repère les tableaux de chaque page ; sans l'option, le document complet est converti", async () => {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const pages = await lireTextePdf(pdfjs as never, new Uint8Array(readFileSync(PDF)).buffer as ArrayBuffer);
    expect(modeDePdf(pages)).toBe("tableaux");
    const seuls = feuillesDePdf(pages, { tableauSeul: true });
    expect(seuls.length).toBeGreaterThan(0);
    for (const f of seuls) expect(Math.max(...f.rows.map((r) => r.length))).toBeGreaterThanOrEqual(3);
    const un = feuillesDePdf(pages, { tableauSeul: true, uneSeuleFeuille: true });
    expect(un).toHaveLength(1);
    expect(feuillesDePdf(pages).length).toBeGreaterThan(0);
  });

  it("un texte courant sans tableau reste converti en entier (mode complet)", () => {
    expect(modeDePdf([[{ str: "Bonjour le monde", x: 10, y: 10, w: 80, h: 10 }]])).toBe("complet");
  });
});

import { describe, expect, it } from "vitest";
import { extraireMouvements, type PdfTextItem } from "./pdfToTables";

const t = (str: string, x: number, y: number, w = str.length * 5): PdfTextItem => ({ str, x, y, w, h: 9 });

describe("en-tête d'un relevé précédé d'un texte d'introduction", () => {
  it("ne prend pas « détaillé » du texte courant pour l'intitulé de la colonne libellé", () => {
    const page: PdfTextItem[] = [
      t("ci-dessous le relevé détaillé des opérations", 30, 700),
      t("Nous avons l'honneur de vous communiquer", 30, 712),
      t("Date", 40, 600), t("Libellé de l'operation", 150, 600), t("Débit", 330, 600), t("Crédit", 430, 600),
      t("04-09-2026", 40, 570), t("LC Payment Credit", 150, 570), t("0,000", 335, 570), t("39 100,000", 420, 570),
      t("09-09-2026", 40, 540), t("Paiement Echeance", 150, 540), t("45 561,600", 315, 540), t("0,000", 440, 540),
      t("principal", 150, 528),
    ];
    const m = extraireMouvements([page]);
    expect(m?.[0]).toEqual(["Date", "Libellé de l'opération", "Débit", "Crédit"]);
    expect(m?.length).toBe(3);
    expect(m?.[2][1]).toBe("Paiement Echeance principal");
  });
});

import { harmoniserLibelles } from "./controleReleve";

describe("description répétée par l'OCR", () => {
  it("réduit « X … X tronqué » à une seule description même sans libellé modèle", () => {
    const m = harmoniserLibelles([["Date", "Libellé de l'opération", "Débit", "Crédit"], ["01-09-2026", "Virement recu de l'etranger Virement recu de l'etr", "0,000", "10,000"]]);
    expect(m[1][1]).toBe("Virement recu de l'etranger");
  });
});

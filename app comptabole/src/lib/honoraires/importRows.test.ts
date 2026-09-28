import { describe, expect, it } from "vitest";
import { parseRows, toType } from "./importRows";

describe("import Excel de l'état client", () => {
  const raw: unknown[][] = [
    ["ÉTAT CLIENT — 01-RUSPINA"],
    [],
    ["Type", "Période", "Nature", "Libellé", "Réf. CNSS", "N° Quittance", "Montant déclaration", "Honoraire", "Règlement reçu", "Note"],
    ["Mensuelle", "Avril 2026", "CNSS", "", "1234", "Q-9", "1 234,567", 150.5, "100.25", "ok"],
    ["Acompte 1", "2026", "", "", "", "", 3000, 0, 0, ""],
    ["", "", "", "", "", "", "", "", "", ""],
    ["TOTAL", "", "", "", "", "", 4234.567, 150.5, 100.25, ""],
  ];

  it("reconnaît l'en-tête, lit les millimes et suggère le libellé manquant", () => {
    const rows = parseRows(raw);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      type: "mensuelle",
      periode: "Avril 2026",
      libelle: "CNSS Avril 2026",
      cnss: "1234",
      numQuittance: "Q-9",
      montantDeclaration: 1234.567,
      honoraire: 150.5,
      reglement: 100.25,
    });
    expect(rows[1]).toMatchObject({ type: "acompte1", libelle: "AP 01-2026", montantDeclaration: 3000 });
  });

  it("ignore lignes vides et lignes de total, refuse un fichier sans colonne de montant", () => {
    expect(parseRows(raw).some((r) => /total/i.test(r.libelle))).toBe(false);
    expect(parseRows([["Nom", "Ville"], ["a", "b"]])).toEqual([]);
  });

  it("déduit le type du cabinet depuis un texte libre", () => {
    expect(toType("2e acompte")).toBe("acompte2");
    expect(toType("AP 03")).toBe("acompte3");
    expect(toType("Trimestrielle")).toBe("trimestrielle");
    expect(toType("Annuel")).toBe("annuelle");
    expect(toType("divers")).toBe("autre");
  });
});

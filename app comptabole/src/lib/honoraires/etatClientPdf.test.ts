import { describe, expect, it } from "vitest";
import type { HonoraireLigne } from "@/types";
import { etatClientRows, etatClientSheets, etatClientTotals } from "./etatClientPdf";

const ligne = (over: Partial<HonoraireLigne>): HonoraireLigne => ({
  id: "1", societeId: "s", ordre: 1, type: "mensuelle", nature: "", periode: "",
  libelle: "DMI AVRIL 2026", cnss: "", numQuittance: "M037257",
  montantDeclaration: 141.429, honoraire: 0, reglement: 0, dateReglement: null, note: "",
  pieceNom: "", pieceFormat: "", pieceTaille: "", aPiece: false,
  total: 141.429, solde: 141.429, creeLe: "", majLe: "",
  ...over,
});

describe("PDF de l'état client", () => {
  const list = [
    ligne({}),
    ligne({
      id: "2", libelle: "DMI MAI 2026", montantDeclaration: 487.824, total: 487.824,
      solde: 629.253, aPiece: true, pieceNom: "quittance-mai.pdf", reglement: 100,
    }),
  ];

  it("produit en-tête, une ligne par déclaration avec le nom de la pièce, et un total", () => {
    const rows = etatClientRows(list);
    expect(rows).toHaveLength(4);
    expect(rows[0][9]).toBe("Pièce jointe");
    expect(rows[1][9]).toBe("");
    expect(rows[2][9]).toBe("quittance-mai.pdf");
    expect(rows[2][7]).toBe(100);
    expect(rows[3]).toEqual(["TOTAL", "", "", "", 629.253, 0, 629.253, 100, 629.253, ""]);
  });

  it("calcule solde, honoraires et règlements au millime", () => {
    expect(etatClientTotals(list)).toEqual({ solde: 629.253, honoraires: 0, reglements: 100 });
    expect(etatClientTotals([])).toEqual({ solde: 0, honoraires: 0, reglements: 0 });
  });
});

describe("récapitulatif dans le PDF", () => {
  const list = [
    ligne({ id: "1", montantDeclaration: 30, honoraire: 30, reglement: 30.333, dateReglement: "2026-05-03", libelle: "DMI avril 2026" }),
    ligne({ id: "2", type: "trimestrielle", montantDeclaration: 100, honoraire: 50, libelle: "T4 2025" }),
  ];

  it("commence par la synthèse, puis le détail par type et par année, puis le registre", () => {
    const sheets = etatClientSheets(list);
    expect(sheets.map((s) => s.name)).toEqual(["Récapitulatif", "Par type de déclaration", "Par année", "Registre des déclarations"]);
    const synthese = sheets[0].rows;
    expect(synthese[1]).toEqual(["Déclarations à reverser", 130]);
    expect(synthese[4]).toEqual(["Règlements reçus", 30.333]);
    expect(synthese[5]).toEqual(["Solde dû", 179.667]);
    expect(synthese[6]).toEqual(["Dernier règlement", "03/05/2026"]);
  });

  it("totalise chaque détail et garde le nombre de lignes en texte", () => {
    const [, parType] = etatClientSheets(list);
    expect(parType.rows[0][0]).toBe("Type");
    expect(parType.rows.at(-1)).toEqual(["TOTAL", "2", 130, 80, 210, 30.333, 179.667]);
    expect(parType.rows[1][1]).toBe("1");
  });

  it("n'ajoute pas de récapitulatif à un état vide", () => {
    expect(etatClientSheets([]).map((s) => s.name)).toEqual(["Registre des déclarations"]);
  });
});

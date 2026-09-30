import { describe, expect, it } from "vitest";
import type { HonoraireLigne } from "@/types";
import { etatClientRows, etatClientTotals } from "./etatClientPdf";

const ligne = (over: Partial<HonoraireLigne>): HonoraireLigne => ({
  id: "1", societeId: "s", ordre: 1, type: "mensuelle", nature: "", periode: "",
  libelle: "DMI AVRIL 2026", cnss: "", numQuittance: "M037257",
  montantDeclaration: 141.429, honoraire: 0, reglement: 0, note: "",
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

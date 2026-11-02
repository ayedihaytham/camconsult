import { describe, expect, it } from "vitest";
import { natureDeFrais, syntheseFrais } from "./banqueFrais";

const l = (type: "frais" | "autre" | "change", dateOp: string, libelle: string, debit: number, credit = 0) => ({ type, dateOp, libelle, debit, credit });

describe("frais bancaires", () => {
  it("les numéros de dossier sont retirés pour regrouper une même nature de frais", () => {
    expect(natureDeFrais("COMMISSION DOMICILIATION 46493")).toBe("COMMISSION DOMICILIATION");
    expect(natureDeFrais("TVA sur Com")).toBe("TVA sur Com");
    expect(natureDeFrais("123456")).toBe("123456");
    expect(natureDeFrais("COMMISSION CONFIRMATION LC REF BTL: CEX2026375 - ISSUING BANK REF: IMLC---26")).toBe(natureDeFrais("COMMISSION CONFIRMATION LC REF BTL: CEX2026319 - ISSUING BANK REF: 201ILC2026/0341"));
    expect(natureDeFrais("FRAIS POSTE LC N°IMLC-8356-005-25 BYOUT EL EZZ")).toBe("FRAIS POSTE LC BYOUT EL EZZ");
  });

  it("total, nombre, part des débits, par mois et par nature (la plus coûteuse d'abord)", () => {
    const s = syntheseFrais([
      l("frais", "2026-09-01", "TVA sur Com", 0.38),
      l("frais", "2026-09-01", "Commission reglement", 2),
      l("frais", "2026-09-10", "TVA sur Com", 0.38),
      l("frais", "2026-10-02", "COMMISSION DOMICILIATION 461", 15),
      l("frais", "2026-10-03", "COMMISSION DOMICILIATION 464", 15),
      l("autre", "2026-09-05", "ACHAT", 1000),
      l("change", "2026-09-06", "VENTE DEVISE", 0, 500),
    ]);
    expect(s.total).toBe(32.76);
    expect(s.nb).toBe(5);
    expect(s.part).toBeCloseTo(32.76 / 1032.76, 6);
    expect(s.parMois).toEqual([{ mois: "2026-09", total: 2.76, nb: 3 }, { mois: "2026-10", total: 30, nb: 2 }]);
    expect(s.parNature.map((n) => [n.libelle, n.total, n.nb])).toEqual([["COMMISSION DOMICILIATION", 30, 2], ["Commission reglement", 2, 1], ["TVA sur Com", 0.76, 2]]);
  });

  it("un remboursement de frais vient en déduction ; sans frais, tout est vide", () => {
    expect(syntheseFrais([l("frais", "2026-09-01", "COMMISSION", 10), l("frais", "2026-09-02", "COMMISSION", 0, 4)]).total).toBe(6);
    const vide = syntheseFrais([l("autre", "2026-09-01", "X", 5)]);
    expect(vide).toMatchObject({ total: 0, nb: 0, parMois: [], parNature: [] });
  });
});

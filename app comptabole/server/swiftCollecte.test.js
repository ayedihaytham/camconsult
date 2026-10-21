import { describe, expect, it } from "vitest";
import { ligneSwift, plagePeriode } from "./swiftCollecte.js";

describe("période d'une collecte", () => {
  it("lit un mois, un trimestre, un semestre, une année ou un exercice", () => {
    expect(plagePeriode("Octobre 2026")).toEqual({ du: "2026-10-01", au: "2026-10-31" });
    expect(plagePeriode("Février 2028")).toEqual({ du: "2028-02-01", au: "2028-02-29" });
    expect(plagePeriode("août 2026")).toEqual({ du: "2026-08-01", au: "2026-08-31" });
    expect(plagePeriode("T3 2026")).toEqual({ du: "2026-07-01", au: "2026-09-30" });
    expect(plagePeriode("S1 2026")).toEqual({ du: "2026-01-01", au: "2026-06-30" });
    expect(plagePeriode("S2 2026")).toEqual({ du: "2026-07-01", au: "2026-12-31" });
    expect(plagePeriode("2026")).toEqual({ du: "2026-01-01", au: "2026-12-31" });
    expect(plagePeriode("Exercice 2025")).toEqual({ du: "2025-01-01", au: "2025-12-31" });
  });

  it("un texte non reconnu ne filtre rien", () => {
    expect(plagePeriode("Clôture annuelle")).toBeNull();
    expect(plagePeriode("")).toBeNull();
    expect(plagePeriode(undefined)).toBeNull();
  });
});

describe("ligne du tableau « État SWIFT » pour un virement", () => {
  const v = { id: "v1", date_operation: new Date(2026, 9, 12), libelle: "ACHAT NEGOCIE SUR LE MARCHE", banque: "BANQ", montant: "7672.600" };

  it("sans facture : date, libellé, banque et montant ; la justification reste à saisir", () => {
    expect(ligneSwift(v)).toEqual({ date: "2026-10-12", libelle: "ACHAT NEGOCIE SUR LE MARCHE", banque: "BANQ", montant: 7672.6, num_facture: "", devise: "", montant_devise: "", observations: "", _swift: "v1" });
  });

  it("avec des factures : n° regroupés, devise commune et total en devise", () => {
    const l = ligneSwift(v, [
      { num_facture: "F1", montant_devise: "1000", devise: "eur" },
      { num_facture: "F2", montant_devise: "500.5", devise: "EUR" },
    ]);
    expect(l).toMatchObject({ num_facture: "F1, F2", devise: "EUR", montant_devise: 1500.5 });
  });

  it("devises mélangées : pas de total (il n'aurait pas de sens)", () => {
    const l = ligneSwift(v, [{ num_facture: "F1", montant_devise: "10", devise: "EUR" }, { num_facture: "F2", montant_devise: "10", devise: "USD" }]);
    expect(l).toMatchObject({ num_facture: "F1, F2", devise: "", montant_devise: "" });
  });
});

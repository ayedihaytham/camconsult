import { describe, expect, it } from "vitest";
import { ligneFactureSwift, ligneSwift, plagePeriode, refSwift } from "./swiftCollecte.js";

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

describe("lignes du tableau « État SWIFT » : en-tête de virement et factures", () => {
  const v = { id: "ab12cd34-0000-0000-0000-000000000000", date_operation: new Date(2026, 9, 12), libelle: "ACHAT NEGOCIE SUR LE MARCHE", banque: "BANQ", montant: "7672.600" };

  it("la référence identifie le groupe du virement", () => {
    expect(refSwift(v)).toBe("SWIFT-AB12CD");
  });

  it("en-tête : date, réf., libellé, banque et montant ; les factures sont à ajouter par la société", () => {
    expect(ligneSwift(v)).toEqual({
      date: "2026-10-12", ref: "SWIFT-AB12CD", libelle: "ACHAT NEGOCIE SUR LE MARCHE", banque: "BANQ", montant: 7672.6,
      num_facture: "", devise: "", montant_devise: "", taux: "", montant_tnd: "", observations: "", _swift: v.id,
    });
  });

  it("facture : colonnes du virement répétées sans son montant, plus n°, devise, montant en devise, taux et équivalent en dinars", () => {
    const f = { id: "f1", num_facture: "FA-77", devise: "eur", montant_devise: "2300", taux: "3.3", montant_tnd: "7590" };
    expect(ligneFactureSwift(v, f)).toEqual({
      date: "2026-10-12", ref: "SWIFT-AB12CD", libelle: "ACHAT NEGOCIE SUR LE MARCHE", banque: "BANQ", montant: "",
      num_facture: "FA-77", devise: "EUR", montant_devise: 2300, taux: 3.3, montant_tnd: 7590, observations: "", _swiftf: "f1",
    });
  });
});

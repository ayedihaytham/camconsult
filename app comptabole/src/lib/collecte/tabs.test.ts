import { describe, expect, it } from "vitest";
import { TAB_BY_KEY, joursDepuis } from "./tabs";

const today = new Date(2026, 8, 24); // 24/09/2026

describe("joursDepuis", () => {
  it("compte les jours depuis une date ISO ou française", () => {
    expect(joursDepuis("2026-09-14", today)).toBe(10);
    expect(joursDepuis("14/09/2026", today)).toBe(10);
    expect(joursDepuis("2026-09-24", today)).toBe(0);
  });
  it("vide sans date, jamais négatif", () => {
    expect(joursDepuis("", today)).toBe("");
    expect(joursDepuis(undefined, today)).toBe("");
    expect(joursDepuis("2026-10-01", today)).toBe(0);
  });
});

describe("balance âgée", () => {
  it("calcule solde final dû et ancienneté", () => {
    const [row] = TAB_BY_KEY.etat_clients.derive!([
      { solde_initial: "100", facture: "1 200,50", regle: 300, date_dernier_reglement: "" },
    ]);
    expect(row.solde_final).toBe(1000.5);
    expect(row.anciennete).toBe("");
    expect(TAB_BY_KEY.etat_clients.columns.find((c) => c.key === "anciennete")?.computed).toBe(true);
  });
});

describe("TTC des ventes et des achats", () => {
  it("ajoute le montant non soumis et le timbre après la TVA", () => {
    for (const cle of ["chiffre_affaires", "detail_achats"]) {
      const [row] = TAB_BY_KEY[cle].derive!([{ montant_ht: "100", tva_pct: "19", non_soumis: "10", timbre: "1" }]);
      expect(row.montant_ttc).toBe(130);
      expect(TAB_BY_KEY[cle].columns.find((c) => c.key === "timbre")?.defaut).toBe("1.000");
    }
  });
  it("une ligne qui n'a que le timbre pré-rempli n'a pas de TTC", () => {
    const [row] = TAB_BY_KEY.detail_achats.derive!([{ montant_ht: "", tva_pct: "", non_soumis: "", timbre: "1.000" }]);
    expect(row.montant_ttc).toBe(0);
  });
});

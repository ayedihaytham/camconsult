import { describe, expect, it } from "vitest";
import { anomalieReglement, calculerRs, lignesEtat, recapFournisseurs, soldesFactures } from "./fournisseurs";
import type { FactureFournisseur, ReglementFournisseur } from "@/types";

const facture = (id: string, montant: number, patch: Partial<FactureFournisseur> = {}): FactureFournisseur => ({
  id,
  fournisseur: "SOTACIB",
  fournisseurCle: "sotacib",
  numFacture: `F${id}`,
  date: "2026-01-08",
  devise: "TND",
  cours: 0,
  quantite: 100,
  designation: "CEM I 52,5",
  prixUnitaire: montant / 100,
  montant,
  montantTnd: montant,
  venteNumFacture: "",
  douaneNumDeclaration: "",
  suivi: { numProforma: "", dateProforma: null, montantProforma: 0, etatProforma: "", numTitre: "", etatChargement: "", vuPasse: "" },
  ...patch,
});

const reglement = (id: string, affectations: [string, number][], patch: Partial<ReglementFournisseur> = {}): ReglementFournisseur => {
  const brut = affectations.reduce((s, [, m]) => s + m, 0);
  return {
    id,
    fournisseurCle: "sotacib",
    date: "2026-01-20",
    mode: "cheque",
    reference: "CHQ 1",
    banque: "BTL",
    devise: "TND",
    cours: 0,
    rsTaux: 0.5,
    rsNumero: "",
    rsMontant: calculerRs(brut, 0.5),
    note: "",
    mouvementBancaireId: null,
    brut,
    vire: brut - calculerRs(brut, 0.5),
    affectations: affectations.map(([mouvementId, montant]) => ({ mouvementId, montant })),
    ...patch,
  };
};

describe("retenue à la source", () => {
  it("applique le taux au montant réglé (0,5 % chez SOTACIB, 1 % chez Enfidha)", () => {
    expect(calculerRs(47241.6, 0.5)).toBe(236.208);
    expect(calculerRs(36000, 1)).toBe(360);
    expect(calculerRs(100, 0)).toBe(0);
  });
});

describe("soldes des factures", () => {
  const fs = [facture("1", 1000), facture("2", 500), facture("3", 200)];

  it("distingue réglée, partielle et impayée", () => {
    const s = soldesFactures(fs, [reglement("r1", [["1", 1000], ["2", 200]])]);
    expect(s.get("1")).toEqual({ regle: 1000, solde: 0, statut: "reglee" });
    expect(s.get("2")).toEqual({ regle: 200, solde: 300, statut: "partielle" });
    expect(s.get("3")).toEqual({ regle: 0, solde: 200, statut: "impayee" });
  });

  it("additionne plusieurs règlements d'une même facture", () => {
    const s = soldesFactures(fs, [reglement("r1", [["1", 400]]), reglement("r2", [["1", 600]])]);
    expect(s.get("1")?.statut).toBe("reglee");
  });
});

describe("récapitulatif des fournisseurs", () => {
  it("totalise facturé, réglé, RS et solde par fournisseur et par devise, plus gros solde d'abord", () => {
    const fs = [
      facture("1", 1000),
      facture("2", 500),
      facture("3", 3000, { fournisseur: "ENFIDHA", fournisseurCle: "enfidha" }),
      facture("4", 80, { devise: "EUR" }),
    ];
    const rg = [reglement("r1", [["1", 1000]], { rsMontant: 5 })];
    const recap = recapFournisseurs(fs, rg);
    expect(recap.map((r) => r.nom)).toEqual(["ENFIDHA", "SOTACIB"]);
    const sotacib = recap[1];
    expect(sotacib.nbFactures).toBe(3);
    expect(sotacib.nbImpayees).toBe(2);
    expect(sotacib.totaux).toEqual([
      { devise: "EUR", facture: 80, regle: 0, rs: 0, solde: 80 },
      { devise: "TND", facture: 1500, regle: 1000, rs: 5, solde: 500 },
    ]);
  });

  it("garde l'orthographe la plus fréquente d'un fournisseur", () => {
    const fs = [facture("1", 10, { fournisseur: "Sotacib" }), facture("2", 10), facture("3", 10)];
    expect(recapFournisseurs(fs, [])[0].nom).toBe("SOTACIB");
  });
});

describe("lignes de l'état d'un fournisseur", () => {
  it("regroupe les factures d'un règlement, puis ajoute les parts non réglées", () => {
    const fs = [facture("1", 1000), facture("2", 500, { date: "2026-01-05" }), facture("3", 200), facture("9", 70, { fournisseurCle: "autre" })];
    const lignes = lignesEtat("sotacib", fs, [reglement("r1", [["1", 1000], ["2", 200]])]);
    expect(lignes.map((l) => [l.facture.id, l.reglement?.id ?? null, l.montant, l.debutGroupe, l.rang])).toEqual([
      ["2", "r1", 200, true, 2],
      ["1", "r1", 1000, false, 2],
      ["2", null, 300, true, 1],
      ["3", null, 200, true, 1],
    ]);
  });
});

describe("anomalies", () => {
  it("signale un règlement daté avant sa facture", () => {
    const f = facture("1", 100, { date: "2025-05-25" });
    expect(anomalieReglement(reglement("r", [["1", 100]], { date: "2025-05-20" }), [f])).toMatch(/avant/);
    expect(anomalieReglement(reglement("r", [["1", 100]], { date: "2025-06-01" }), [f])).toBeNull();
  });
});

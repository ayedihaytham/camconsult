import { describe, expect, it } from "vitest";
import { ecrituresDepuisReleve, montantEcriture, texteEcritures } from "./ecrituresReleve";

const rows = [
  ["Date", "Libellé de l'opération", "Débit", "Crédit"],
  ["31-12-2025", "Solde au: 31/12/2025", 0, 16426.68],
  ["05-01-2023", "ACHAT VENTE DEVISE", 0, 3000],
  ["05-01-2023", "TVA sur Com", 0.76, 0],
  ["06-01-2023", "sans montant", 0, 0],
];

describe("écritures d'un relevé converti", () => {
  it("fait deux lignes par mouvement : banque puis contrepartie, sans le solde", () => {
    expect(ecrituresDepuisReleve(rows)).toEqual([
      { date: "05/01/2023", journal: "BQ", numero: 1, compte: "53200001", debit: 3000, credit: 0 },
      { date: "05/01/2023", journal: "BQ", numero: 1, compte: "0", debit: 0, credit: 3000 },
      { date: "05/01/2023", journal: "BQ", numero: 2, compte: "53200001", debit: 0, credit: 0.76 },
      { date: "05/01/2023", journal: "BQ", numero: 2, compte: "0", debit: 0.76, credit: 0 },
    ]);
  });

  it("lit les montants écrits en texte et accepte un autre compte", () => {
    const r = ecrituresDepuisReleve([["Date", "Libellé", "Débit", "Crédit"], ["02/01/26", "x", "1 200,500", "0,000"]], "512");
    expect(r?.[0]).toMatchObject({ date: "02/01/2026", compte: "512", credit: 1200.5, debit: 0 });
  });

  it("renvoie null sans colonnes Date / Débit / Crédit", () => {
    expect(ecrituresDepuisReleve([["a", "b"], ["1", "2"]])).toBeNull();
  });

  it("écrit les montants avec espace des milliers et trois décimales", () => {
    expect(montantEcriture(3000)).toBe("3 000,000");
    expect(montantEcriture(0)).toBe("");
  });

  it("écrit le fichier texte à tabulations, une ligne par écriture", () => {
    const t = texteEcritures(ecrituresDepuisReleve(rows)!);
    expect(t.split("\r\n")).toEqual([
      "05/01/2023\tBQ\t1\t0\t0\t0\t53200001\t3 000,000\t",
      "05/01/2023\tBQ\t1\t0\t0\t0\t0\t\t3 000,000",
      "05/01/2023\tBQ\t2\t0\t0\t0\t53200001\t\t0,760",
      "05/01/2023\tBQ\t2\t0\t0\t0\t0\t0,760\t",
      "",
    ]);
  });
});

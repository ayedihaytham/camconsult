import { describe, expect, it } from "vitest";
import { noter, similaire } from "./benchmarkScoring.js";

const attendu = {
  type: "achat",
  date: "2023-01-02",
  numFacture: "6608000533",
  partie: "SOCIETE DES CIMENTS D'ENFIDHA",
  devise: "EUR",
  lignes: [{ designation: "Ciment", quantite: 1000, prixUnitaire: 52, montantDevise: 52000 }],
};

describe("similaire", () => {
  it("tolère la casse, la ponctuation et une petite faute de lecture", () => {
    expect(similaire("Société des Ciments d'Enfidha", "SOCIETE DES CIMENTS D'ENFIDHA")).toBe(true);
    expect(similaire("SOCIETE DES CIMENT D ENFIDHA", "SOCIETE DES CIMENTS D'ENFIDHA")).toBe(true);
    expect(similaire("GROUP BYOUT EZZ", "RUSPINA IMPORT EXPORT")).toBe(false);
    expect(similaire("", "X")).toBe(false);
  });
});

describe("noter", () => {
  it("compte les champs et les lignes retrouvés", () => {
    const lecture = {
      type: "achat",
      date: "2023-01-02",
      numFacture: "6608 000533",
      partie: "Société des ciments d'Enfidha",
      devise: "eur",
      lignes: [{ designation: "Portland cement", quantite: 1000, prixUnitaire: 52, montantDevise: 52000 }],
    };
    const { champs, lignes } = noter(lecture, attendu);
    expect(Object.values(champs).every(Boolean)).toBe(true);
    expect(lignes).toEqual({ attendues: 1, trouvees: 1, lues: 1 });
  });

  it("signale les écarts, y compris une ligne fausse ou manquante", () => {
    const lecture = {
      type: "vente",
      date: "2023-02-01",
      numFacture: "6608000533",
      partie: "AUTRE",
      devise: "EUR",
      lignes: [{ designation: "X", quantite: 1000, prixUnitaire: 53, montantDevise: 53000 }],
    };
    const { champs, lignes } = noter(lecture, attendu);
    expect(champs).toMatchObject({ type: false, date: false, numFacture: true, partie: false, devise: true });
    expect(lignes).toEqual({ attendues: 1, trouvees: 0, lues: 1 });
  });

  it("ne note que les champs présents dans la vérité terrain", () => {
    const { champs, lignes } = noter({ type: "douane", numDeclaration: "447898" }, { numDeclaration: "447898" });
    expect(champs).toEqual({ numDeclaration: true });
    expect(lignes).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { quantiteComparable, stockMouvementDto, uniteDeComparaison } from "./mappers.js";

const ligne = (categorie, designation, quantite, unite = "") => ({
  id: `${categorie}-${designation}-${quantite}`,
  categorie,
  designation,
  quantite,
  prix_unitaire: 0,
  montant_devise: 0,
  montant_tnd: 0,
  unite,
});

const mouvement = { id: "m1", societe_id: "s1", nature_marchandise: "Ciment" };

describe("écart achat - vente selon l'unité", () => {
  it("ramène les kilos en tonnes quand achat et vente n'ont pas la même unité", () => {
    const dto = stockMouvementDto(mouvement, [ligne("achat", "CIMENT", 370000, "KG"), ligne("vente", "CIMENT", 370, "T")]);
    expect(dto.ecart).toBe(0);
    expect(dto.ecartUnite).toBe("T");
    expect(dto.ecartParDesignation[0]).toMatchObject({ achatQuantite: 370, venteQuantite: 370, ecart: 0 });
  });

  it("signale un vrai écart, exprimé en tonnes", () => {
    const dto = stockMouvementDto(mouvement, [ligne("achat", "CIMENT", 400000, "KG"), ligne("vente", "CIMENT", 370, "T")]);
    expect(dto.ecart).toBe(30);
    expect(dto.ecartUnite).toBe("T");
  });

  it("compare tel quel quand l'unité est la même ou absente", () => {
    const memeUnite = stockMouvementDto(mouvement, [ligne("achat", "CIMENT", 1000, "T"), ligne("vente", "CIMENT", 900, "T")]);
    expect(memeUnite.ecart).toBe(100);
    expect(memeUnite.ecartUnite).toBe("T");
    const sansUnite = stockMouvementDto(mouvement, [ligne("achat", "CIMENT", 1000), ligne("vente", "CIMENT", 1000)]);
    expect(sansUnite.ecart).toBe(0);
    expect(sansUnite.ecartUnite).toBe("");
  });

  it("n'applique aucune conversion à une unité inconnue mélangée à une unité connue", () => {
    expect(uniteDeComparaison([{ unite: "T" }], [{ unite: "" }])).toBe("T");
    expect(quantiteComparable({ quantite: 5, unite: "" }, "T")).toBe(5);
    expect(quantiteComparable({ quantite: 5000, unite: "KG" }, "T")).toBe(5);
    expect(quantiteComparable({ quantite: 5000, unite: "KG" }, "KG")).toBe(5000);
  });

  it("garde l'unité de chaque ligne dans le mouvement", () => {
    const dto = stockMouvementDto(mouvement, [ligne("achat", "CIMENT", 370000, "KG")]);
    expect(dto.achatLignes[0].unite).toBe("KG");
  });
});

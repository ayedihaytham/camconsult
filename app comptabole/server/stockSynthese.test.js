import { describe, expect, it } from "vitest";
import { syntheseStock, valeurRestante } from "./stockSynthese.js";

const mouvement = (id, societeId, extra = {}) => ({
  id, societe_id: societeId, achat_devise: "EUR", achat_cours: 3.4, vente_devise: "EUR", vente_cours: 3.4,
  maj_le: "2026-10-10T08:00:00Z", cree_le: "2026-10-10T08:00:00Z", ...extra,
});
const ligne = (mouvementId, categorie, quantite, montantTnd, unite = "T") => ({ id: `${mouvementId}-${categorie}`, mouvement_id: mouvementId, categorie, designation: "Ciment", quantite, montant_tnd: montantTnd, unite });

describe("synthèse du stock par société", () => {
  it("valorise le stock restant au prorata de la quantité achetée non vendue", () => {
    const lignes = [ligne("m1", "achat", 100, 1000), ligne("m1", "vente", 60, 700)];
    const synthese = syntheseStock([mouvement("m1", "s1")], lignes);
    expect(synthese.s1.valeur).toBe(400);
    expect(synthese.s1.alertes).toBe(1);
    expect(synthese.s1.mouvements).toBe(1);
  });

  it("ne valorise rien quand tout est vendu, et ne signale aucune alerte", () => {
    const lignes = [ligne("m1", "achat", 100, 1000), ligne("m1", "vente", 100, 1300)];
    const synthese = syntheseStock([mouvement("m1", "s1")], lignes);
    expect(synthese.s1.valeur).toBe(0);
    expect(synthese.s1.alertes).toBe(0);
  });

  it("compte les cours de change à saisir, seulement pour les côtés facturés en devise", () => {
    const lignes = [ligne("m1", "achat", 10, 100), ligne("m2", "achat", 10, 100)];
    const synthese = syntheseStock(
      [mouvement("m1", "s1", { achat_cours: 0 }), mouvement("m2", "s1", { achat_devise: "TND", achat_cours: 0 })],
      lignes,
    );
    expect(synthese.s1.coursManquants).toBe(1);
    expect(synthese.s1.enDevise).toBe(1);
  });

  it("ne montre que les sociétés visibles et la date du dernier mouvement", () => {
    const synthese = syntheseStock(
      [mouvement("m1", "s1", { maj_le: "2026-10-01T08:00:00Z" }), mouvement("m2", "s1", { maj_le: "2026-10-09T08:00:00Z" }), mouvement("m3", "s2")],
      [],
      (id) => id === "s1",
    );
    expect(Object.keys(synthese)).toEqual(["s1"]);
    expect(synthese.s1.dernierLe).toBe("2026-10-09T08:00:00Z");
  });

  it("valeurRestante est nulle sans quantité", () => {
    expect(valeurRestante({ achatLignes: [{ quantite: 0, unite: "", montantTnd: 50 }], ecartUnite: "", ecart: 5 })).toBe(0);
  });
});

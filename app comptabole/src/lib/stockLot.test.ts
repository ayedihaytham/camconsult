import { describe, expect, it } from "vitest";
import { mouvementDuGroupe, proximite, mots, regrouperPieces, type PieceLot } from "./stockLot";
import type { StockChamps, StockDocType, StockLigne } from "@/types";

const ligne = (designation: string, quantite: number, prixUnitaire: number): StockLigne => ({
  designation, quantite, prixUnitaire, montantDevise: quantite * prixUnitaire, montantTnd: 0, unite: "T",
});

function piece(id: string, type: StockDocType, champs: StockChamps, confiance: PieceLot["confiance"] = "haute"): PieceLot {
  const vide: Record<StockDocType, StockChamps> = { achat: {}, vente: {}, douane: {} };
  return { id, fichier: id, page: 0, imageDataUrl: null, typeDevine: type, confiance, champsByType: { ...vide, [type]: champs } };
}

const achat = (id: string, num: string, fournisseur: string, produit: string, qte: number, date = "2026-01-05") =>
  piece(id, "achat", { date, numFacture: num, fournisseur, devise: "EUR", lignes: [ligne(produit, qte, 44)] });
const vente = (id: string, num: string, client: string, produit: string, qte: number, date = "2026-01-20") =>
  piece(id, "vente", { date, numFacture: num, client, devise: "EUR", lignes: [ligne(produit, qte, 60)] });
const douane = (id: string, exportateur: string, valeurTnd: number, date = "2026-01-15") =>
  piece(id, "douane", { numDeclaration: `D-${id}`, date, tauxChange: 3.3, valeurTnd, ptfn: 1, exportateur, importateur: "CAM" });

describe("rapprochement d'un lot de pièces", () => {
  it("compare des mots, pas des phrases : « SOTACIB » est contenu dans « SOTACIB KAIROUAN »", () => {
    expect(proximite(mots("SOTACIB"), mots("Sotacib Kairouan SA"))).toBe(1);
    expect(proximite(mots("Ciment Portland CEM I"), mots("Huile d'olive"))).toBe(0);
  });

  it("rapproche chaque vente de l'achat qui a le même produit et la même quantité, et la déclaration de l'exportateur", () => {
    const pieces = [
      achat("a1", "F1", "SOTACIB KAIROUAN", "CIMENT CEM I 42,5", 1000),
      achat("a2", "F2", "PET FLAKES LTD", "HOT WASHED PET FLAKES", 500),
      vente("v2", "V2", "Client B", "HOT WASHED PET FLAKES", 500),
      vente("v1", "V1", "Client A", "CIMENT CEM I 42,5", 1000),
      douane("d1", "Sotacib", 1000 * 44 * 3.3),
    ];
    const groupes = regrouperPieces(pieces, {});
    expect(groupes).toHaveLength(2);
    const g1 = groupes.find((g) => g.achat?.id === "a1");
    const g2 = groupes.find((g) => g.achat?.id === "a2");
    expect(g1?.vente?.id).toBe("v1");
    expect(g1?.douane?.id).toBe("d1");
    expect(g2?.vente?.id).toBe("v2");
    expect(g2?.douane).toBeNull();
  });

  it("une vente d'un autre produit n'est pas rapprochée : chaque pièce reste seule avec une alerte", () => {
    const groupes = regrouperPieces([achat("a1", "F1", "X", "CIMENT", 1000), vente("v1", "V1", "Client", "HUILE D'OLIVE", 300)], {});
    expect(groupes).toHaveLength(2);
    expect(groupes.every((g) => g.statut === "verifier")).toBe(true);
  });

  it("une pièce corrigée ou écartée change le résultat", () => {
    const pieces = [achat("a1", "F1", "X", "CIMENT", 1000), vente("v1", "V1", "C", "CIMENT", 1000)];
    expect(regrouperPieces(pieces, { v1: "ignorer" })).toHaveLength(1);
    expect(regrouperPieces(pieces, {})[0].statut).toBe("pret");
  });

  it("signale un montant qui ne correspond pas à quantité × prix, une confiance faible et un champ absent", () => {
    const faux = piece("a1", "achat", { date: "2026-01-05", numFacture: "F1", fournisseur: "X", devise: "EUR", lignes: [{ ...ligne("CIMENT", 1000, 44), montantDevise: 50000 }] }, "faible");
    const [g] = regrouperPieces([faux, vente("v1", "V1", "C", "CIMENT", 1000)], {});
    expect(g.statut).toBe("verifier");
    expect(g.anomalies.a1.join(" ")).toMatch(/confiance faible/);
    expect(g.anomalies.a1.join(" ")).toMatch(/quantité × prix/);
  });

  it("refuse une facture déjà dans le stock ou répétée dans le lot", () => {
    const existants = [{ id: "m", achatNumFacture: "F1", venteNumFacture: "", fournisseur: "X" }];
    const [g] = regrouperPieces([achat("a1", "F1", "X", "CIMENT", 1000)], {}, existants);
    expect(g.statut).toBe("doublon");
    const deux = regrouperPieces([achat("a1", "F9", "X", "CIMENT", 1000), achat("a2", "F9", "X", "CIMENT", 1000)], {});
    expect(deux[0].statut).not.toBe("doublon");
    expect(deux[1].statut).toBe("doublon");
  });

  it("signale une vente supérieure à l'achat", () => {
    const [g] = regrouperPieces([achat("a1", "F1", "X", "CIMENT", 1000), vente("v1", "V1", "C", "CIMENT", 1000)], {});
    expect(g.alertes).toEqual([]);
    const gros = regrouperPieces([achat("a1", "F1", "X", "CIMENT", 1000), piece("v1", "vente", { date: "2026-01-20", numFacture: "V1", client: "C", devise: "EUR", lignes: [ligne("CIMENT", 1000, 60), ligne("CIMENT", 200, 60)] })], {});
    expect(gros[0].alertes.join(" ")).toMatch(/Quantité vendue supérieure/);
  });

  it("construit le mouvement à créer à partir des pièces du groupe", () => {
    const [g] = regrouperPieces([achat("a1", "F1", "SOTACIB", "CIMENT", 1000), vente("v1", "V1", "CLIENT", "CIMENT", 1000), douane("d1", "Sotacib", 145200)], {});
    const m = mouvementDuGroupe(g, "soc-1");
    expect(m).toMatchObject({ societeId: "soc-1", fournisseur: "SOTACIB", achatNumFacture: "F1", client: "CLIENT", venteNumFacture: "V1", douaneNumDeclaration: "D-d1", douaneTauxChange: 3.3, natureMarchandise: "CIMENT" });
    expect(m.achatLignes[0]).toMatchObject({ quantite: 1000, montantDevise: 44000, montantTnd: 0 });
  });
});

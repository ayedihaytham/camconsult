import { describe, expect, it } from "vitest";
import { champsVidesCote, coteRenseigne, mouvementDuGroupe, mouvementVide, proximite, mots, regrouperPieces, resumeQuantite, type PieceLot } from "./stockLot";
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

  it("une facture d'achat seule ou de vente seule est acceptée : chaque pièce non rapprochée devient son propre mouvement, prêt", () => {
    const groupes = regrouperPieces([achat("a1", "F1", "X", "CIMENT", 1000), vente("v1", "V1", "Client", "HUILE D'OLIVE", 300)], {});
    expect(groupes).toHaveLength(2);
    expect(groupes.every((g) => g.statut === "pret")).toBe(true);
    expect(groupes.every((g) => g.alertes.length === 0)).toBe(true);
    expect(groupes.map((g) => [Boolean(g.achat), Boolean(g.vente)]).sort()).toEqual([[false, true], [true, false]]);
  });

  it("une déclaration sans aucune facture reste à vérifier", () => {
    const [g] = regrouperPieces([douane("d1", "Sotacib", 1000)], {});
    expect(g.statut).toBe("verifier");
    expect(g.alertes.join(" ")).toMatch(/sans facture/);
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

describe("retrait d'un type de facture d'un mouvement", () => {
  it("remet à zéro un seul côté : l'achat sans toucher à la vente ni à la douane", () => {
    const champs = champsVidesCote("achat") as Record<string, unknown>;
    expect(Object.keys(champs)).toEqual(expect.arrayContaining(["fournisseur", "achatNumFacture", "achatDate", "achatLignes", "achatDocDataUrl", "achatCours", "achatDevise"]));
    expect(Object.keys(champs).some((k) => k.startsWith("vente") || k.startsWith("douane") || k === "client")).toBe(false);
    expect(champs.achatLignes).toEqual([]);
    expect(champs.achatDocDataUrl).toBeNull();
    expect(Object.keys(champsVidesCote("vente"))).toEqual(expect.arrayContaining(["client", "venteNumFacture", "venteLignes", "venteDocDataUrl"]));
    expect(Object.keys(champsVidesCote("douane"))).toEqual(expect.arrayContaining(["douaneNumDeclaration", "douaneValeurTnd", "douaneDocDataUrl"]));
  });

  it("sait si un côté porte quelque chose", () => {
    const m = { ...mouvementVide("s"), id: "m", ordre: 1, ecart: 0, ecartUnite: "", ecartParDesignation: [], creeLe: "", majLe: "" } as never;
    expect(coteRenseigne(m, "achat")).toBe(false);
    expect(coteRenseigne({ ...(m as object), fournisseur: "SOTACIB" } as never, "achat")).toBe(true);
    expect(coteRenseigne({ ...(m as object), douaneNumDeclaration: "D1" } as never, "douane")).toBe(true);
    expect(coteRenseigne({ ...(m as object), client: "C" } as never, "achat")).toBe(false);
  });
});

describe("lecture incomplète et quantités d'une pièce", () => {
  it("une page que le moteur n'a pas lue est signalée avec sa raison, et un écart de poids net aussi", () => {
    const nonLue = { ...achat("a1", "", "", "", 0), erreur: "service d'extraction surchargé ou indisponible : relancez la lecture" };
    const [g] = regrouperPieces([nonLue], {});
    expect(g.statut).toBe("verifier");
    expect(g.anomalies.a1.join(" ")).toMatch(/Page non lue : service d'extraction surchargé/);

    const avecEcart = piece("a2", "achat", { date: "2026-01-05", numFacture: "F2", fournisseur: "X", devise: "EUR", lignes: [ligne("CIMENT", 50, 44)], avertissements: ["Quantité lue (50 T) différente du poids net imprimé (61,305 T)"] });
    const [h] = regrouperPieces([avecEcart], {});
    expect(h.statut).toBe("verifier");
    expect(h.anomalies.a2.join(" ")).toMatch(/poids net imprimé/);
  });

  it("écrit la quantité d'une facture avec son unité, en tonnes quand tonnes et kilos se mélangent", () => {
    const l = (quantite: number, unite: string): StockLigne => ({ designation: "X", quantite, prixUnitaire: 1, montantDevise: quantite, montantTnd: 0, unite });
    expect(resumeQuantite([l(61.305, "T")])).toBe("61,305 T");
    expect(resumeQuantite([l(2000, "KG")]).replace(/\s/g, " ")).toBe("2 000 KG");
    expect(resumeQuantite([l(1, "T"), l(500, "KG")])).toBe("1,5 T");
    expect(resumeQuantite([l(48, "")])).toBe("48");
    expect(resumeQuantite([])).toBe("");
  });
});

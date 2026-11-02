import { describe, expect, it } from "vitest";
import { changeDe, montantTndCote, montantTndLigne, recapStock, totauxCote } from "./stockRecap";
import { montantCote } from "./coursStock";
import { feuilleRecapSociete, recapSociete, sansCoursTnd } from "./stockRecapSociete";
import type { StockLigne, StockMouvement } from "@/types";

const ligne = (montantDevise: number, montantTnd: number): StockLigne => ({ designation: "HOT WASHED PET FLAKES", quantite: 10, prixUnitaire: 100, montantDevise, montantTnd, unite: "T" });

const mouvement = (patch: Partial<StockMouvement>): StockMouvement => ({
  id: "m", societeId: "s", ordre: 0, natureMarchandise: "PET",
  achatDate: null, achatNumFacture: "", achatDocType: "", fournisseur: "", achatDevise: "EUR", achatCours: 0, achatLignes: [],
  venteDate: null, venteNumFacture: "", venteDocType: "", client: "", venteDevise: "EUR", venteCours: 0, venteLignes: [],
  douaneNumDeclaration: "", douaneDate: null, douaneRegime: "", douaneTypeDeclaration: "", douaneReference: "", douaneTauxChange: 0, douaneValeurTnd: 0, douanePtfn: 0, douaneExportateur: "", douaneImportateur: "",
  achatDocDataUrl: null, venteDocDataUrl: null, douaneDocDataUrl: null, note: "", ecart: 0, ecartUnite: "T", ecartParDesignation: [], creeLe: "", majLe: "", ...patch,
});

describe("montant en dinars d'une ligne de stock : saisi, sinon montant en devise × cours", () => {
  it("un montant en dinars saisi est toujours conservé, même si un cours existe", () => {
    expect(montantTndLigne(ligne(1000, 3412), { cours: 3.4, devise: "EUR" })).toBe(3412);
  });

  it("un montant à 0 avec un cours connu est calculé : 1 000 EUR × 3,4 = 3 400", () => {
    expect(montantTndLigne(ligne(1000, 0), { cours: 3.4, devise: "EUR" })).toBe(3400);
    expect(montantTndLigne(ligne(1234.567, 0), { cours: 3.3712, devise: "USD" })).toBe(4161.972);
  });

  it("sans cours, rien n'est inventé : 0", () => {
    expect(montantTndLigne(ligne(1000, 0), { cours: 0, devise: "EUR" })).toBe(0);
    expect(montantTndLigne(ligne(1000, 0))).toBe(0);
  });

  it("en dinars, le montant en devise est le montant en dinars", () => {
    expect(montantTndLigne(ligne(500, 0), { cours: 0, devise: "TND" })).toBe(500);
  });

  it("des lignes mélangées : saisies conservées, les autres calculées", () => {
    expect(montantTndCote([ligne(1000, 3300), ligne(500, 0), ligne(200, 0)], { cours: 3, devise: "EUR" })).toBe(3300 + 1500 + 600);
  });

  it("les totaux d'un côté reprennent le calcul, la quantité et le montant en devise sont inchangés", () => {
    const t = totauxCote([ligne(1000, 0), ligne(500, 0)], undefined, { cours: 3.4, devise: "EUR" });
    expect(t).toMatchObject({ montantDevise: 1500, montantTnd: 5100, quantite: 20 });
    expect(totauxCote([ligne(1000, 0)]).montantTnd).toBe(0);
  });

  it("changeDe prend le cours et la devise du bon côté", () => {
    const m = mouvement({ achatCours: 3.3, achatDevise: "EUR", venteCours: 3.5, venteDevise: "USD" });
    expect(changeDe(m, "achat")).toEqual({ cours: 3.3, devise: "EUR" });
    expect(changeDe(m, "vente")).toEqual({ cours: 3.5, devise: "USD" });
  });

  it("le tableau récapitulatif d'une société n'affiche plus 0,000 quand le cours est saisi (le cas du MT TND à 0)", () => {
    const m = mouvement({
      achatNumFacture: "F1", fournisseur: "A", achatCours: 3.3, achatLignes: [ligne(1000, 0)],
      venteNumFacture: "V1", client: "B", venteCours: 0, venteLignes: [ligne(1100, 0)],
    });
    const r = recapSociete([m]);
    expect(r.lignes[0].achat).toMatchObject({ enDevise: 1000, cours: 3.3, mtTnd: 3300 });
    // vente sans cours : le montant en dinars reste 0, il n'est pas inventé
    expect(r.lignes[0].vente).toMatchObject({ enDevise: 1100, cours: 0, mtTnd: 0 });
    expect(r.totaux.achat.mtTnd).toBe(3300);
  });

  it("sans cours, le dinar n'est pas affiché 0,000 : « sans cours » est détecté, et l'export laisse la cellule vide", () => {
    const m = mouvement({ achatNumFacture: "F1", fournisseur: "A", achatCours: 0, achatLignes: [ligne(1000, 0)], venteNumFacture: "V1", client: "B", venteCours: 3.4, venteLignes: [ligne(1100, 0)] });
    const r = recapSociete([m]);
    expect(sansCoursTnd(r.lignes[0].achat)).toBe(true);
    expect(sansCoursTnd(r.lignes[0].vente)).toBe(false);
    expect(sansCoursTnd({ present: false, mtTnd: 0, enDevise: 0 })).toBe(false);
    const feuille = feuilleRecapSociete(r);
    const ligneDonnees = feuille.rows[1];
    // colonnes : vente (N°…MT TND = 9 premières valeurs après le rang), puis écart, puis achat ; MT TND achat est la dernière colonne hors douane
    expect(ligneDonnees[8]).toBe(3740);
    expect(ligneDonnees[ligneDonnees.length - 1]).toBe("");
  });

  it("le récapitulatif global (pied du tableau) et la monnaie choisie suivent le même calcul", () => {
    const m = mouvement({ achatCours: 3.3, achatLignes: [ligne(1000, 0)], venteCours: 3.5, venteLignes: [ligne(1100, 0)] });
    const r = recapStock([m]);
    expect(r.achat.montantTnd).toBe(3300);
    expect(r.vente.montantTnd).toBe(3850);
    expect(montantCote(m.venteLignes, undefined, "TND", changeDe(m, "vente"))).toBe(3850);
    expect(montantCote(m.venteLignes, 1.1, "USD", changeDe(m, "vente"))).toBe(1210);
  });
});

import { describe, expect, it } from "vitest";
import { appliquerFiltresRecap, cleValeur, FILTRES_RECAP_VIDES, nombreFiltresRecap, valeursDeColonne, type FiltresRecap } from "./filtresRecapSociete";
import { recapSociete } from "./stockRecapSociete";
import type { StockLigne, StockMouvement } from "@/types";

const ligne = (quantite: number, montantDevise: number, montantTnd: number): StockLigne => ({ designation: "CIMENT", quantite, prixUnitaire: 1, montantDevise, montantTnd, unite: "T" });

const mvt = (id: string, patch: Partial<StockMouvement>): StockMouvement => ({
  id, societeId: "s", ordre: 0, natureMarchandise: "CIMENT",
  achatDate: null, achatNumFacture: "", achatDocType: "", fournisseur: "", achatDevise: "EUR", achatCours: 0, achatLignes: [],
  venteDate: null, venteNumFacture: "", venteDocType: "", client: "", venteDevise: "EUR", venteCours: 0, venteLignes: [],
  douaneNumDeclaration: "", douaneDate: null, douaneRegime: "", douaneTypeDeclaration: "", douaneReference: "", douaneTauxChange: 0, douaneValeurTnd: 0, douanePtfn: 0, douaneExportateur: "", douaneImportateur: "",
  achatDocDataUrl: null, venteDocDataUrl: null, douaneDocDataUrl: null, note: "", ecart: 0, ecartUnite: "T", ecartParDesignation: [], creeLe: "", majLe: "", ...patch,
});

const recap = recapSociete([
  mvt("1", { venteDate: "2026-08-27", venteNumFacture: "A1", client: "EVERTIS", venteLignes: [ligne(10, 100, 300)], achatNumFacture: "F1", fournisseur: "GREEN", achatLignes: [ligne(10, 90, 270)] }),
  mvt("2", { venteDate: "2026-09-11", venteNumFacture: "A2", client: "Evertis", venteLignes: [ligne(20, 200, 600)], achatNumFacture: "F2", fournisseur: "GREEN", achatLignes: [ligne(21, 190, 570)], ecart: 1 }),
  mvt("3", { venteDate: "2026-09-16", venteNumFacture: "A3", client: "POLYMERX", venteLignes: [ligne(30, 300, 900)] }),
]);

const filtre = (colonne: string, ...cles: string[]): FiltresRecap => ({ ...FILTRES_RECAP_VIDES, colonnes: { [colonne]: new Set(cles) } });

describe("filtres par colonne du récapitulatif", () => {
  it("liste les valeurs distinctes d'une colonne avec leur nombre, sans tenir compte de la casse", () => {
    const v = valeursDeColonne(recap.lignes, "vente.tiers", FILTRES_RECAP_VIDES);
    expect(v.map((x) => [x.affichage, x.nombre])).toEqual([["EVERTIS", 2], ["POLYMERX", 1]]);
  });

  it("les cellules vides forment la valeur « (Vides) », rangée en dernier", () => {
    const v = valeursDeColonne(recap.lignes, "achat.facture", FILTRES_RECAP_VIDES);
    expect(v.map((x) => x.affichage)).toEqual(["F1", "F2", "(Vides)"]);
    expect(v[2].cle).toBe("");
  });

  it("garde les lignes dont la valeur est cochée et recalcule les totaux ; le rang d'origine est conservé", () => {
    const r = appliquerFiltresRecap(recap, filtre("vente.tiers", cleValeur("EVERTIS")));
    expect(r.lignes.map((l) => l.rang)).toEqual([1, 2]);
    expect(r.totaux.vente.quantite).toBe(30);
    expect(r.totaux.achat.quantite).toBe(31);
    expect(r.totaux.ecart).toBe(1);
  });

  it("cumule les colonnes (ET) et additionne les valeurs d'une même colonne (OU)", () => {
    const f: FiltresRecap = { ...FILTRES_RECAP_VIDES, colonnes: { "vente.tiers": new Set([cleValeur("EVERTIS"), cleValeur("POLYMERX")]), "achat.tiers": new Set([cleValeur("GREEN")]) } };
    expect(appliquerFiltresRecap(recap, f).lignes.map((l) => l.id)).toEqual(["1", "2"]);
    expect(nombreFiltresRecap(f)).toBe(2);
  });

  it("la liste d'une colonne tient compte des filtres des autres colonnes, pas du sien", () => {
    const f = filtre("achat.tiers", cleValeur("GREEN"));
    expect(valeursDeColonne(recap.lignes, "vente.tiers", f).map((x) => x.affichage)).toEqual(["EVERTIS"]);
    expect(valeursDeColonne(recap.lignes, "achat.tiers", f).map((x) => x.affichage)).toEqual(["GREEN", "(Vides)"]);
  });

  it("trie les nombres et les dates dans leur ordre, les vides toujours en dernier", () => {
    const tri = (colonne: string, sens: "asc" | "desc") => appliquerFiltresRecap(recap, { ...FILTRES_RECAP_VIDES, tri: { colonne, sens } }).lignes.map((l) => l.id);
    expect(tri("vente.quantite", "desc")).toEqual(["3", "2", "1"]);
    expect(tri("vente.date", "asc")).toEqual(["1", "2", "3"]);
    expect(tri("achat.facture", "asc")).toEqual(["1", "2", "3"]);
    expect(tri("achat.facture", "desc")).toEqual(["2", "1", "3"]);
  });

  it("sans filtre ni tri, le récapitulatif est inchangé", () => {
    expect(appliquerFiltresRecap(recap, FILTRES_RECAP_VIDES).lignes).toEqual(recap.lignes);
  });
});

import { describe, expect, it } from "vitest";
import { appliquerFiltresRecap, cleValeur, conditionValide, FILTRES_RECAP_VIDES, nombreFiltresRecap, sansFiltresDouane, valeursDeColonne, type ConditionRecap, type FiltresRecap } from "./filtresRecapSociete";
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
  mvt("1", { venteDate: "2026-08-27", venteNumFacture: "A1", client: "EVERTIS", venteLignes: [ligne(10, 100, 300)], achatNumFacture: "F1", fournisseur: "GREEN", achatLignes: [ligne(10, 90, 270)], douaneNumDeclaration: "D-100", douaneTauxChange: 3.3 }),
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

const cond = (colonne: string, op: ConditionRecap["op"], v1 = "", v2 = ""): FiltresRecap => ({ ...FILTRES_RECAP_VIDES, conditions: { [colonne]: { op, v1, v2 } } });
const ids = (f: FiltresRecap) => appliquerFiltresRecap(recap, f).lignes.map((l) => l.id);

describe("filtres par condition", () => {
  it("texte : contient, ne contient pas, commence par, se termine par, est exactement (sans tenir compte de la casse ni des accents)", () => {
    expect(ids(cond("vente.tiers", "contient", "evert"))).toEqual(["1", "2"]);
    expect(ids(cond("vente.tiers", "ne-contient-pas", "evert"))).toEqual(["3"]);
    expect(ids(cond("vente.tiers", "commence", "poly"))).toEqual(["3"]);
    expect(ids(cond("vente.tiers", "finit", "tis"))).toEqual(["1", "2"]);
    expect(ids(cond("vente.tiers", "exactement", "polymerx"))).toEqual(["3"]);
  });

  it("vide et pas vide", () => {
    expect(ids(cond("achat.facture", "vide"))).toEqual(["3"]);
    expect(ids(cond("achat.facture", "non-vide"))).toEqual(["1", "2"]);
  });

  it("nombres : supérieur, inférieur, égal, différent, compris entre, pas compris entre ; les cellules vides n'y répondent pas", () => {
    expect(ids(cond("vente.quantite", "sup", "10"))).toEqual(["2", "3"]);
    expect(ids(cond("vente.quantite", "sup-egal", "10"))).toEqual(["1", "2", "3"]);
    expect(ids(cond("vente.quantite", "inf", "20,5"))).toEqual(["1", "2"]);
    expect(ids(cond("vente.quantite", "egal", "20"))).toEqual(["2"]);
    expect(ids(cond("vente.quantite", "different", "20"))).toEqual(["1", "3"]);
    expect(ids(cond("vente.quantite", "entre", "30", "15"))).toEqual(["2", "3"]);
    expect(ids(cond("vente.quantite", "pas-entre", "15", "25"))).toEqual(["1", "3"]);
    expect(ids(cond("achat.quantite", "sup", "0"))).toEqual(["1", "2"]);
  });

  it("dates : est, antérieure à, postérieure à", () => {
    expect(ids(cond("vente.date", "date-est", "2026-09-11"))).toEqual(["2"]);
    expect(ids(cond("vente.date", "avant", "2026-09-11"))).toEqual(["1"]);
    expect(ids(cond("vente.date", "apres", "2026-09-11"))).toEqual(["3"]);
  });

  it("une condition se cumule avec les valeurs cochées d'une autre colonne", () => {
    const f: FiltresRecap = { ...cond("vente.quantite", "sup", "10"), colonnes: { "achat.tiers": new Set([cleValeur("GREEN")]) } };
    expect(ids(f)).toEqual(["2"]);
    expect(nombreFiltresRecap(f)).toBe(2);
  });

  it("la liste des valeurs d'une colonne tient compte de la condition d'une autre colonne", () => {
    expect(valeursDeColonne(recap.lignes, "vente.tiers", cond("vente.quantite", "sup", "15")).map((v) => v.affichage)).toEqual(["Evertis", "POLYMERX"]);
    expect(valeursDeColonne(recap.lignes, "vente.tiers", cond("achat.facture", "non-vide")).map((v) => v.affichage)).toEqual(["EVERTIS"]);
  });

  it("une condition n'est valide que si ses valeurs sont saisies et lisibles", () => {
    expect(conditionValide("nombre", { op: "sup", v1: "", v2: "" })).toBe(false);
    expect(conditionValide("nombre", { op: "sup", v1: "1 000,5", v2: "" })).toBe(true);
    expect(conditionValide("nombre", { op: "entre", v1: "1", v2: "" })).toBe(false);
    expect(conditionValide("texte", { op: "vide", v1: "", v2: "" })).toBe(true);
    expect(conditionValide("date", { op: "avant", v1: "2026-09-11", v2: "" })).toBe(true);
  });
});

describe("douane", () => {
  it("se filtre comme les autres colonnes, et ses filtres sont retirés quand elle est masquée", () => {
    const f: FiltresRecap = { colonnes: { "douane.declaration": new Set([cleValeur("D-100")]), "vente.tiers": new Set([cleValeur("EVERTIS")]) }, conditions: { "douane.taux": { op: "sup", v1: "3", v2: "" } }, tri: { colonne: "douane.valeur", sens: "asc" } };
    expect(ids(f)).toEqual(["1"]);
    const sans = sansFiltresDouane(f);
    expect(Object.keys(sans.colonnes)).toEqual(["vente.tiers"]);
    expect(sans.conditions).toEqual({});
    expect(sans.tri).toBeNull();
  });
});

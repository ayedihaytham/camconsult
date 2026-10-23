// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { comptesSituation, CRITERES_VIDES, filtrerMouvements, norme, situationMouvement, valeursTiers } from "./stockFiltres";
import { recapStock } from "./stockRecap";
import { ecrirePrefsStock, lirePrefsStock, PREFS_PAR_DEFAUT } from "./stockPrefs";
import type { StockLigne, StockMouvement } from "@/types";

const ligne = (quantite: number, unite: string, montantDevise = quantite * 10): StockLigne => ({ designation: "HOT WASHED PET FLAKES", quantite, prixUnitaire: 10, montantDevise, montantTnd: montantDevise * 3, unite });

const base = (id: string, patch: Partial<StockMouvement>): StockMouvement => ({
  id, societeId: "s", ordre: 0, natureMarchandise: "HOT WASHED PET FLAKES",
  achatDate: null, achatNumFacture: "", achatDocType: "", fournisseur: "", achatDevise: "EUR", achatCours: 0, achatLignes: [],
  venteDate: null, venteNumFacture: "", venteDocType: "", client: "", venteDevise: "EUR", venteCours: 0, venteLignes: [],
  douaneNumDeclaration: "", douaneDate: null, douaneRegime: "", douaneTypeDeclaration: "", douaneReference: "", douaneTauxChange: 0, douaneValeurTnd: 0, douanePtfn: 0, douaneExportateur: "", douaneImportateur: "",
  achatDocDataUrl: null, venteDocDataUrl: null, douaneDocDataUrl: null, note: "", ecart: 0, ecartUnite: "T", ecartParDesignation: [], creeLe: "", majLe: "", ...patch,
});

const solde = base("a", { achatNumFacture: "260082", fournisseur: "GREEN RECYCLING SARL", achatLignes: [ligne(44.277, "T")], venteNumFacture: "2600084", client: "EVERTIS ITALIA S.P.A", venteLignes: [ligne(44.277, "T")] });
const ecart = base("b", { achatNumFacture: "260083", fournisseur: "Green Recycling SARL", achatLignes: [ligne(61.305, "T")], venteNumFacture: "2600086", client: "ENPLATER ALTA SEGARRA,SL", venteLignes: [ligne(61.218, "T")], ecart: 0.087 });
const sansAchat = base("c", { venteNumFacture: "2600083", client: "EVERTIS ITALIA S.P.A", venteLignes: [ligne(41.973, "T")], ecart: -41.973 });
const sansVente = base("d", { achatNumFacture: "260090", fournisseur: "GREEN RECYCLING SARL", achatLignes: [ligne(104.035, "T")], ecart: 104.035 });
const pieces = base("e", { venteNumFacture: "88/2026", client: "EURL OUANANI INVESTISSEMENT", natureMarchandise: "Pièces détachées", venteLignes: [ligne(7918.328, "")], ecart: -7918.328, ecartUnite: "" });
const tous = [solde, ecart, sansAchat, sansVente, pieces];

describe("situation d'un mouvement", () => {
  it("dit en clair : soldé, écart, vendu sans achat, acheté sans vente", () => {
    expect(tous.map(situationMouvement)).toEqual(["solde", "ecart", "sans-achat", "sans-vente", "sans-achat"]);
    expect(situationMouvement(base("v", {}))).toBe("vide");
    expect(comptesSituation(tous)).toEqual({ tous: 5, solde: 1, ecart: 1, "sans-achat": 2, "sans-vente": 1 });
  });
});

describe("filtres du stock", () => {
  it("liste les clients et les fournisseurs, une seule fois malgré la casse et la ponctuation, avec leur nombre", () => {
    expect(valeursTiers(tous, "fournisseur")).toEqual([{ cle: "green recycling sarl", nom: "GREEN RECYCLING SARL", nombre: 3 }]);
    const clients = valeursTiers(tous, "client");
    expect(clients.map((c) => [c.nom, c.nombre])).toEqual([["ENPLATER ALTA SEGARRA,SL", 1], ["EURL OUANANI INVESTISSEMENT", 1], ["EVERTIS ITALIA S.P.A", 2]]);
  });

  it("filtre par client (côté vente), par fournisseur (côté achat), par situation et par recherche, ensemble", () => {
    expect(filtrerMouvements(tous, { ...CRITERES_VIDES, clients: new Set([norme("evertis italia s.p.a")]) }).map((m) => m.id)).toEqual(["a", "c"]);
    expect(filtrerMouvements(tous, { ...CRITERES_VIDES, fournisseurs: new Set([norme("GREEN RECYCLING SARL")]) }).map((m) => m.id)).toEqual(["a", "b", "d"]);
    expect(filtrerMouvements(tous, { ...CRITERES_VIDES, situation: "sans-achat" }).map((m) => m.id)).toEqual(["c", "e"]);
    expect(filtrerMouvements(tous, { ...CRITERES_VIDES, situation: "sans-achat", clients: new Set([norme("EVERTIS ITALIA S.P.A")]) }).map((m) => m.id)).toEqual(["c"]);
    expect(filtrerMouvements(tous, { ...CRITERES_VIDES, recherche: "2600086" }).map((m) => m.id)).toEqual(["b"]);
    expect(filtrerMouvements(tous, { ...CRITERES_VIDES, recherche: "pièces detachees" }).map((m) => m.id)).toEqual(["e"]);
    expect(filtrerMouvements(tous, { ...CRITERES_VIDES, recherche: "evertis 260082" }).map((m) => m.id)).toEqual(["a"]);
    expect(filtrerMouvements(tous, CRITERES_VIDES)).toHaveLength(5);
  });
});

describe("totaux du stock", () => {
  it("n'additionne pas des pièces aux tonnes : la facture sans unité reste hors du total et est comptée à part", () => {
    const t = recapStock(tous);
    expect(t.unite).toBe("T");
    expect(t.vente.quantite).toBeCloseTo(44.277 + 61.218 + 41.973, 3);
    expect(t.achat.quantite).toBeCloseTo(44.277 + 61.305 + 104.035, 3);
    expect(t.horsUnite).toBe(1);
    // Les montants, eux, comptent toutes les factures.
    expect(t.vente.montantDevise).toBeCloseTo(442.77 + 612.18 + 419.73 + 79183.28, 2);
    // L'écart total ne contient pas celui des pièces.
    expect(t.ecart).toBeCloseTo(0.087 - 41.973 + 104.035, 3);
  });

  it("sans aucune unité nulle part, tout est compté comme avant", () => {
    const t = recapStock([base("x", { venteLignes: [ligne(5, "")], ecartUnite: "", ecart: -5 })]);
    expect(t.vente.quantite).toBe(5);
    expect(t.horsUnite).toBe(0);
  });
});

describe("préférences d'affichage", () => {
  afterEach(() => window.localStorage.clear());

  it("la douane est masquée au départ, les préférences se gardent, et un stockage illisible ne casse rien", () => {
    expect(lirePrefsStock()).toEqual(PREFS_PAR_DEFAUT);
    expect(PREFS_PAR_DEFAUT.colonnes.douane).toBe(false);
    ecrirePrefsStock({ colonnes: { ...PREFS_PAR_DEFAUT.colonnes, douane: true, cours: false }, densite: "aere" });
    expect(lirePrefsStock()).toMatchObject({ densite: "aere", colonnes: { douane: true, cours: false, tnd: true } });
    window.localStorage.setItem("cabinet.stock.tableau", "pas du json");
    expect(lirePrefsStock()).toEqual(PREFS_PAR_DEFAUT);
  });
});

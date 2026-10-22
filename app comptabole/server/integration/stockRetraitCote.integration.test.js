import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { connecterAdmin, creerBaseJetable, demarrerServeur } from "./helpers.js";

/**
 * Gestion de stock : un mouvement peut ne porter que l'achat ou que la vente, retirer un seul type de facture laisse les autres intacts,
 * et chaque mouvement peut être supprimé. Contre un vrai PostgreSQL jetable (TEST_DATABASE_URL) ; ignoré sans cette variable.
 */
const actif = Boolean(process.env.TEST_DATABASE_URL);
vi.setConfig({ testTimeout: 90_000, hookTimeout: 90_000 });

describe.skipIf(!actif)("intégration PostgreSQL : retrait d'un type de facture et suppression d'un mouvement", () => {
  let base, serveur, admin, societeId;

  const ligne = (designation, quantite, prix) => ({ designation, quantite, prixUnitaire: prix, montantDevise: quantite * prix, montantTnd: quantite * prix * 3.3 });
  const mouvementComplet = (num) => ({
    societeId,
    natureMarchandise: "CIMENT",
    fournisseur: "SOTACIB", achatNumFacture: `A-${num}`, achatDate: "2026-01-05", achatDevise: "EUR", achatCours: 3.3, achatLignes: [ligne("CIMENT", 1000, 44)],
    client: "CLIENT A", venteNumFacture: `V-${num}`, venteDate: "2026-01-20", venteDevise: "EUR", venteCours: 3.3, venteLignes: [ligne("CIMENT", 1000, 60)],
    douaneNumDeclaration: `D-${num}`, douaneDate: "2026-01-10", douaneTauxChange: 3.3, douaneValeurTnd: 145200, douanePtfn: 1,
  });
  const lire = async () => (await admin("GET", `/api/stock/mouvements?societeId=${societeId}`)).json;

  beforeAll(async () => {
    base = await creerBaseJetable();
    serveur = await demarrerServeur(base.url);
    admin = await connecterAdmin(serveur.base);
    societeId = (await admin("POST", "/api/societes", { raisonSociale: "Société Stock", code: "STK" })).json.id;
  });
  afterAll(async () => {
    await serveur?.arreter();
    await base?.supprimer();
  });

  it("accepte un mouvement qui ne porte que la facture d'achat, ou que la facture de vente", async () => {
    const achatSeul = await admin("POST", "/api/stock/mouvements", { societeId, fournisseur: "SOTACIB", achatNumFacture: "A-seul", achatDate: "2026-02-01", achatDevise: "EUR", achatLignes: [ligne("CIMENT", 10, 5)] });
    expect(achatSeul.status, achatSeul.texte).toBe(201);
    const venteSeule = await admin("POST", "/api/stock/mouvements", { societeId, client: "CLIENT B", venteNumFacture: "V-seule", venteDate: "2026-02-02", venteDevise: "EUR", venteLignes: [ligne("CIMENT", 10, 8)] });
    expect(venteSeule.status, venteSeule.texte).toBe(201);
    expect(achatSeul.json.venteLignes).toEqual([]);
    expect(venteSeule.json.achatLignes).toEqual([]);
  });

  it("retire la facture d'achat sans toucher à la vente ni à la douane, puis la déclaration seule", async () => {
    const m = (await admin("POST", "/api/stock/mouvements", mouvementComplet(1))).json;
    const sansAchat = await admin("PATCH", `/api/stock/mouvements/${m.id}`, {
      fournisseur: "", achatNumFacture: "", achatDate: null, achatDevise: "EUR", achatCours: 0, achatCoursUsd: 0, achatLignes: [], achatDocType: "", achatDocDataUrl: null,
      apurementRevision: m.apurementRevision,
    });
    expect(sansAchat.status, sansAchat.texte).toBe(200);
    expect(sansAchat.json).toMatchObject({ fournisseur: "", achatNumFacture: "", achatLignes: [], client: "CLIENT A", venteNumFacture: "V-1", douaneNumDeclaration: "D-1" });
    expect(sansAchat.json.venteLignes).toHaveLength(1);

    const sansDouane = await admin("PATCH", `/api/stock/mouvements/${m.id}`, {
      douaneNumDeclaration: "", douaneDate: null, douaneRegime: "", douaneTypeDeclaration: "", douaneReference: "", douaneTauxChange: 0, douaneValeurTnd: 0, douanePtfn: 0, douaneExportateur: "", douaneImportateur: "", douaneDocDataUrl: null,
      apurementRevision: sansAchat.json.apurementRevision,
    });
    expect(sansDouane.status, sansDouane.texte).toBe(200);
    expect(sansDouane.json).toMatchObject({ douaneNumDeclaration: "", client: "CLIENT A", venteNumFacture: "V-1" });
  });

  it("chaque mouvement se supprime", async () => {
    const avant = await lire();
    for (const m of avant) {
      const r = await admin("DELETE", `/api/stock/mouvements/${m.id}`);
      expect(r.status, r.texte).toBe(200);
    }
    expect(await lire()).toEqual([]);
  });
});

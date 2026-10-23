import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { connecterAdmin, creerBaseJetable, demarrerServeur } from "./helpers.js";

/**
 * Supprimer une facture d'achat qui a des règlements : refusé par défaut, accepté sur demande expresse. Sa part est retirée de chaque
 * règlement, un règlement qui ne couvre plus rien est supprimé, la retenue d'un règlement conservé est ramenée à ce qu'il couvre.
 * Contre un vrai PostgreSQL jetable (TEST_DATABASE_URL) ; ignoré sans cette variable.
 */
const actif = Boolean(process.env.TEST_DATABASE_URL);
vi.setConfig({ testTimeout: 90_000, hookTimeout: 90_000 });

describe.skipIf(!actif)("intégration PostgreSQL : suppression d'un achat réglé avec ses règlements", () => {
  let base, serveur, admin, societeId, a, b, c;

  const achat = (num, montant) => ({
    societeId, fournisseur: "SOTACIB", achatNumFacture: num, achatDate: "2026-01-05", achatDevise: "EUR", achatCours: 3.3,
    achatLignes: [{ designation: "CIMENT", quantite: 1000, prixUnitaire: montant / 1000, montantDevise: montant, montantTnd: montant * 3.3 }],
  });
  const etat = async () => (await admin("GET", `/api/fournisseurs?societeId=${societeId}`)).json;
  const reglement = (affectations, extra = {}) => admin("POST", "/api/fournisseurs/reglements", { societeId, fournisseurCle: "sotacib", devise: "EUR", mode: "virement", dateReglement: "2026-02-01", affectations, ...extra });

  beforeAll(async () => {
    base = await creerBaseJetable();
    serveur = await demarrerServeur(base.url);
    admin = await connecterAdmin(serveur.base);
    societeId = (await admin("POST", "/api/societes", { raisonSociale: "Société Cascade", code: "CAS" })).json.id;
    a = (await admin("POST", "/api/stock/mouvements", achat("A-1", 44000))).json;
    b = (await admin("POST", "/api/stock/mouvements", achat("B-1", 33300))).json;
    c = (await admin("POST", "/api/stock/mouvements", achat("C-1", 10000))).json;
    expect((await reglement([{ mouvementId: a.id, montant: 10000 }], { reference: "R1" })).status).toBe(200);
    expect((await reglement([{ mouvementId: a.id, montant: 1000 }, { mouvementId: b.id, montant: 500 }], { reference: "R2", rsMontant: 800 })).status).toBe(200);
    expect((await reglement([{ mouvementId: c.id, montant: 2000 }], { reference: "R3" })).status).toBe(200);
  });
  afterAll(async () => {
    await serveur?.arreter();
    await base?.supprimer();
  });

  it("sans demande expresse, la suppression reste refusée et rien n'est touché", async () => {
    const r = await admin("DELETE", `/api/stock/mouvements/${a.id}`);
    expect(r.status).toBe(409);
    expect(r.json.code).toBe("ACHAT_REGLE");
    expect((await etat()).reglements).toHaveLength(3);
  });

  it("la suppression des règlements n'accompagne qu'un retrait de la facture d'achat, pas une simple modification", async () => {
    const r = await admin("PATCH", `/api/stock/mouvements/${c.id}`, { ...achat("C-modifie", 10000), apurementRevision: c.apurementRevision, supprimerReglements: true });
    expect(r.status).toBe(400);
    expect(r.json.code).toBe("SUPPRESSION_REGLEMENTS_REFUSEE");
    expect((await etat()).reglements).toHaveLength(3);
  });

  it("supprime le mouvement avec ses règlements : le règlement qui ne couvre plus rien disparaît, le règlement partagé est conservé avec sa retenue ramenée", async () => {
    const r = await admin("DELETE", `/api/stock/mouvements/${a.id}?supprimerReglements=true`);
    expect(r.status, r.texte).toBe(200);
    const e = await etat();
    expect(e.factures.map((f) => f.numFacture).sort()).toEqual(["B-1", "C-1"]);
    expect(e.reglements.map((x) => x.reference).sort()).toEqual(["R2", "R3"]);
    const r2 = e.reglements.find((x) => x.reference === "R2");
    expect(r2.affectations).toEqual([{ mouvementId: b.id, montant: 500 }]);
    expect(r2.rsMontant).toBe(500);
    expect(r2.brut).toBe(500);
  });

  it("retire la facture d'achat d'un mouvement avec ses règlements, sans supprimer le mouvement", async () => {
    const r = await admin("PATCH", `/api/stock/mouvements/${c.id}`, {
      fournisseur: "", achatNumFacture: "", achatDate: null, achatCours: 0, achatCoursUsd: 0, achatLignes: [], achatDocType: "", achatDocDataUrl: null,
      apurementRevision: c.apurementRevision, supprimerReglements: true,
    });
    expect(r.status, r.texte).toBe(200);
    expect(r.json.achatLignes).toEqual([]);
    const e = await etat();
    expect(e.reglements.map((x) => x.reference)).toEqual(["R2"]);
    const restant = (await admin("GET", `/api/stock/mouvements?societeId=${societeId}`)).json.map((m) => m.id);
    expect(restant).toContain(c.id);
  });
});

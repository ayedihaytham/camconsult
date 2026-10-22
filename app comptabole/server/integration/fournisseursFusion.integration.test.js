import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { connecterAdmin, creerBaseJetable, demarrerServeur } from "./helpers.js";

/**
 * Fusion de fournisseurs écrits différemment dans le stock (« SOTACIB » et « SOTACIB KAIROUAN ») : un seul fournisseur dans le suivi,
 * un règlement peut couvrir des factures des deux écritures, la fusion se défait tant qu'aucun règlement ne les mélange.
 * Contre un vrai PostgreSQL jetable (TEST_DATABASE_URL) ; ignoré sans cette variable.
 */
const actif = Boolean(process.env.TEST_DATABASE_URL);
vi.setConfig({ testTimeout: 90_000, hookTimeout: 90_000 });

describe.skipIf(!actif)("intégration PostgreSQL : fusion de fournisseurs", () => {
  let base, serveur, admin, societeId, a, b;

  const achat = (fournisseur, numero, montant) => ({
    societeId,
    fournisseur,
    achatNumFacture: numero,
    achatDate: "2026-01-05",
    achatDevise: "EUR",
    achatCours: 3.3,
    achatLignes: [{ designation: "CEM I", quantite: 1000, prixUnitaire: montant / 1000, montantDevise: montant, montantTnd: montant * 3.3 }],
  });
  const etat = async () => (await admin("GET", `/api/fournisseurs?societeId=${societeId}`)).json;

  beforeAll(async () => {
    base = await creerBaseJetable();
    serveur = await demarrerServeur(base.url);
    admin = await connecterAdmin(serveur.base);
    societeId = (await admin("POST", "/api/societes", { raisonSociale: "Société Fusion", code: "FUS" })).json.id;
    a = (await admin("POST", "/api/stock/mouvements", achat("SOTACIB KAIROUAN", "A-1", 44000))).json;
    b = (await admin("POST", "/api/stock/mouvements", achat("SOTACIB", "B-1", 33300))).json;
  });
  afterAll(async () => {
    await serveur?.arreter();
    await base?.supprimer();
  });

  it("avant la fusion : deux fournisseurs, et un règlement ne peut pas couvrir les deux", async () => {
    const e = await etat();
    expect(new Set(e.factures.map((f) => f.fournisseurCle)).size).toBe(2);
    expect(e.fusions).toEqual([]);
    const r = await admin("POST", "/api/fournisseurs/reglements", {
      societeId, fournisseurCle: "sotacib", devise: "EUR", mode: "virement",
      affectations: [{ mouvementId: a.id, montant: 100 }],
    });
    expect(r.status).toBe(400);
  });

  it("fusionne : un seul fournisseur, un règlement couvre les deux écritures, les factures du stock restent inchangées", async () => {
    const f = await admin("POST", "/api/fournisseurs/fusions", { societeId, source: "sotacib kairouan", cible: "sotacib" });
    expect(f.status, f.texte).toBe(200);
    expect(new Set(f.json.factures.map((x) => x.fournisseurCle))).toEqual(new Set(["sotacib"]));
    expect(f.json.fusions).toEqual([{ cleSource: "sotacib kairouan", cleCible: "sotacib", nomSource: "SOTACIB KAIROUAN" }]);
    const r = await admin("POST", "/api/fournisseurs/reglements", {
      societeId, fournisseurCle: "sotacib", devise: "EUR", mode: "virement",
      affectations: [{ mouvementId: a.id, montant: 1000 }, { mouvementId: b.id, montant: 500 }],
    });
    expect(r.status, r.texte).toBe(200);
    const stock = (await admin("GET", `/api/stock/mouvements?societeId=${societeId}`)).json;
    expect(stock.map((m) => m.fournisseur).sort()).toEqual(["SOTACIB", "SOTACIB KAIROUAN"]);
  });

  it("refuse de fusionner deux fois, un inconnu, ou de séparer tant qu'un règlement couvre les deux", async () => {
    expect((await admin("POST", "/api/fournisseurs/fusions", { societeId, source: "sotacib kairouan", cible: "sotacib" })).status).toBe(400);
    expect((await admin("POST", "/api/fournisseurs/fusions", { societeId, source: "inconnu", cible: "sotacib" })).status).toBe(400);
    const sep = await admin("DELETE", `/api/fournisseurs/fusions?societeId=${societeId}&source=${encodeURIComponent("sotacib kairouan")}`);
    expect(sep.status).toBe(400);
    expect(sep.json.error).toMatch(/deux fournisseurs/);
  });

  it("modifier la facture d'une écriture fusionnée vers l'autre écriture est accepté ; vers un autre fournisseur est refusé", async () => {
    const ok = await admin("PATCH", `/api/stock/mouvements/${b.id}`, { ...achat("SOTACIB KAIROUAN", "B-1", 33300), apurementRevision: b.apurementRevision });
    expect(ok.status, ok.texte).toBe(200);
    b = ok.json;
    const non = await admin("PATCH", `/api/stock/mouvements/${b.id}`, { ...achat("AUTRE", "B-1", 33300), apurementRevision: b.apurementRevision });
    expect(non.status).toBe(409);
    const retour = await admin("PATCH", `/api/stock/mouvements/${b.id}`, { ...achat("SOTACIB", "B-1", 33300), apurementRevision: b.apurementRevision });
    expect(retour.status, retour.texte).toBe(200);
  });

  it("une fois le règlement supprimé, la fusion se défait et les deux fournisseurs reviennent", async () => {
    const e = await etat();
    expect((await admin("DELETE", `/api/fournisseurs/reglements/${e.reglements[0].id}`)).status).toBe(200);
    const sep = await admin("DELETE", `/api/fournisseurs/fusions?societeId=${societeId}&source=${encodeURIComponent("sotacib kairouan")}`);
    expect(sep.status, sep.texte).toBe(200);
    expect(sep.json.fusions).toEqual([]);
    expect(new Set(sep.json.factures.map((x) => x.fournisseurCle)).size).toBe(2);
  });
});

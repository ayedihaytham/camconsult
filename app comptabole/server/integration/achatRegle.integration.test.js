import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { connecterAdmin, creerBaseJetable, demarrerServeur } from "./helpers.js";

/**
 * Une facture d'achat du stock qui a des règlements (Suivi fournisseur) ne peut plus être supprimée, ni changer de fournisseur
 * ou de devise, ni descendre sous le montant réglé. Contre un vrai PostgreSQL jetable (TEST_DATABASE_URL) ; ignoré sans cette variable.
 */
const actif = Boolean(process.env.TEST_DATABASE_URL);
vi.setConfig({ testTimeout: 90_000, hookTimeout: 90_000 });

describe.skipIf(!actif)("intégration PostgreSQL : facture d'achat réglée", () => {
  let base, serveur, admin, societeId, mouvement;

  const corps = (extra = {}) => ({
    societeId,
    fournisseur: "SOTACIB",
    achatNumFacture: "F-100",
    achatDate: "2026-01-05",
    achatDevise: "EUR",
    achatCours: 3.3,
    achatLignes: [{ designation: "CEM I", quantite: 1000, prixUnitaire: 44, montantDevise: 44000, montantTnd: 145200 }],
    ...extra,
  });

  beforeAll(async () => {
    base = await creerBaseJetable();
    serveur = await demarrerServeur(base.url);
    admin = await connecterAdmin(serveur.base);
    societeId = (await admin("POST", "/api/societes", { raisonSociale: "Société Achat", code: "ACH" })).json.id;
    const m = await admin("POST", "/api/stock/mouvements", corps());
    expect(m.status, m.texte).toBe(201);
    mouvement = m.json;
    const r = await admin("POST", "/api/fournisseurs/reglements", {
      societeId, fournisseurCle: "sotacib", dateReglement: "2026-02-01", mode: "virement", devise: "EUR",
      affectations: [{ mouvementId: mouvement.id, montant: 10000 }],
    });
    expect(r.status, r.texte).toBe(200);
  });
  afterAll(async () => {
    await serveur?.arreter();
    await base?.supprimer();
  });

  const modifier = (extra) => admin("PATCH", `/api/stock/mouvements/${mouvement.id}`, { ...corps(extra), apurementRevision: mouvement.apurementRevision });

  it("refuse de changer le fournisseur, la devise ou de descendre sous le montant réglé", async () => {
    for (const extra of [
      { fournisseur: "AUTRE" },
      { achatDevise: "USD" },
      { achatLignes: [{ designation: "CEM I", quantite: 1000, prixUnitaire: 5, montantDevise: 5000, montantTnd: 16500 }] },
    ]) {
      const r = await modifier(extra);
      expect(r.status, JSON.stringify(extra)).toBe(409);
      expect(r.json.code).toBe("ACHAT_REGLE");
    }
  });

  it("accepte une correction qui laisse le fournisseur, la devise et un montant couvrant le réglé (même fournisseur écrit autrement)", async () => {
    const r = await modifier({ fournisseur: "sotacib.", achatNumFacture: "F-100 bis" });
    expect(r.status, r.texte).toBe(200);
    mouvement = r.json;
  });

  it("refuse de supprimer la facture tant qu'un règlement existe, puis l'accepte une fois le règlement supprimé", async () => {
    const refus = await admin("DELETE", `/api/stock/mouvements/${mouvement.id}`);
    expect(refus.status).toBe(409);
    expect(refus.json.code).toBe("ACHAT_REGLE");
    const etat = (await admin("GET", `/api/fournisseurs?societeId=${societeId}`)).json;
    expect(etat.factures).toHaveLength(1);
    const supprReglement = await admin("DELETE", `/api/fournisseurs/reglements/${etat.reglements[0].id}`);
    expect(supprReglement.status, supprReglement.texte).toBe(200);
    expect((await admin("DELETE", `/api/stock/mouvements/${mouvement.id}`)).status).toBe(200);
  });
});

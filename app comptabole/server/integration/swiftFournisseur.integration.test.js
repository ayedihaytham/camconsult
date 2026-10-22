import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { connecterAdmin, creerBaseJetable, demarrerServeur } from "./helpers.js";

/**
 * Le fournisseur d'une facture d'un virement SWIFT est enregistré, relu, corrigé, et reste facultatif.
 * Contre un vrai PostgreSQL jetable (TEST_DATABASE_URL) ; ignoré sans cette variable.
 */
const actif = Boolean(process.env.TEST_DATABASE_URL);
vi.setConfig({ testTimeout: 90_000, hookTimeout: 90_000 });

describe.skipIf(!actif)("intégration PostgreSQL : fournisseur d'une facture SWIFT", () => {
  let base, serveur, admin, societeId, virementId;

  beforeAll(async () => {
    base = await creerBaseJetable();
    serveur = await demarrerServeur(base.url);
    admin = await connecterAdmin(serveur.base);
    societeId = (await admin("POST", "/api/societes", { raisonSociale: "Société Swift", code: "SWF" })).json.id;
    const v = await admin("POST", "/api/etat-swift", { societeId, date: "2026-09-08", montant: 28401.75, libelle: "ACHAT NEGOCIE SUR LE MARCHE", banque: "BANQ", envoyer: true });
    expect(v.status, v.texte).toBeLessThan(300);
    virementId = v.json.id;
  });
  afterAll(async () => {
    await serveur?.arreter();
    await base?.supprimer();
  });

  const facturesDuVirement = async () => (await admin("GET", `/api/etat-swift?societeId=${societeId}`)).json.find((v) => v.id === virementId).factures;

  it("enregistre le fournisseur de chaque facture et le renvoie à la lecture", async () => {
    const r = await admin("PUT", `/api/etat-swift/${virementId}/factures`, {
      equivalentDevise: 8000,
      devise: "EUR",
      factures: [
        { numFacture: "F-1", fournisseur: "  SOTACIB KAIROUAN ", montantDevise: 3000, devise: "EUR", taux: 3.3, montantTnd: 9900 },
        { numFacture: "F-2", montantDevise: 2000, devise: "EUR", taux: 3.3, montantTnd: 6600 },
      ],
    });
    expect(r.status, r.texte).toBe(200);
    const f = await facturesDuVirement();
    expect(f.map((x) => [x.numFacture, x.fournisseur])).toEqual([["F-1", "SOTACIB KAIROUAN"], ["F-2", ""]]);
  });

  it("le fournisseur se corrige sans perdre la facture", async () => {
    const avant = await facturesDuVirement();
    const r = await admin("PUT", `/api/etat-swift/${virementId}/factures`, {
      equivalentDevise: 8000,
      devise: "EUR",
      factures: avant.map((x) => ({ ...x, fournisseur: x.numFacture === "F-2" ? "PET FLAKES LTD" : x.fournisseur })),
    });
    expect(r.status, r.texte).toBe(200);
    const apres = await facturesDuVirement();
    expect(apres.map((x) => x.id)).toEqual(avant.map((x) => x.id));
    expect(apres.map((x) => x.fournisseur)).toEqual(["SOTACIB KAIROUAN", "PET FLAKES LTD"]);
  });

  it("refuse un fournisseur de plus de 200 caractères", async () => {
    const r = await admin("PUT", `/api/etat-swift/${virementId}/factures`, {
      factures: [{ numFacture: "F-9", fournisseur: "x".repeat(201), montantDevise: 1, devise: "EUR", taux: 3, montantTnd: 3 }],
    });
    expect(r.status).toBe(400);
  });
});

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { connecterAdmin, creerBaseJetable, demarrerServeur } from "./helpers.js";

/**
 * Production : seuls les modules validés répondent ; les autres sont refusés (403) par le serveur lui-même.
 * Contre un vrai PostgreSQL jetable (TEST_DATABASE_URL) ; ignoré sans cette variable.
 */
const actif = Boolean(process.env.TEST_DATABASE_URL);
vi.setConfig({ testTimeout: 90_000, hookTimeout: 90_000 });

const MODULES = "tableau-de-bord,societes,stock,collectes";

describe.skipIf(!actif)("intégration PostgreSQL : modules ouverts en production", () => {
  let base, serveur, admin;

  beforeAll(async () => {
    base = await creerBaseJetable();
    serveur = await demarrerServeur(base.url, { ENVIRONNEMENT: "production", MODULES_ACTIFS: MODULES });
    admin = await connecterAdmin(serveur.base);
  });
  afterAll(async () => {
    await serveur?.arreter();
    await base?.supprimer();
  });

  it("annonce l'environnement et la liste des modules ouverts, sans authentification", async () => {
    const r = await fetch(`${serveur.base}/api/config`);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ environnement: "production", modulesActifs: MODULES.split(",") });
  });

  it("les modules ouverts répondent", async () => {
    expect((await admin("GET", "/api/societes")).status).toBe(200);
  });

  it("les modules fermés répondent 403, même à l'administrateur, lecture comme écriture", async () => {
    for (const [methode, chemin] of [["GET", "/api/facturation"], ["GET", "/api/honoraires"], ["GET", "/api/bordereaux"], ["POST", "/api/apurement/achats"], ["GET", "/api/souche-cheques"]]) {
      const r = await admin(methode, chemin, methode === "POST" ? {} : undefined);
      expect(r.status, `${methode} ${chemin}`).toBe(403);
    }
  });

  it("l'API d'un module fermé dont un module ouvert dépend reste joignable (Stock → fournisseurs, banque)", async () => {
    expect((await admin("GET", "/api/fournisseurs")).status).not.toBe(403);
    expect((await admin("GET", "/api/banque")).status).not.toBe(403);
  });
});

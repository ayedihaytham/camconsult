import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { connecterAdmin, creerBaseJetable, demarrerServeur } from "./helpers.js";

/**
 * Cours de change par rapport au dollar : un tableau à part du tableau en dinars, mêmes devises, enregistré par année.
 * Contre un vrai PostgreSQL jetable (TEST_DATABASE_URL) ; ignoré sans cette variable.
 */
const actif = Boolean(process.env.TEST_DATABASE_URL);
vi.setConfig({ testTimeout: 90_000, hookTimeout: 90_000 });

describe.skipIf(!actif)("intégration PostgreSQL : cours de change en dollars", () => {
  let base, serveur, admin;

  beforeAll(async () => {
    base = await creerBaseJetable();
    serveur = await demarrerServeur(base.url);
    admin = await connecterAdmin(serveur.base);
  });
  afterAll(async () => {
    await serveur?.arreter();
    await base?.supprimer();
  });

  it("la lecture renvoie les deux tableaux, vides au départ", async () => {
    const r = await admin("GET", "/api/cours-change");
    expect(r.status).toBe(200);
    expect(r.json.cours).toEqual([]);
    expect(r.json.coursUsd).toEqual([]);
    expect(r.json.devises.map((d) => d.code)).toEqual(expect.arrayContaining(["USD", "EUR"]));
  });

  it("les cours en dollars s'enregistrent à part des cours en dinars", async () => {
    const dinars = await admin("PUT", "/api/cours-change/2026", { cours: [{ devise: "EUR", mois: 3, cours: 3.3 }] });
    expect(dinars.status, dinars.texte).toBe(200);
    const dollars = await admin("PUT", "/api/cours-change/2026", { base: "USD", cours: [{ devise: "EUR", mois: 3, cours: 1.0842 }, { devise: "GBP", mois: 3, cours: 1.27 }] });
    expect(dollars.status, dollars.texte).toBe(200);
    expect(dollars.json.cours).toEqual([{ devise: "EUR", annee: 2026, mois: 3, cours: 3.3 }]);
    expect(dollars.json.coursUsd).toEqual([
      { devise: "EUR", annee: 2026, mois: 3, cours: 1.0842 },
      { devise: "GBP", annee: 2026, mois: 3, cours: 1.27 },
    ]);
  });

  it("un cours en dollars se modifie et s'efface (null) sans toucher au tableau en dinars", async () => {
    const r = await admin("PUT", "/api/cours-change/2026", { base: "USD", cours: [{ devise: "EUR", mois: 3, cours: 1.09 }, { devise: "GBP", mois: 3, cours: null }] });
    expect(r.status).toBe(200);
    expect(r.json.coursUsd).toEqual([{ devise: "EUR", annee: 2026, mois: 3, cours: 1.09 }]);
    expect(r.json.cours).toHaveLength(1);
  });

  it("le dollar n'a pas de cours par rapport à lui-même ; un cours doit être positif ; une devise inconnue est refusée", async () => {
    expect((await admin("PUT", "/api/cours-change/2026", { base: "USD", cours: [{ devise: "USD", mois: 1, cours: 1 }] })).status).toBe(400);
    expect((await admin("PUT", "/api/cours-change/2026", { base: "USD", cours: [{ devise: "EUR", mois: 1, cours: -2 }] })).status).toBe(400);
    expect((await admin("PUT", "/api/cours-change/2026", { base: "USD", cours: [{ devise: "ZZZ", mois: 1, cours: 1 }] })).status).toBe(400);
  });

  it("supprimer une devise supprime aussi ses cours en dollars", async () => {
    const r = await admin("DELETE", "/api/cours-change/devises/EUR");
    expect(r.status).toBe(200);
    expect(r.json.coursUsd.filter((c) => c.devise === "EUR")).toEqual([]);
    expect(r.json.cours.filter((c) => c.devise === "EUR")).toEqual([]);
  });
});

import express from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({ appels: [] }));

vi.mock("../db.js", () => {
  const query = vi.fn(async (sql, params) => {
    etat.appels.push({ sql, params });
    return { rows: [] };
  });
  return { query, withTransaction: (action) => action({ query }) };
});
vi.mock("../auth.js", async (importOriginal) => ({
  ...(await importOriginal()),
  requireAuth: (req, _res, next) => {
    req.session = { role: "admin", poste: null, nom: "Admin", societeIds: null };
    next();
  },
}));
vi.mock("../journal.js", () => ({ logAction: vi.fn() }));

import { fournisseursRouter } from "./fournisseurs.js";

let server;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/fournisseurs", fournisseursRouter);
  server = await new Promise((resolve) => {
    const l = app.listen(0, "127.0.0.1", () => resolve(l));
  });
});
afterAll(() => new Promise((resolve) => server.close(resolve)));

describe("FIN-01 : règlements fournisseurs traités l'un après l'autre", () => {
  it("la vérification du solde commence par un verrou propre à la société et au fournisseur", async () => {
    etat.appels.length = 0;
    const societeId = "8b5e1c52-0000-4000-8000-000000000001";
    await fetch(`http://127.0.0.1:${server.address().port}/fournisseurs/reglements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        societeId,
        fournisseurCle: "sotacib",
        mode: "virement",
        devise: "EUR",
        affectations: [{ mouvementId: "8b5e1c52-0000-4000-8000-000000000002", montant: 100 }],
      }),
    });
    const premier = etat.appels[0];
    expect(premier.sql).toContain("pg_advisory_xact_lock");
    expect(premier.params[0]).toBe(`reglement:${societeId}:sotacib`);
    // Le contrôle de dépassement ne s'exécute qu'après le verrou.
    const iVerrou = etat.appels.findIndex((a) => a.sql.includes("pg_advisory_xact_lock"));
    const iControle = etat.appels.findIndex((a) => a.sql.includes("from stock_mouvements m"));
    expect(iVerrou).toBeLessThan(iControle);
  });
});

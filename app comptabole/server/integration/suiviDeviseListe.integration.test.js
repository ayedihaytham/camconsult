import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { connecterAdmin, creerBaseJetable, demarrerServeur } from "./helpers.js";

/**
 * Liste des fiches du suivi client devise : ce que le volet du registre affiche (nombre de factures, réglé, dernier règlement, aperçu des dernières
 * factures et des derniers règlements) est calculé par la liste elle-même. Contre un vrai PostgreSQL jetable (TEST_DATABASE_URL) ; ignoré sans cette variable.
 */
const actif = Boolean(process.env.TEST_DATABASE_URL);
vi.setConfig({ testTimeout: 90_000, hookTimeout: 90_000 });

describe.skipIf(!actif)("intégration PostgreSQL : liste des fiches du suivi client devise", () => {
  let base, serveur, admin, societe, fiche, vide;
  const facture = (suiviId, nFacture, montantTotal, dateFacture) => admin("POST", `/api/suivi-devise/${suiviId}/factures`, { nFacture, montantTotal, dateFacture });
  const liste = async () => (await admin("GET", `/api/suivi-devise?societeId=${societe}`)).json;

  beforeAll(async () => {
    base = await creerBaseJetable();
    serveur = await demarrerServeur(base.url);
    admin = await connecterAdmin(serveur.base);
    societe = (await admin("POST", "/api/societes", { raisonSociale: "Société Liste", code: "LST" })).json.id;
    fiche = (await admin("POST", "/api/suivi-devise", { societeId: societe, client: "RUSPINA", exercice: "2026", devise: "EUR" })).json.id;
    vide = (await admin("POST", "/api/suivi-devise", { societeId: societe, client: "SANS RIEN", exercice: "2026", devise: "EUR" })).json.id;
  });
  afterAll(async () => {
    await serveur?.arreter();
    await base?.supprimer();
  });

  it("une fiche sans facture ni règlement : zéros et aperçu vide, sans erreur", async () => {
    const f = (await liste()).find((x) => x.id === vide);
    expect(f).toMatchObject({ nbFactures: 0, totalReglements: 0, dernierReglement: null, solde: 0, totalVentes: 0 });
    expect(f.apercu).toEqual({ factures: [], reglements: [] });
  });

  it("nombre de factures, réglé, dernier règlement et aperçu : les quatre dernières factures et les trois derniers règlements, du plus récent au plus ancien", async () => {
    const dates = ["2026-01-05", "2026-01-10", "2026-01-15", "2026-01-20", "2026-01-25"];
    let ids = [];
    for (const [i, d] of dates.entries()) {
      const r = await facture(fiche, `F-${i + 1}`, 1000 * (i + 1), d);
      expect(r.status, r.texte).toBe(201);
      ids = r.json.factures.map((x) => x.id);
    }
    for (const [d, m] of [["2026-02-01", 500], ["2026-02-10", 700], ["2026-02-20", 300], ["2026-03-01", 100]]) {
      const r = await admin("POST", `/api/suivi-devise/${fiche}/mouvements`, { type: "reglement", libelle: `REGLEMENT ${d}`, date: d, montant: m });
      expect(r.status, r.texte).toBe(201);
    }
    const f = (await liste()).find((x) => x.id === fiche);
    expect(ids).toHaveLength(5);
    expect(f).toMatchObject({ nbFactures: 5, totalReglements: 1600, dernierReglement: "2026-03-01", totalVentes: 15000, solde: 13400 });
    expect(f.apercu.factures.map((x) => x.nFacture)).toEqual(["F-5", "F-4", "F-3", "F-2"]);
    expect(f.apercu.factures[0]).toMatchObject({ dateFacture: "2026-01-25", montantTotal: 5000, reste: 5000 });
    expect(f.apercu.reglements.map((x) => x.date)).toEqual(["2026-03-01", "2026-02-20", "2026-02-10"]);
    expect(f.apercu.reglements[0]).toMatchObject({ libelle: "REGLEMENT 2026-03-01", montant: 100 });
  });

  it("le solde, le total des ventes et la reprise du stock restent ceux de toujours", async () => {
    const f = (await liste()).find((x) => x.id === fiche);
    expect(f.stockAReprendre).toBe(0);
    expect(Object.keys(f)).toEqual(expect.arrayContaining(["id", "client", "exercice", "devise", "solde", "totalVentes", "stockAReprendre"]));
  });
});

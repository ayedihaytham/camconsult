import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { connecterAdmin, creerBaseJetable, demarrerServeur } from "./helpers.js";

/**
 * Encaissement en devise converti en dinars : relié à un ou plusieurs changes du même compte, avec leurs cours réels.
 * Contre un vrai PostgreSQL jetable (TEST_DATABASE_URL), données synthétiques ; ignoré sans cette variable.
 */
const actif = Boolean(process.env.TEST_DATABASE_URL);
vi.setConfig({ testTimeout: 90_000, hookTimeout: 90_000 });

describe.skipIf(!actif)("intégration PostgreSQL : encaissement en devise relié à ses changes", () => {
  let base, serveur, admin, societe, eur, tnd, usd;
  const mvt = (dateOp, libelle, debit, credit, type) => ({ dateOp, libelle, debit, credit, type });
  const etat = async () => (await admin("GET", `/api/banque?societeId=${societe}`)).json;
  const ligne = async (libelle) => (await etat()).mouvements.find((m) => m.libelle === libelle);
  const conv = (id, conversions) => admin("POST", `/api/banque/mouvements/${id}/conversions`, { conversions });

  beforeAll(async () => {
    base = await creerBaseJetable();
    serveur = await demarrerServeur(base.url);
    admin = await connecterAdmin(serveur.base);
    societe = (await admin("POST", "/api/societes", { raisonSociale: "Société Conversions", code: "CNV" })).json.id;
    eur = (await admin("POST", "/api/banque/comptes", { societeId: societe, banque: "BTL", devise: "EUR" })).json.comptes[0].id;
    tnd = (await admin("POST", "/api/banque/comptes", { societeId: societe, banque: "BTL", devise: "TND" })).json.comptes.find((c) => c.devise === "TND").id;
    usd = (await admin("POST", "/api/banque/comptes", { societeId: societe, banque: "BTL", devise: "USD" })).json.comptes.find((c) => c.devise === "USD").id;
    await admin("POST", `/api/banque/comptes/${eur}/import`, { mouvements: [
      mvt("2026-02-10", "ENC A", 0, 30000, "encaissement_client"),
      mvt("2026-02-11", "ENC B", 0, 8000, "encaissement_client"),
      mvt("2026-02-12", "VENTE EUR 1", 20000, 0, "change"),
      mvt("2026-03-01", "VENTE EUR 2", 15000, 0, "change"),
      mvt("2026-03-02", "FRAIS", 20, 0, "frais"),
    ] });
    await admin("POST", `/api/banque/comptes/${tnd}/import`, { mouvements: [mvt("2026-02-12", "ACHAT TND 1", 0, 66000, "change")] });
    await admin("POST", `/api/banque/comptes/${usd}/import`, { mouvements: [mvt("2026-02-12", "VENTE USD", 5000, 0, "change"), mvt("2026-02-10", "ENC USD", 0, 5000, "encaissement_client")] });
    const e = await etat();
    const id = (l) => e.mouvements.find((m) => m.libelle === l).id;
    expect((await admin("POST", "/api/banque/changes-lies", { paires: [{ a: id("VENTE EUR 1"), b: id("ACHAT TND 1") }] })).status).toBe(200);
  });
  afterAll(async () => {
    await serveur?.arreter();
    await base?.supprimer();
  });

  it("un encaissement se relie à deux changes : parts, cours réel du change relié, cours inconnu pour l'autre ; remplacer, puis tout retirer", async () => {
    const a = await ligne("ENC A");
    const c1 = await ligne("VENTE EUR 1");
    const c2 = await ligne("VENTE EUR 2");
    expect(a.conversions).toEqual([]);
    const r = await conv(a.id, [{ changeId: c1.id, montant: 20000 }, { changeId: c2.id, montant: 10000 }]);
    expect(r.status, r.texte).toBe(200);
    const apres = await ligne("ENC A");
    expect(apres.conversions).toHaveLength(2);
    expect(apres.conversions.find((x) => x.changeId === c1.id)).toMatchObject({ montant: 20000, dateOp: "2026-02-12", coursReel: 3.3 });
    expect(apres.conversions.find((x) => x.changeId === c2.id)).toMatchObject({ montant: 10000, coursReel: null });
    expect((await ligne("VENTE EUR 1")).changeUtilise).toBe(20000);
    expect((await ligne("VENTE EUR 2")).changeUtilise).toBe(10000);
    // remplacer la répartition
    expect((await conv(a.id, [{ changeId: c1.id, montant: 12000 }])).status).toBe(200);
    expect((await ligne("ENC A")).conversions).toHaveLength(1);
    expect((await ligne("VENTE EUR 2")).changeUtilise).toBe(0);
    // tout retirer
    expect((await conv(a.id, [])).status).toBe(200);
    expect((await ligne("ENC A")).conversions).toEqual([]);
  });

  it("refus : total au-dessus de l'encaissement, change déjà épuisé par un autre encaissement, autre compte, change inconnu, encaissement en dinars", async () => {
    const a = await ligne("ENC A");
    const b = await ligne("ENC B");
    const c1 = await ligne("VENTE EUR 1");
    const c2 = await ligne("VENTE EUR 2");
    expect((await conv(b.id, [{ changeId: c1.id, montant: 9000 }])).status).toBe(400); // 9 000 > 8 000 de l'encaissement
    expect((await conv(a.id, [{ changeId: c1.id, montant: 20000 }, { changeId: c2.id, montant: 15000 }])).status).toBe(400); // 35 000 > 30 000
    // A prend 18 000 du change 1 (20 000) : B ne peut plus en prendre que 2 000
    expect((await conv(a.id, [{ changeId: c1.id, montant: 18000 }])).status).toBe(200);
    const trop = await conv(b.id, [{ changeId: c1.id, montant: 3000 }]);
    expect(trop.status).toBe(400);
    expect(trop.json.error).toMatch(/dépasse ce qui reste de ce change/);
    expect((await conv(b.id, [{ changeId: c1.id, montant: 2000 }])).status).toBe(200);
    expect((await conv(a.id, [{ changeId: c1.id, montant: 1 }, { changeId: c1.id, montant: 1 }])).status).toBe(400); // même change deux fois
    const usdChange = await ligne("VENTE USD");
    expect((await conv(a.id, [{ changeId: usdChange.id, montant: 100 }])).status).toBe(400); // change d'un autre compte
    expect((await conv(a.id, [{ changeId: "00000000-0000-4000-8000-000000000000", montant: 100 }])).status).toBe(400);
    const frais = await ligne("FRAIS");
    expect((await conv(a.id, [{ changeId: frais.id, montant: 10 }])).status).toBe(400); // pas un change
    const dinars = await ligne("ACHAT TND 1");
    expect((await conv(dinars.id, [])).status).toBe(400); // pas un encaissement client
    expect((await conv("00000000-0000-4000-8000-000000000000", [])).status).toBe(404);
    expect((await conv("pas-un-uuid", [])).status).toBe(404);
    expect((await admin("POST", `/api/banque/mouvements/${a.id}/conversions`, { conversions: [{ changeId: c1.id, montant: -5 }] })).status).toBe(400);
  });

  it("un change supprimé ou une ligne supprimée emporte ses liens (pas de part orpheline)", async () => {
    const a = await ligne("ENC A");
    const c1 = await ligne("VENTE EUR 1");
    expect((await ligne("ENC A")).conversions.length).toBeGreaterThan(0);
    await admin("DELETE", `/api/banque/mouvements/${c1.id}`);
    expect((await ligne("ENC A")).conversions).toEqual([]);
    expect(a.id).toBeTruthy();
  });
});

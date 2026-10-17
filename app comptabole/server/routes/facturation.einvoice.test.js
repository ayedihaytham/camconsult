import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Base simulée, sessions et données fictives : aucun accès réseau ni base réelle.
const etat = vi.hoisted(() => ({
  role: "admin",
  meta: {},
  societe: {},
  statutFacture: "emise",
  einvoice: null, // { statut, teif_version, teif_sha256, genere_le, teif_xml }
  inserts: [],
  updates: [],
  rowCount: 1,
}));

const ID = "11111111-1111-4111-8111-111111111111";
const SOC = "22222222-2222-4222-8222-222222222222";

vi.mock("../db.js", () => {
  const query = vi.fn(async (sql, params = []) => {
    if (sql.includes("from factures f join societes s"))
      return {
        rows: [
          {
            id: ID, societe_id: SOC, numero: "2026-0001", date_emission: "2026-10-17", echeance: "2026-11-16", tva_taux: 19, timbre: 1,
            statut: etat.statutFacture, paye_le: null, signee_le: null, note: "", cree_le: new Date("2026-10-17T10:00:00Z"),
            societe_nom: "CLIENT EXEMPLE SARL", societe_adresse: "", societe_tva: "", societe_rne: "",
            ei_statut: etat.einvoice?.statut ?? null, ei_genere_le: etat.einvoice?.genere_le ?? null, ei_sha256: etat.einvoice?.teif_sha256 ?? null,
          },
        ],
      };
    if (sql.includes("from facture_lignes"))
      return { rows: [{ id: "l1", facture_id: ID, ordre: 0, description: "Honoraires", quantite: 1, montant_ht: 500 }, { id: "l2", facture_id: ID, ordre: 1, description: "Déclaration", quantite: 2, montant_ht: 100 }] };
    if (sql.includes("from societes where id")) return { rows: [etat.societe] };
    if (sql.includes("from app_meta")) return { rows: [etat.meta] };
    if (sql.startsWith("insert into facture_einvoice")) {
      etat.inserts.push(params);
      return { rows: [], rowCount: etat.rowCount };
    }
    if (sql.startsWith("update facture_einvoice")) {
      etat.updates.push(params);
      return { rows: [], rowCount: etat.rowCount };
    }
    if (sql.startsWith("select statut, teif_version")) return { rows: etat.einvoice ? [etat.einvoice] : [] };
    if (sql.includes("select e.teif_xml")) return { rows: etat.einvoice ? [{ teif_xml: etat.einvoice.teif_xml, numero: "2026-0001", statut: etat.statutFacture }] : [] };
    if (sql.startsWith("select numero, statut from factures")) return { rows: [{ numero: "2026-0001", statut: etat.statutFacture }] };
    if (sql.startsWith("select statut from facture_einvoice")) return { rows: etat.einvoice ? [{ statut: etat.einvoice.statut }] : [] };
    if (sql.startsWith("update factures set")) return { rows: [] };
    throw new Error(`requête inattendue : ${sql.slice(0, 80)}`);
  });
  return { query, withTransaction: (action) => action({ query }) };
});
vi.mock("../auth.js", async (importOriginal) => ({
  ...(await importOriginal()),
  requireAuth: (req, _res, next) => {
    req.session = { role: etat.role, poste: null, nom: "Admin", societeIds: null };
    next();
  },
}));
vi.mock("../journal.js", () => ({ logAction: vi.fn() }));

import { facturationRouter } from "./facturation.js";

let server;
let base;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/facturation", facturationRouter);
  server = await new Promise((resolve) => {
    const l = app.listen(0, "127.0.0.1", () => resolve(l));
  });
  base = `http://127.0.0.1:${server.address().port}/facturation`;
});
afterAll(() => new Promise((resolve) => server.close(resolve)));

const complets = () => {
  etat.meta = { cabinet_nom: "CABINET EXEMPLE", cabinet_mf: "1234567ABM000", cabinet_adresse: "1 Rue Exemple", cabinet_rue: "Rue Exemple", cabinet_ville: "Tunis", cabinet_code_postal: "1000", cabinet_pays: "TN", cabinet_rib: "00 000" };
  etat.societe = { raison_sociale: "CLIENT EXEMPLE SARL", tva: "7654321KAM000", adresse: "2 Avenue Exemple", adresse_rue: "Avenue Exemple", ville: "Sfax", code_postal: "3000", pays: "TN" };
};
beforeEach(() => {
  etat.role = "admin";
  etat.statutFacture = "emise";
  etat.einvoice = null;
  etat.inserts = [];
  etat.updates = [];
  etat.rowCount = 1;
  complets();
});

const appel = (chemin, methode = "GET") => fetch(`${base}${chemin}`, { method: methode });

describe("facture électronique : conformité", () => {
  it("identité incomplète : bloquants listés avec l'endroit où corriger, rien d'enregistré", async () => {
    etat.meta = { cabinet_mf: "005910DAM000" };
    etat.societe = { raison_sociale: "CLIENT EXEMPLE SARL", tva: "", adresse: "", adresse_rue: "", ville: "", code_postal: "", pays: "TN" };
    const r = await appel(`/${ID}/einvoice`);
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.pret).toBe(false);
    const bloquants = j.problemes.filter((p) => p.niveau === "bloquant").map((p) => `${p.ou}:${p.champ}`);
    expect(bloquants).toEqual(expect.arrayContaining(["cabinet:matriculeFiscal", "cabinet:nom", "societe:matriculeFiscal", "societe:ville"]));
    expect(etat.inserts).toEqual([]);
  });

  it("identité complète : prête", async () => {
    const j = await (await appel(`/${ID}/einvoice`)).json();
    expect(j.pret).toBe(true);
    expect(j.einvoice).toBeNull();
    expect(j.version).toBe("1.8.9");
  });

  it("identifiant invalide : 400 ; facture inconnue : 404", async () => {
    expect((await appel("/pas-un-uuid/einvoice")).status).toBe(400);
  });

  it("réservé à l'administrateur", async () => {
    etat.role = "employe";
    expect((await appel(`/${ID}/einvoice`)).status).toBe(403);
    expect((await appel(`/${ID}/einvoice/preparer`, "POST")).status).toBe(403);
    expect((await appel(`/${ID}/einvoice/xml`)).status).toBe(403);
  });
});

describe("facture électronique : préparation et téléchargement", () => {
  it("prépare : enregistre le XML et son empreinte, répond 201", async () => {
    etat.einvoice = { statut: "prete", teif_version: "1.8.9", teif_sha256: "abc", genere_le: new Date("2026-10-17T10:00:00Z"), teif_xml: "<TEIF/>" };
    const r = await appel(`/${ID}/einvoice/preparer`, "POST");
    expect(r.status).toBe(201);
    const [id, version, xml, sha] = etat.inserts[0];
    expect(id).toBe(ID);
    expect(version).toBe("1.8.9");
    expect(xml).toContain("<DocumentIdentifier>2026-0001</DocumentIdentifier>");
    expect(sha).toMatch(/^[0-9a-f]{64}$/);
  });

  it("déjà préparée : 409 avec invitation à régénérer, sans écraser", async () => {
    etat.rowCount = 0;
    const r = await appel(`/${ID}/einvoice/preparer`, "POST");
    expect(r.status).toBe(409);
    expect((await r.json()).error).toMatch(/Régénérer/);
  });

  it("non conforme : 422 avec la liste des problèmes, rien d'enregistré", async () => {
    etat.societe.tva = "123";
    const r = await appel(`/${ID}/einvoice/preparer`, "POST");
    expect(r.status).toBe(422);
    expect((await r.json()).problemes.some((p) => p.champ === "matriculeFiscal")).toBe(true);
    expect(etat.inserts).toEqual([]);
  });

  it("régénérer : met à jour seulement une facture électronique encore « prête »", async () => {
    expect((await appel(`/${ID}/einvoice/regenerer`, "POST")).status).toBe(200);
    expect(etat.updates).toHaveLength(1);
    etat.rowCount = 0;
    expect((await appel(`/${ID}/einvoice/regenerer`, "POST")).status).toBe(409);
  });

  it("facture annulée : préparation refusée", async () => {
    etat.statutFacture = "annulee";
    const r = await appel(`/${ID}/einvoice/preparer`, "POST");
    expect(r.status).toBe(422);
    expect((await r.json()).problemes.some((p) => p.champ === "statut")).toBe(true);
  });

  it("téléchargement : XML en pièce jointe nommée <numéro>.xml, sans mise en cache", async () => {
    etat.einvoice = { statut: "prete", teif_version: "1.8.9", teif_sha256: "abc", genere_le: new Date(), teif_xml: "<?xml version=\"1.0\"?><TEIF/>" };
    const r = await appel(`/${ID}/einvoice/xml`);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("application/xml");
    expect(r.headers.get("content-disposition")).toBe('attachment; filename="2026-0001.xml"');
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(await r.text()).toContain("<TEIF/>");
  });

  it("téléchargement : 404 si rien n'est préparé, 409 si la facture est annulée", async () => {
    expect((await appel(`/${ID}/einvoice/xml`)).status).toBe(404);
    etat.einvoice = { statut: "prete", teif_version: "1.8.9", teif_sha256: "abc", genere_le: new Date(), teif_xml: "<TEIF/>" };
    etat.statutFacture = "annulee";
    expect((await appel(`/${ID}/einvoice/xml`)).status).toBe(409);
  });
});

describe("annulation d'une facture électronique", () => {
  const annuler = () => fetch(`${base}/${ID}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ statut: "annulee" }) });

  it("permise tant que la facture électronique est seulement préparée", async () => {
    etat.einvoice = { statut: "prete", teif_version: "1.8.9", teif_sha256: "abc", genere_le: new Date(), teif_xml: "<TEIF/>" };
    expect((await annuler()).status).toBe(200);
  });

  it("refusée une fois signée ou déposée (avoir requis)", async () => {
    etat.einvoice = { statut: "deposee", teif_version: "1.8.9", teif_sha256: "abc", genere_le: new Date(), teif_xml: "<TEIF/>" };
    const r = await annuler();
    expect(r.status).toBe(409);
    expect((await r.json()).error).toMatch(/avoir/);
  });
});

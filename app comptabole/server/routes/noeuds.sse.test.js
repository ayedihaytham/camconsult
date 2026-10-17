import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Base simulée, sessions fictives : aucun accès réseau ni base réelle.
const etat = vi.hoisted(() => ({ push: [], societe: "soc-1", noeud: null }));

vi.mock("../db.js", () => {
  const query = vi.fn(async (sql) => {
    if (sql.startsWith("insert into noeuds")) return { rows: [etat.noeud] };
    if (sql.includes("from societes where id")) return { rows: [{ raison_sociale: "Société fictive" }] };
    if (sql.includes("role = 'responsable_collaborateurs'")) return { rows: [{ id: "resp-1" }] };
    if (sql.startsWith("delete from noeuds")) return { rows: [{ libelle: "x", type: "fichier", societe_id: etat.societe }] };
    if (sql.startsWith("select * from noeuds where id")) return { rows: [etat.noeud] };
    if (sql.startsWith("update noeuds")) return { rows: [etat.noeud] };
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
vi.mock("../notifications.js", () => ({
  notifyMany: vi.fn(),
  notifKey: () => "admin",
  concernedBySociete: vi.fn(async (societeId) => (societeId ? ["admin", "collab-1", "client-1"] : ["admin"])),
}));
vi.mock("../sse.js", () => ({ pushToUser: (cle, type) => etat.push.push([cle, type]) }));

import { noeudsRouter } from "./noeuds.js";

let server;
let base;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/noeuds", noeudsRouter);
  server = await new Promise((resolve) => {
    const l = app.listen(0, "127.0.0.1", () => resolve(l));
  });
  base = `http://127.0.0.1:${server.address().port}/noeuds`;
});
afterAll(() => new Promise((resolve) => server.close(resolve)));

beforeEach(() => {
  etat.push.length = 0;
  etat.noeud = { id: "n1", libelle: "f.pdf", description: "", type: "fichier", societe_id: etat.societe, parent_id: null, format: "pdf", taille: "1 Ko", maj_le: "2026-10-16", cree_le: "2026-10-16", data_url: null };
});

const envoyer = (chemin, methode, corps) => fetch(`${base}${chemin}`, { method: methode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps ?? {}) });
const cibles = () => etat.push.filter(([, type]) => type === "noeuds").map(([cle]) => cle).sort();
// Le signal part après la réponse (« void ») : on laisse la boucle d'événements le terminer.
const attendre = () => new Promise((r) => setTimeout(r, 30));

describe("structuration : signal temps réel « noeuds »", () => {
  it("un dépôt prévient les personnes de la société (auteur compris) et les responsables des collaborateurs, jamais avec le contenu", async () => {
    const r = await envoyer("/", "POST", { libelle: "f.pdf", type: "fichier", societeId: "soc-1", parentId: null });
    expect(r.status).toBe(201);
    await attendre();
    expect(cibles()).toEqual(["admin", "client-1", "collab-1", "resp-1"]);
    expect(etat.push.every(([, type]) => type === "noeuds")).toBe(true);
  });

  it("un dossier sans société ne prévient que l'admin et les responsables", async () => {
    etat.noeud.societe_id = null;
    const r = await envoyer("/", "POST", { libelle: "Général", type: "dossier", societeId: null });
    expect(r.status).toBe(201);
    await attendre();
    expect(cibles()).toEqual(["admin", "resp-1"]);
  });

  it("déplacement, suppression : même signal", async () => {
    const m = await envoyer("/n1", "PATCH", { libelle: "renommé" });
    expect(m.status).toBe(200);
    await attendre();
    expect(cibles()).toContain("client-1");
    etat.push.length = 0;
    const s = await envoyer("/bulk-delete", "POST", { ids: ["n1"] });
    expect(s.status).toBe(200);
    await attendre();
    expect(cibles()).toContain("collab-1");
  });

  it("une requête refusée ne diffuse rien", async () => {
    const r = await envoyer("/", "POST", { type: "fichier" }); // libellé manquant
    expect(r.status).toBe(400);
    await attendre();
    expect(etat.push).toEqual([]);
  });
});

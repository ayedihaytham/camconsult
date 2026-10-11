import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { tachesRouter } from "./taches.js";
import { tacheDto } from "../mappers.js";
const state = vi.hoisted(() => ({ session: null, task: null, query: vi.fn() }));
vi.mock("../db.js", () => ({ query: state.query }));
vi.mock("../auth.js", () => ({ requireAuth: (req, _res, next) => { req.session = state.session; next(); }, canSeeSociete: () => true }));
vi.mock("../journal.js", () => ({ logAction: vi.fn() }));
vi.mock("../notifications.js", () => ({ notify: vi.fn(), notifyMany: vi.fn() }));
const SOC = "17a832e9-76a4-46bc-860d-b056509a6b30";
let server;
let base;
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.use("/taches", tachesRouter);
  server = await new Promise((resolve) => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  base = `http://127.0.0.1:${server.address().port}/taches`;
});
afterAll(() => new Promise((resolve) => server.close(resolve)));
beforeEach(() => {
  state.session = { role: "admin", nom: "Cabinet", societeIds: null };
  state.task = { id: "t1", titre: "Contrôler les pièces", description: "", societe_id: SOC, assigne_id: "employee-1", statut: "a_faire", origine: "cabinet", module: null, debut_prevu: "2026-10-11", fin_prevue: "2026-10-14", cree_le: new Date(), maj_le: new Date() };
  state.query.mockReset().mockImplementation(async (sql, params = []) => {
    if (sql.startsWith("select * from taches")) return { rows: [{ ...state.task }] };
    if (sql.startsWith("select raison_sociale from societes")) return { rows: [{ raison_sociale: "Société" }] };
    if (sql.includes("insert into taches")) { state.task = { ...state.task, titre: params[0], description: params[1], societe_id: params[2], assigne_id: params[3], statut: params[4], origine: params[6], module: params[7], debut_prevu: params[8], fin_prevue: params[9] }; return { rows: [state.task] }; }
    if (sql.includes("update taches set")) { state.task = { ...state.task, titre: params[0], description: params[1], societe_id: params[2], assigne_id: params[3], statut: params[4], termine_le: params[5], module: params[7], debut_prevu: params[8], fin_prevue: params[9] }; return { rows: [state.task] }; }
    return { rows: [] };
  });
});
const request = (method, path, body) => fetch(base + path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
describe("API de planification des tâches", () => {
  it("persiste et retourne les dates de création et de modification", async () => {
    const created = await request("POST", "", { titre: "Préparer la clôture", societeId: SOC, debutPrevu: "2026-11-01", finPrevue: "2026-11-05" });
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({ debutPrevu: "2026-11-01", finPrevue: "2026-11-05" });
    const changed = await request("PATCH", "/t1", { finPrevue: "2026-11-06" });
    expect(changed.status).toBe(200);
    expect(await changed.json()).toMatchObject({ debutPrevu: "2026-11-01", finPrevue: "2026-11-06" });
  });
  it("préserve la planification lors d'un changement de statut et permet d'effacer les deux dates", async () => {
    const status = await request("PATCH", "/t1", { statut: "en_cours" });
    expect(await status.json()).toMatchObject({ debutPrevu: "2026-10-11", finPrevue: "2026-10-14" });
    const cleared = await request("PATCH", "/t1", { debutPrevu: null, finPrevue: null });
    expect(await cleared.json()).toMatchObject({ debutPrevu: null, finPrevue: null });
  });
  it("rejette les intervalles incomplets, impossibles et inversés avant toute mutation", async () => {
    for (const patch of [{ finPrevue: "2026-10-01" }, { debutPrevu: null }, { debutPrevu: "2026-02-30" }]) {
      expect((await request("PATCH", "/t1", patch)).status).toBe(400);
    }
    expect(state.query.mock.calls.some(([sql]) => sql.includes("update taches"))).toBe(false);
  });
  it("interdit à l'assigné de modifier les dates tout en conservant sa transition autorisée", async () => {
    state.session = { role: "employe", poste: "collaborateur", employeId: "employee-1", nom: "Collaborateur" };
    expect((await request("PATCH", "/t1", { finPrevue: "2026-10-15" })).status).toBe(403);
    expect((await request("PATCH", "/t1", { statut: "en_cours" })).status).toBe(200);
  });
  it("garde les tâches société en lecture seule pour le cabinet", async () => {
    state.task.origine = "societe";
    expect((await request("PATCH", "/t1", { finPrevue: "2026-10-15" })).status).toBe(403);
    expect(state.query.mock.calls.some(([sql]) => sql.includes("update taches"))).toBe(false);
  });
  it("mappe des dates PostgreSQL locales sans déplacement vers le jour précédent", () => {
    expect(tacheDto({ ...state.task, debut_prevu: new Date(2026, 9, 11), fin_prevue: new Date(2026, 9, 12) })).toMatchObject({ debutPrevu: "2026-10-11", finPrevue: "2026-10-12" });
  });
  it("accepte un changement de statut lorsque PostgreSQL fournit des objets Date", async () => {
    state.task.debut_prevu = new Date(2026, 9, 11);
    state.task.fin_prevue = new Date(2026, 9, 14);
    const response = await request("PATCH", "/t1", { statut: "en_cours" });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ debutPrevu: "2026-10-11", finPrevue: "2026-10-14" });
  });
});

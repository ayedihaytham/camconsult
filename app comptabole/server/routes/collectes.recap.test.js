import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { collectesRouter } from "./collectes.js";

const state = vi.hoisted(() => ({ session: null, collecte: null, section: null, query: vi.fn() }));

vi.mock("../db.js", () => ({
  query: state.query,
  withTransaction: (action) => action({ query: state.query }),
}));
vi.mock("../auth.js", async (importOriginal) => ({
  ...await importOriginal(),
  requireAuth: (req, _res, next) => {
    req.session = state.session;
    next();
  },
}));
vi.mock("../journal.js", () => ({ logAction: vi.fn() }));
vi.mock("../relances.js", () => ({ sendRelance: vi.fn() }));
vi.mock("../notifications.js", () => ({
  notify: vi.fn(),
  notifyMany: vi.fn(),
  notifKey: () => "admin",
  concernedBySociete: vi.fn().mockResolvedValue([]),
}));

let server;
let baseUrl;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/collectes", collectesRouter);
  server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/collectes/c1`;
});
afterAll(() => new Promise((resolve) => server.close(resolve)));

beforeEach(() => {
  state.session = { role: "admin", nom: "Admin", societeIds: null };
  state.collecte = { id: "c1", societe_id: "s1", onglets: ["souche_cheques"], statut: "brouillon", periode: "2026-10" };
  state.section = { id: "section-1", onglet: "souche_cheques", statut: "brouillon", recap_statut: "none" };
  state.query.mockReset().mockImplementation(async (sql, params = []) => {
    if (sql.startsWith("select * from collectes") || sql.startsWith("select statut from collectes"))
      return { rows: [state.collecte] };
    if (sql.startsWith("select * from collecte_sections") || sql.startsWith("select statut from collecte_sections"))
      return { rows: [state.section] };
    if (sql.startsWith("select raison_sociale")) return { rows: [{ raison_sociale: "Société test" }] };
    if (sql.includes("insert into collecte_sections (collecte_id, onglet, recap_statut)")) {
      state.section.recap_statut = "envoye";
      if (["transmis", "valide"].includes(state.section.statut)) state.section.statut = "a_corriger";
    }
    if (sql.includes("insert into collecte_sections (collecte_id, onglet, statut)")) {
      state.section.statut = params[2];
      if (params[2] === "transmis" && state.section.recap_statut === "envoye") state.section.recap_statut = "repondu";
      if (["valide", "archive"].includes(params[2])) state.section.recap_statut = "none";
    }
    if (sql.startsWith("update collecte_sections set recap_statut = 'none'")) state.section.recap_statut = "none";
    if (sql.startsWith("update collecte_sections set recap_statut = 'repondu'")) state.section.recap_statut = "repondu";
    return { rows: [], rowCount: 1 };
  });
});

async function post(path, body = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

describe("collecte recap authorization and archive protection", () => {
  it.each(["collaborateur", "responsable_collaborateurs", "societe_employe"])("rejects recap management by %s before reading or changing data", async (poste) => {
    state.session = { role: "employe", poste, societeIds: ["s1"] };
    for (const action of ["send", "close"]) {
      expect((await post(`/sections/souche_cheques/recap/${action}`)).status).toBe(403);
    }
    expect(state.query).not.toHaveBeenCalled();
  });

  it.each(["send", "close"])("rejects %s for an archived collecte", async (action) => {
    state.collecte.statut = "archive";
    expect((await post(`/sections/souche_cheques/recap/${action}`)).status).toBe(400);
    expect(state.section.recap_statut).toBe("none");
    expect(state.query.mock.calls.every(([sql]) => sql.startsWith("select"))).toBe(true);
  });

  it.each(["send", "close"])("rejects %s for an individually archived table", async (action) => {
    state.section.statut = "archive";
    expect((await post(`/sections/souche_cheques/recap/${action}`)).status).toBe(400);
    expect(state.query.mock.calls.every(([sql]) => sql.startsWith("select"))).toBe(true);
  });

  it.each(["send", "close"])("rejects %s for a table outside the collecte", async (action) => {
    expect((await post(`/sections/virements_recus/recap/${action}`)).status).toBe(400);
    expect(state.query.mock.calls.every(([sql]) => sql.startsWith("select"))).toBe(true);
  });

  it("lets the admin request a validated table again and close the request", async () => {
    state.section.statut = "valide";
    const sent = await post("/sections/souche_cheques/recap/send", { count: 2 });
    expect(sent.status).toBe(200);
    expect(sent.body.sections[0]).toMatchObject({ statut: "a_corriger", recapStatut: "envoye" });
    const closed = await post("/sections/souche_cheques/recap/close");
    expect(closed.status).toBe(200);
    expect(closed.body.sections[0]).toMatchObject({ statut: "a_corriger", recapStatut: "none" });
  });

  it("keeps client table transmission linked to its own recap response", async () => {
    state.session = { role: "employe", poste: "societe_employe", nom: "Client", societeIds: ["s1"] };
    state.section.recap_statut = "envoye";
    const response = await post("/sections/souche_cheques/transmettre");
    expect(response.status).toBe(200);
    expect(response.body.sections[0]).toMatchObject({ statut: "transmis", recapStatut: "repondu" });
  });

  it("keeps the scoped client recap response authorized", async () => {
    state.session = { role: "employe", poste: "societe_employe", nom: "Client", societeIds: ["s1"] };
    state.section.recap_statut = "envoye";
    expect((await post("/recap/submit")).status).toBe(200);
    expect(state.section.recap_statut).toBe("repondu");
  });

  it("keeps collaborator table validation authorized", async () => {
    state.session = { role: "employe", poste: "collaborateur", nom: "Collaborateur", societeIds: ["s1"] };
    state.section.statut = "transmis";
    const response = await post("/sections/souche_cheques/valider");
    expect(response.status).toBe(200);
    expect(response.body.sections[0].statut).toBe("valide");
  });
});

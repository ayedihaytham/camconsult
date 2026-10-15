import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({ session: null, query: null, appels: [] }));

vi.mock("../db.js", () => ({
  query: (...a) => etat.query(...a),
  withTransaction: (action) => action({ query: (...a) => etat.query(...a) }),
}));
vi.mock("../auth.js", async (importOriginal) => ({
  ...(await importOriginal()),
  requireAuth: (req, _res, next) => {
    req.session = etat.session;
    next();
  },
}));
vi.mock("../journal.js", () => ({ logAction: vi.fn() }));
vi.mock("../notifications.js", () => ({
  notify: vi.fn(),
  notifyMany: vi.fn(),
  notifKey: () => "admin",
  concernedBySociete: vi.fn().mockResolvedValue([]),
}));
vi.mock("../mailer.js", () => ({
  sendAccessLinkEmail: vi.fn().mockResolvedValue("smtp"),
  sendSocieteWelcomeEmail: vi.fn().mockResolvedValue(undefined),
}));

import { employesRouter } from "./employes.js";
import { societesRouter } from "./societes.js";
import { stockRouter } from "./stock.js";
import { dataRouter } from "./data.js";
import { journalRouter } from "./journal.js";
import { societeDto } from "../mappers.js";

let server;
let base;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/employes", employesRouter);
  app.use("/societes", societesRouter);
  app.use("/stock", stockRouter);
  app.use("/data", dataRouter);
  app.use("/journal", journalRouter);
  server = await new Promise((resolve) => {
    const l = app.listen(0, "127.0.0.1", () => resolve(l));
  });
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(() => new Promise((resolve) => server.close(resolve)));

const admin = { role: "admin", poste: null, nom: "Admin", societeIds: null };
const clientSociete = { role: "employe", poste: "societe_employe", nom: "Client", societeIds: ["s1"], employeId: "c1" };
const appel = (methode, chemin, corps) =>
  fetch(`${base}${chemin}`, { method: methode, headers: { "Content-Type": "application/json" }, body: corps === undefined ? undefined : JSON.stringify(corps) });

const ligneEmploye = {
  id: "e1", nom: "Ayedi", prenom: "Haytham", identifiant: "h.ayedi", mot_de_passe: "LEGACY-EN-CLAIR-123", mdp_hash: "scrypt$65536$8$2$c2Vs$aGFzaA==",
  type: "Comptable", role: "collaborateur", societe_id: null, email: "h@example.com", statut: "actif", societes_assignees: [], permissions: {}, doit_changer_mdp: false,
};

beforeEach(() => {
  etat.session = admin;
  etat.appels = [];
  etat.query = vi.fn(async (sql, params = []) => {
    etat.appels.push({ sql, params });
    if (sql.startsWith("select * from employes order by")) return { rows: [ligneEmploye] };
    if (sql.startsWith("select * from employes where id")) return { rows: [ligneEmploye] };
    if (sql.startsWith("insert into employes")) return { rows: [{ ...ligneEmploye, id: "e2", mot_de_passe: "", mdp_hash: null, doit_changer_mdp: true }] };
    if (sql.startsWith("update employes set nom")) return { rows: [ligneEmploye] };
    if (sql.startsWith("select 1 from employes where identifiant")) return { rows: [] };
    if (sql.startsWith("update password_tokens") || sql.startsWith("insert into password_tokens")) return { rows: [] };
    return { rows: [] };
  });
});

describe("SEC-01 : aucun mot de passe ni empreinte dans les réponses de l'API", () => {
  it("la liste des employés ne contient ni le mot de passe hérité ni l'empreinte, même pour l'administrateur", async () => {
    const texte = await (await appel("GET", "/employes")).text();
    expect(texte).not.toContain("LEGACY-EN-CLAIR-123");
    expect(texte).not.toContain("scrypt$");
    expect(texte).not.toContain("motDePasse");
    expect(JSON.parse(texte)[0].accesActive).toBe(true);
  });

  it("la création n'enregistre aucun mot de passe, renvoie un lien d'activation à usage unique et ignore un mot de passe envoyé", async () => {
    const r = await appel("POST", "/employes", { nom: "Ben Ali", prenom: "Sami", identifiant: "s.benali", email: "s@example.com", motDePasse: "MotDePasseImpose123", type: "Comptable" });
    expect(r.status).toBe(201);
    const corps = await r.json();
    expect(corps.lienAcces).toMatch(/\/activation\?token=[A-Za-z0-9_-]{30,}/);
    expect(JSON.stringify(corps)).not.toContain("MotDePasseImpose123");
    const insertion = etat.appels.find((a) => a.sql.startsWith("insert into employes"));
    expect(JSON.stringify(insertion.params)).not.toContain("MotDePasseImpose123");
    expect(insertion.sql).toContain("doit_changer_mdp");
    // Le jeton n'est stocké que sous forme d'empreinte.
    const jeton = corps.lienAcces.split("token=")[1];
    const stocke = etat.appels.find((a) => a.sql.startsWith("insert into password_tokens"));
    expect(JSON.stringify(stocke.params)).not.toContain(jeton);
  });

  it("la modification ne change plus le mot de passe", async () => {
    const r = await appel("PATCH", "/employes/e1", { motDePasse: "Pirate-Mdp-0001", nom: "Ayedi" });
    expect(r.status).toBe(200);
    const maj = etat.appels.find((a) => a.sql.startsWith("update employes set nom"));
    expect(maj.sql).not.toContain("mot_de_passe");
    expect(JSON.stringify(maj.params)).not.toContain("Pirate-Mdp-0001");
  });

  it("émettre un lien d'accès ne renvoie ni mot de passe ni empreinte", async () => {
    const r = await appel("POST", "/employes/e1/envoyer-acces");
    expect(r.status).toBe(200);
    const texte = await r.text();
    expect(texte).toContain("lienAcces");
    expect(texte).not.toContain("LEGACY-EN-CLAIR-123");
    expect(texte).not.toContain("scrypt$");
  });

  it("la duplication ne copie jamais le mot de passe hérité", async () => {
    await appel("POST", "/employes/e1/duplicate");
    const insertion = etat.appels.find((a) => a.sql.startsWith("insert into employes"));
    expect(JSON.stringify(insertion.params)).not.toContain("LEGACY-EN-CLAIR-123");
  });
});

describe("SEC-07 : identifiants et mots de passe de société", () => {
  it("le DTO d'une société n'expose ni identifiant ni mot de passe", () => {
    const dto = societeDto({ id: "s1", raison_sociale: "X", identifiant: "login-societe", mot_de_passe: "mdp-societe", statut: "actif" });
    expect(JSON.stringify(dto)).not.toContain("login-societe");
    expect(JSON.stringify(dto)).not.toContain("mdp-societe");
  });
});

describe("FIN-02 : suppression d'une société portant des écritures à conserver", () => {
  beforeEach(() => {
    etat.query = vi.fn(async (sql) => {
      if (sql.includes("cross join lateral")) return { rows: [{ id: "s1", raison_sociale: "ACME", elements: "3 facture(s), 1 compte(s) bancaire(s)" }] };
      if (sql.startsWith("select id, raison_sociale from societes")) return { rows: [{ id: "s1", raison_sociale: "ACME" }] };
      if (sql.startsWith("delete from societes")) return { rows: [{ raison_sociale: "ACME" }] };
      return { rows: [] };
    });
  });

  it("refuse (409) sans confirmation explicite et ne supprime rien", async () => {
    const r = await appel("POST", "/societes/bulk-delete", { ids: ["8b5e1c52-0000-4000-8000-000000000001"] });
    expect(r.status).toBe(409);
    expect((await r.json()).error).toMatch(/3 facture\(s\)/);
    expect(etat.query.mock.calls.some(([sql]) => sql.startsWith("delete from societes"))).toBe(false);
  });

  it("supprime avec la confirmation définitive", async () => {
    const r = await appel("POST", "/societes/bulk-delete", { ids: ["8b5e1c52-0000-4000-8000-000000000001"], confirmationDefinitive: "SUPPRIMER DEFINITIVEMENT" });
    expect(r.status).toBe(200);
    expect(etat.query.mock.calls.some(([sql]) => sql.startsWith("delete from societes"))).toBe(true);
  });
});

describe("accès réservé : extraction IA payante, réinitialisation, journal", () => {
  it("un compte société ne peut pas lancer l'extraction par IA, avec ou sans société précisée", async () => {
    etat.session = clientSociete;
    const avec = await appel("POST", "/stock/extract", { type: "achat", dataUrl: "data:application/pdf;base64,AAAAAAAAAAAA", societeId: "8b5e1c52-0000-4000-8000-000000000001" });
    const sans = await appel("POST", "/stock/extract", { type: "achat", dataUrl: "data:application/pdf;base64,AAAAAAAAAAAA" });
    const pages = await appel("POST", "/stock/extract-pages", { societeId: "8b5e1c52-0000-4000-8000-000000000001", dataUrl: "data:application/pdf;base64,AAAAAAAAAAAA" });
    expect([avec.status, sans.status, pages.status]).toEqual([403, 403, 403]);
  });

  it("la réinitialisation exige la confirmation, et un administrateur", async () => {
    etat.query = vi.fn(async () => ({ rows: [] }));
    expect((await appel("POST", "/data/reset", {})).status).toBe(400);
    expect((await appel("POST", "/data/reset", { confirmation: "oui" })).status).toBe(400);
    expect(etat.query).not.toHaveBeenCalled();
    etat.session = clientSociete;
    expect((await appel("POST", "/data/reset", { confirmation: "RÉINITIALISER" })).status).toBe(403);
    expect(etat.query).not.toHaveBeenCalled();
  });

  it("en production la réinitialisation est désactivée sans ALLOW_DATA_RESET, même confirmée", async () => {
    etat.query = vi.fn(async () => ({ rows: [] }));
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_DATA_RESET", "");
    const r = await appel("POST", "/data/reset", { confirmation: "RÉINITIALISER" });
    vi.unstubAllEnvs();
    expect(r.status).toBe(403);
    expect(etat.query).not.toHaveBeenCalled();
  });

  it("la restauration exige la confirmation et un administrateur, et ne touche à rien sans elle", async () => {
    etat.query = vi.fn(async () => ({ rows: [] }));
    expect((await appel("POST", "/data/restore", { societes: [] })).status).toBe(400);
    expect((await appel("POST", "/data/restore", { societes: [], confirmation: "oui" })).status).toBe(400);
    expect(etat.query).not.toHaveBeenCalled();
    etat.session = clientSociete;
    expect((await appel("POST", "/data/restore", { societes: [], confirmation: "RESTAURER" })).status).toBe(403);
    expect(etat.query).not.toHaveBeenCalled();
  });

  it("la restauration est désactivée en production sans ALLOW_DATA_RESET", async () => {
    etat.query = vi.fn(async () => ({ rows: [] }));
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_DATA_RESET", "");
    const r = await appel("POST", "/data/restore", { societes: [], confirmation: "RESTAURER" });
    vi.unstubAllEnvs();
    expect(r.status).toBe(403);
    expect(etat.query).not.toHaveBeenCalled();
  });

  it("la restauration est refusée (409) si elle détruirait des factures ou d'autres données absentes de la sauvegarde", async () => {
    etat.query = vi.fn(async (sql) => ({ rows: sql.includes("from factures") ? [{ t: "factures", n: 3 }, { t: "collectes", n: 1 }] : [] }));
    const r = await appel("POST", "/data/restore", { societes: [], confirmation: "RESTAURER" });
    expect(r.status).toBe(409);
    expect((await r.json()).error).toMatch(/3 facture\(s\), 1 collecte\(s\)/);
    expect(etat.query.mock.calls.some(([sql]) => String(sql).startsWith("truncate"))).toBe(false);
  });

  it("le journal ne peut plus être vidé par l'API", async () => {
    etat.query = vi.fn(async () => ({ rows: [] }));
    expect((await appel("DELETE", "/journal")).status).toBe(404);
    expect(etat.query).not.toHaveBeenCalled();
  });
});

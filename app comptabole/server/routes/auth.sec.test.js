import express from "express";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// scrypt est volontairement lent : on laisse de la marge quand toute la suite tourne en parallèle.
vi.setConfig({ testTimeout: 30_000 });

const db = vi.hoisted(() => ({ employes: [], tokens: [], query: null }));

vi.mock("../db.js", () => ({ query: (...a) => db.query(...a), withTransaction: (action) => action({ query: (...a) => db.query(...a) }) }));
vi.mock("../journal.js", () => ({ logAction: vi.fn() }));
vi.mock("../auth.js", () => ({
  signToken: (p) => `jeton-${p.employeId ?? p.role}`,
  jetonAdmin: async () => "jeton-admin",
  jetonEmploye: async (id) => `jeton-${id}`,
  sessionAdmin: async () => ({ role: "admin", employeId: null, nom: "Test" }),
  sessionEmploye: async (id) => ({ role: "employe", employeId: id, nom: "Test" }),
  sessionFromToken: async (p) => ({ role: p.role, employeId: p.employeId ?? null, nom: "Test" }),
  requireAuth: (req, _res, next) => {
    req.session = { role: "employe", employeId: "e1", nom: "Test", identifiant: "h.test" };
    next();
  },
  requireAdmin: (_req, _res, next) => next(),
}));

import { authRouter } from "./auth.js";
import { PARAMS, creerJeton, hashPassword, estHash } from "../passwords.js";

let server;
let base;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/auth", authRouter);
  server = await new Promise((resolve) => {
    const l = app.listen(0, "127.0.0.1", () => resolve(l));
  });
  base = `http://127.0.0.1:${server.address().port}/auth`;
});
afterAll(() => new Promise((resolve) => server.close(resolve)));

const post = (chemin, corps) => fetch(`${base}${chemin}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps) });

beforeEach(() => {
  db.employes = [];
  db.tokens = [];
  db.query = async (sql, params = []) => {
    if (sql.startsWith("select * from app_meta")) return { rows: [{ admin_identifiant: "admin-cabinet", admin_password_hash: "invalide" }] };
    if (sql.startsWith("select * from employes where lower(identifiant)"))
      return { rows: db.employes.filter((e) => e.identifiant.toLowerCase() === params[0] && e.statut === "actif") };
    if (sql.startsWith("update employes set mdp_hash")) {
      const e = db.employes.find((x) => x.id === params[1]);
      // Mises à jour conditionnelles : sans effet si la valeur attendue a changé.
      if (sql.includes("and mdp_hash is null") && !(e.mdp_hash === null && e.mot_de_passe === params[2])) return { rows: [], rowCount: 0 };
      if (sql.includes("and mdp_hash = $3") && e.mdp_hash !== params[2]) return { rows: [], rowCount: 0 };
      e.mdp_hash = params[0];
      if (sql.includes("mot_de_passe = ''")) e.mot_de_passe = "";
      if (sql.includes("doit_changer_mdp = false")) e.doit_changer_mdp = false;
      return { rows: [] };
    }
    if (sql.startsWith("update employes set last_login")) return { rows: [] };
    if (sql.startsWith("select identifiant, statut from employes where id")) {
      const e = db.employes.find((x) => x.id === params[0]);
      return { rows: e ? [{ identifiant: e.identifiant, statut: e.statut }] : [] };
    }
    if (sql.startsWith("update password_tokens set used_at = now() where employe_id")) {
      db.tokens.filter((t) => t.employe_id === params[0] && !t.used).forEach((t) => (t.used = true));
      return { rows: [] };
    }
    if (sql.startsWith("insert into password_tokens")) {
      db.tokens.push({ employe_id: params[0], token_hash: params[1], expire: Date.now() + Number(params[3]), used: false });
      return { rows: [] };
    }
    if (sql.startsWith("select employe_id from password_tokens")) {
      const t = db.tokens.find((x) => x.token_hash === params[0] && !x.used && x.expire > Date.now());
      return { rows: t ? [{ employe_id: t.employe_id }] : [] };
    }
    if (sql.startsWith("update password_tokens set used_at = now() where token_hash")) {
      const t = db.tokens.find((x) => x.token_hash === params[0] && !x.used && x.expire > Date.now());
      if (t) t.used = true;
      return { rows: t ? [{ employe_id: t.employe_id }] : [] };
    }
    throw new Error(`requête inattendue : ${sql}`);
  };
});

const employe = (extra = {}) => ({ id: "e1", identifiant: "h.test", statut: "actif", type: "Comptable", mot_de_passe: "", mdp_hash: null, doit_changer_mdp: false, ...extra });

describe("connexion d'un employé", () => {
  it("convertit un compte hérité (mot de passe en clair) à la première connexion réussie, sans perdre l'accès", async () => {
    db.employes.push(employe({ mot_de_passe: "Ancien-Mdp-1234" }));
    const r = await post("/login", { identifiant: "h.test", motDePasse: "Ancien-Mdp-1234" });
    expect(r.status).toBe(200);
    expect(estHash(db.employes[0].mdp_hash)).toBe(true);
    expect(db.employes[0].mot_de_passe).toBe("");
    // La conversion ne casse pas l'accès : la deuxième connexion passe par l'empreinte.
    expect((await post("/login", { identifiant: "h.test", motDePasse: "Ancien-Mdp-1234" })).status).toBe(200);
  });

  it("n'accepte pas un compte hérité avec un mauvais mot de passe, et ne le convertit pas", async () => {
    db.employes.push(employe({ mot_de_passe: "Ancien-Mdp-1234" }));
    expect((await post("/login", { identifiant: "h.test", motDePasse: "autre-chose-1" })).status).toBe(401);
    expect(db.employes[0].mot_de_passe).toBe("Ancien-Mdp-1234");
    expect(db.employes[0].mdp_hash).toBeNull();
  });

  describe("réglage MIGRATE_LEGACY_PASSWORDS (comptes fictifs ; seule la chaîne exacte « false » suspend la conversion)", () => {
    const avant = process.env.MIGRATE_LEGACY_PASSWORDS;
    afterEach(() => {
      if (avant === undefined) delete process.env.MIGRATE_LEGACY_PASSWORDS;
      else process.env.MIGRATE_LEGACY_PASSWORDS = avant;
    });
    const regler = (v) => (v === undefined ? delete process.env.MIGRATE_LEGACY_PASSWORDS : (process.env.MIGRATE_LEGACY_PASSWORDS = v));

    it.each([
      ["false", false],
      [undefined, true],
      ["", true],
      ["true", true],
      ["False", true],
      ["FALSE", true],
      ["0", true],
      ["non", true],
      [" false", true],
    ])("valeur %j : conversion à la connexion = %s", async (valeur, convertit) => {
      regler(valeur);
      db.employes.push(employe({ mot_de_passe: "Ancien-Mdp-1234" }));
      expect((await post("/login", { identifiant: "h.test", motDePasse: "Ancien-Mdp-1234" })).status).toBe(200);
      expect(estHash(db.employes[0].mdp_hash)).toBe(convertit);
      expect(db.employes[0].mot_de_passe).toBe(convertit ? "" : "Ancien-Mdp-1234");
    });

    it("avec « false » : le compte hérité reste intact après plusieurs connexions, et un mauvais mot de passe reste refusé", async () => {
      regler("false");
      db.employes.push(employe({ mot_de_passe: "Ancien-Mdp-1234" }));
      for (let i = 0; i < 3; i++) expect((await post("/login", { identifiant: "h.test", motDePasse: "Ancien-Mdp-1234" })).status).toBe(200);
      expect((await post("/login", { identifiant: "h.test", motDePasse: "autre-chose-1" })).status).toBe(401);
      expect(db.employes[0]).toMatchObject({ mdp_hash: null, mot_de_passe: "Ancien-Mdp-1234" });
    });

    it("le réglage est lu à chaque connexion (pas au démarrage) : le repasser à autre chose reprend la conversion", async () => {
      regler("false");
      db.employes.push(employe({ mot_de_passe: "Ancien-Mdp-1234" }));
      await post("/login", { identifiant: "h.test", motDePasse: "Ancien-Mdp-1234" });
      expect(db.employes[0].mdp_hash).toBeNull();
      regler(undefined);
      await post("/login", { identifiant: "h.test", motDePasse: "Ancien-Mdp-1234" });
      expect(estHash(db.employes[0].mdp_hash)).toBe(true);
    });

    it("« false » ne suspend PAS l'activation par lien : le compte reçoit une empreinte, que l'ancienne version ne sait pas lire", async () => {
      regler("false");
      db.employes.push(employe({ mot_de_passe: "Ancien-Mdp-1234" }));
      const jeton = await creerJeton("e1", "activation", "Admin");
      expect((await post("/activate", { token: jeton, motDePasse: "Nouveau-Mdp-9012" })).status).toBe(200);
      expect(estHash(db.employes[0].mdp_hash)).toBe(true);
      expect(db.employes[0].mot_de_passe).toBe("");
    });
  });

  it("connecte un compte à empreinte, refuse un mauvais mot de passe, ne renvoie jamais de secret", async () => {
    db.employes.push(employe({ mdp_hash: await hashPassword("Mdp-Solide-5678") }));
    const bon = await post("/login", { identifiant: "H.Test", motDePasse: "Mdp-Solide-5678" });
    expect(bon.status).toBe(200);
    const texte = JSON.stringify(await bon.json());
    expect(texte).not.toContain("Mdp-Solide-5678");
    expect(texte).not.toContain("scrypt$");
    expect((await post("/login", { identifiant: "h.test", motDePasse: "Mdp-Solide-5679" })).status).toBe(401);
  });

  it("répond de la même façon pour un identifiant inconnu, un compte inactif et un compte sans accès activé", async () => {
    db.employes.push(employe({ id: "e2", identifiant: "inactif", statut: "inactif", mdp_hash: await hashPassword("Mdp-Solide-5678") }));
    db.employes.push(employe({ id: "e3", identifiant: "sans.acces" }));
    const reponses = await Promise.all(
      ["inconnu", "inactif", "sans.acces"].map(async (identifiant) => {
        const r = await post("/login", { identifiant, motDePasse: "Mdp-Solide-5678" });
        return [r.status, (await r.json()).error];
      }),
    );
    for (const rep of reponses) expect(rep).toEqual([401, "Identifiant ou mot de passe incorrect"]);
  });

  it("bloque un compte après 8 échecs (429 + Retry-After), même avec le bon mot de passe ensuite", async () => {
    // Empreinte à coût réduit : le test ne vérifie pas la solidité de scrypt (voir passwords.test.js) mais le blocage.
    db.employes.push(employe({ identifiant: "victime", mdp_hash: await hashPassword("Mdp-Solide-5678", { ...PARAMS, N: 2 ** 12 }) }));
    for (let i = 0; i < 8; i++) expect((await post("/login", { identifiant: "victime", motDePasse: `faux-mot-de-passe-${i}` })).status).toBe(401);
    const bloque = await post("/login", { identifiant: "victime", motDePasse: "Mdp-Solide-5678" });
    expect(bloque.status).toBe(429);
    expect(Number(bloque.headers.get("retry-after"))).toBeGreaterThan(0);
  }, 30_000);
});

describe("activation et nouveau mot de passe par lien", () => {
  it("définit le mot de passe, connecte, puis refuse de réutiliser le lien", async () => {
    db.employes.push(employe({ doit_changer_mdp: true }));
    const jeton = await creerJeton("e1", "activation", "Admin");
    const ok = await post("/activate", { token: jeton, motDePasse: "Nouveau-Mdp-9012" });
    expect(ok.status).toBe(200);
    expect((await ok.json()).token).toBe("jeton-e1");
    expect(estHash(db.employes[0].mdp_hash)).toBe(true);
    expect(db.employes[0].doit_changer_mdp).toBe(false);
    expect((await post("/login", { identifiant: "h.test", motDePasse: "Nouveau-Mdp-9012" })).status).toBe(200);
    const reutilise = await post("/activate", { token: jeton, motDePasse: "Autre-Mdp-3456!" });
    expect(reutilise.status).toBe(400);
  });

  it("un mot de passe refusé ne consomme pas le lien", async () => {
    db.employes.push(employe({ doit_changer_mdp: true }));
    const jeton = await creerJeton("e1", "activation");
    expect((await post("/activate", { token: jeton, motDePasse: "court" })).status).toBe(400);
    expect((await post("/activate", { token: jeton, motDePasse: "ici-h.test-ici" })).status).toBe(400);
    expect((await post("/activate", { token: jeton, motDePasse: "Bon-Mdp-7890x" })).status).toBe(200);
  });

  it("refuse un lien expiré, inconnu, ou un compte devenu inactif", async () => {
    db.employes.push(employe({ doit_changer_mdp: true }));
    const jeton = await creerJeton("e1", "activation");
    db.tokens[0].expire = Date.now() - 1000;
    expect((await post("/activate", { token: jeton, motDePasse: "Bon-Mdp-7890x" })).status).toBe(400);
    expect((await post("/activate", { token: "inconnu".repeat(6), motDePasse: "Bon-Mdp-7890x" })).status).toBe(400);
    db.employes[0].statut = "inactif";
    const autre = await creerJeton("e1", "reset");
    expect((await post("/activate", { token: autre, motDePasse: "Bon-Mdp-7890x" })).status).toBe(400);
  });
});

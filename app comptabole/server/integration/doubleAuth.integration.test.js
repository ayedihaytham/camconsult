import { spawnSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import { api, connecterAdmin, creerBaseJetable, demarrerServeur } from "./helpers.js";
import { codeDuPas, pasCourant } from "../totp.js";

/**
 * Double authentification de l'administrateur (TOTP), contre un vrai PostgreSQL jetable (TEST_DATABASE_URL) et le vrai serveur :
 * activation, connexion en deux étapes, anti-rejeu, codes de secours, blocage, désactivation, script de réinitialisation.
 * Ignoré sans TEST_DATABASE_URL.
 */
const actif = Boolean(process.env.TEST_DATABASE_URL);
vi.setConfig({ testTimeout: 180_000, hookTimeout: 90_000 });

const MDP_ADMIN = "Mdp-Admin-De-Test-1!";

describe.skipIf(!actif)("intégration PostgreSQL : double authentification de l'administrateur", () => {
  let base, serveur, admin, sql, secret, codesSecours;
  const sansSession = () => api(serveur.base);
  const login = () => sansSession()("POST", "/api/auth/login", { identifiant: "admin.test", motDePasse: MDP_ADMIN });
  /** Code courant de l'application, décalé de `decalage` pas (les codes déjà utilisés sont refusés : on avance dans le temps). */
  const code = (decalage = 0) => codeDuPas(secret, pasCourant() + decalage);

  beforeAll(async () => {
    base = await creerBaseJetable();
    serveur = await demarrerServeur(base.url);
    admin = await connecterAdmin(serveur.base);
    sql = await base.client();
  });
  afterAll(async () => {
    await sql?.end();
    await serveur?.arreter();
    await base?.supprimer();
  });

  describe("activation", () => {
    it("au départ : inactive, et la connexion ne demande aucun code", async () => {
      expect((await admin("GET", "/api/auth/2fa/statut")).json).toEqual({ actif: false, codesSecoursRestants: 0 });
      const r = await login();
      expect(r.status).toBe(200);
      expect(r.json.token).toBeTruthy();
      expect(r.json.etape).toBeUndefined();
    });

    it("demande le mot de passe avant de montrer le secret ; réservée à l'administrateur", async () => {
      expect((await admin("POST", "/api/auth/2fa/preparer", { motDePasse: "mauvais" })).status).toBe(400);
      expect((await sansSession()("POST", "/api/auth/2fa/preparer", { motDePasse: MDP_ADMIN })).status).toBe(401);
      const e = await admin("POST", "/api/employes", { nom: "Synthetique", prenom: "Test", identifiant: "c.collab", email: "c.collab@example.test", type: "Comptable" });
      const lien = new URL(e.json.lienAcces).searchParams.get("token");
      await sansSession()("POST", "/api/auth/activate", { token: lien, motDePasse: "Mdp-Collab-2fa-12" });
      const c = await sansSession()("POST", "/api/auth/login", { identifiant: "c.collab", motDePasse: "Mdp-Collab-2fa-12" });
      expect((await api(serveur.base, c.json.token)("POST", "/api/auth/2fa/preparer", { motDePasse: "Mdp-Collab-2fa-12" })).status).toBe(403);
      expect((await api(serveur.base, c.json.token)("GET", "/api/auth/2fa/statut")).status).toBe(403);
    });

    it("préparer : un secret et une adresse otpauth ; le secret n'est jamais en clair en base", async () => {
      const r = await admin("POST", "/api/auth/2fa/preparer", { motDePasse: MDP_ADMIN });
      expect(r.status).toBe(200);
      secret = r.json.secret;
      expect(secret).toMatch(/^[A-Z2-7]{32}$/);
      expect(r.json.uri).toContain(`secret=${secret}`);
      expect(r.json.uri.startsWith("otpauth://totp/")).toBe(true);
      const m = (await sql.query("select totp_actif, totp_attente from administrateurs where principal")).rows[0];
      expect(m.totp_actif).toBe(false);
      expect(m.totp_attente.startsWith("v1:")).toBe(true);
      expect(m.totp_attente).not.toContain(secret);
      // tant que le code n'est pas confirmé, la connexion ne demande toujours rien
      expect((await login()).json.etape).toBeUndefined();
    });

    it("activer : un mauvais code est refusé ; le bon active, ferme les autres sessions et donne dix codes de secours une seule fois", async () => {
      expect((await admin("POST", "/api/auth/2fa/activer", { code: "000000" })).status).toBe(400);
      const autreSession = (await login()).json.token;
      const r = await admin("POST", "/api/auth/2fa/activer", { code: code() });
      expect(r.status).toBe(200);
      codesSecours = r.json.codesSecours;
      expect(codesSecours).toHaveLength(10);
      expect(r.json.token).toBeTruthy();
      // les autres sessions sont fermées, celle-ci continue avec le jeton neuf
      expect((await api(serveur.base, autreSession)("GET", "/api/auth/me")).status).toBe(401);
      admin = api(serveur.base, r.json.token);
      expect((await admin("GET", "/api/auth/me")).status).toBe(200);
      expect((await admin("GET", "/api/auth/2fa/statut")).json).toEqual({ actif: true, codesSecoursRestants: 10 });
      // en base : secret chiffré, codes de secours sous forme d'empreinte
      const m = (await sql.query("select totp_secret, codes_secours from administrateurs where principal")).rows[0];
      expect(m.totp_secret).not.toContain(secret);
      for (const c of codesSecours) expect(JSON.stringify(m.codes_secours)).not.toContain(c.replace("-", ""));
      expect(m.codes_secours).toHaveLength(10);
      // déjà active : refuse de recommencer
      expect((await admin("POST", "/api/auth/2fa/preparer", { motDePasse: MDP_ADMIN })).status).toBe(409);
    });
  });

  describe("connexion en deux étapes", () => {
    let pasUtilise = 0;
    /** Code d'un pas jamais utilisé encore (chaque test avance d'un pas : un code ne sert qu'une fois). */
    const codeNeuf = () => {
      pasUtilise += 1;
      return code(Math.min(pasUtilise, 1));
    };

    it("le mot de passe seul ne donne plus de session : un ticket sans droits", async () => {
      const r = await login();
      expect(r.status).toBe(200);
      expect(r.json.etape).toBe("2fa");
      expect(r.json.ticket).toBeTruthy();
      expect(r.json.token).toBeUndefined();
      expect(r.json.session).toBeUndefined();
    });

    it("le ticket n'est JAMAIS une session : refusé par toute route protégée", async () => {
      const { ticket } = (await login()).json;
      for (const chemin of ["/api/auth/me", "/api/societes", "/api/journal", "/api/data/bootstrap"]) {
        expect([chemin, (await api(serveur.base, ticket)("GET", chemin)).status]).toEqual([chemin, 401]);
      }
    });

    it("un mauvais code est refusé (401) ; un ticket expiré ou falsifié aussi", async () => {
      const { ticket } = (await login()).json;
      expect((await sansSession()("POST", "/api/auth/2fa", { ticket, code: "000000" })).status).toBe(401);
      const secretServeur = serveur.env.JWT_SECRET;
      const expire = jwt.sign({ typ: "2fa", iat: Math.floor(Date.now() / 1000) - 600 }, secretServeur, { expiresIn: "5m" });
      const r = await sansSession()("POST", "/api/auth/2fa", { ticket: expire, code: code() });
      expect(r.status).toBe(401);
      expect(r.json.error).toMatch(/expiré/);
      expect((await sansSession()("POST", "/api/auth/2fa", { ticket: "n'importe quoi", code: code() })).status).toBe(401);
      // un jeton de session normal n'est pas un ticket
      const session = jwt.sign({ role: "admin", v: 0 }, secretServeur, { expiresIn: "1h" });
      expect((await sansSession()("POST", "/api/auth/2fa", { ticket: session, code: code() })).status).toBe(401);
    });

    it("le bon code ouvre la session ; le même code ne sert pas deux fois (anti-rejeu)", async () => {
      const bon = codeNeuf();
      const { ticket } = (await login()).json;
      const r = await sansSession()("POST", "/api/auth/2fa", { ticket, code: bon });
      expect(r.status).toBe(200);
      expect(r.json.session.role).toBe("admin");
      expect((await api(serveur.base, r.json.token)("GET", "/api/auth/me")).status).toBe(200);
      const deuxieme = (await login()).json.ticket;
      expect((await sansSession()("POST", "/api/auth/2fa", { ticket: deuxieme, code: bon })).status).toBe(401);
    });

    it("un code de secours ouvre la session une seule fois", async () => {
      const [premier, deuxieme] = codesSecours;
      const t1 = (await login()).json.ticket;
      const r = await sansSession()("POST", "/api/auth/2fa", { ticket: t1, code: premier.toLowerCase() });
      expect(r.status).toBe(200);
      expect((await admin("GET", "/api/auth/2fa/statut")).json.codesSecoursRestants).toBe(9);
      const t2 = (await login()).json.ticket;
      expect((await sansSession()("POST", "/api/auth/2fa", { ticket: t2, code: premier })).status).toBe(401);
      expect((await sansSession()("POST", "/api/auth/2fa", { ticket: t2, code: deuxieme })).status).toBe(200);
      expect((await admin("GET", "/api/auth/2fa/statut")).json.codesSecoursRestants).toBe(8);
    });

    it("deux saisies simultanées du même code de secours : une seule passe", async () => {
      const code9 = codesSecours[2];
      const tickets = await Promise.all([login(), login()]);
      const reponses = await Promise.all(tickets.map((t) => sansSession()("POST", "/api/auth/2fa", { ticket: t.json.ticket, code: code9 })));
      expect(reponses.map((r) => r.status).sort()).toEqual([200, 401]);
    });

    it("sans ticket valide, aucune réponse ne dit si un code aurait été bon", async () => {
      const r = await sansSession()("POST", "/api/auth/2fa", { code: code() });
      expect(r.status).toBe(401);
      expect(r.texte).not.toContain("incorrect");
    });
  });

  describe("blocage des essais de code", () => {
    it("les mauvais codes comptent dans le blocage de l'administrateur : après huit, plus rien ne passe, même le bon code", async () => {
      await sql.query("delete from tentatives_connexion"); // repart de zéro : les essais des tests précédents comptaient aussi
      try {
        const { ticket } = (await login()).json;
        let dernier;
        for (let i = 0; i < 8; i++) dernier = await sansSession()("POST", "/api/auth/2fa", { ticket, code: String(100000 + i) });
        expect(dernier.status).toBe(401);
        const r = await sansSession()("POST", "/api/auth/2fa", { ticket, code: code(1) });
        expect(r.status).toBe(429);
        expect((await login()).status).toBe(429);
      } finally {
        // levé pour la suite des tests, même si une vérification a échoué
        await sql.query("delete from tentatives_connexion");
      }
    });
  });

  describe("gestion", () => {
    it("régénérer les codes de secours exige le mot de passe et un code ; les anciens sont annulés", async () => {
      expect((await admin("POST", "/api/auth/2fa/codes-secours", { motDePasse: "mauvais", code: codesSecours[3] })).status).toBe(400);
      expect((await admin("POST", "/api/auth/2fa/codes-secours", { motDePasse: MDP_ADMIN, code: "000000" })).status).toBe(400);
      const r = await admin("POST", "/api/auth/2fa/codes-secours", { motDePasse: MDP_ADMIN, code: codesSecours[3] });
      expect(r.status).toBe(200);
      expect(r.json.codesSecours).toHaveLength(10);
      const ancien = codesSecours[4];
      codesSecours = r.json.codesSecours;
      const { ticket } = (await login()).json;
      expect((await sansSession()("POST", "/api/auth/2fa", { ticket, code: ancien })).status).toBe(401);
      expect((await sansSession()("POST", "/api/auth/2fa", { ticket, code: codesSecours[0] })).status).toBe(200);
    });

    it("désactiver exige le mot de passe ET un code ; la connexion redevient directe et les autres sessions sont fermées", async () => {
      expect((await admin("POST", "/api/auth/2fa/desactiver", { motDePasse: MDP_ADMIN, code: "000000" })).status).toBe(400);
      expect((await admin("POST", "/api/auth/2fa/desactiver", { motDePasse: "mauvais", code: codesSecours[1] })).status).toBe(400);
      const autre = (await sansSession()("POST", "/api/auth/2fa", { ticket: (await login()).json.ticket, code: codesSecours[2] })).json.token;
      const r = await admin("POST", "/api/auth/2fa/desactiver", { motDePasse: MDP_ADMIN, code: codesSecours[1] });
      expect(r.status).toBe(200);
      expect((await api(serveur.base, autre)("GET", "/api/auth/me")).status).toBe(401);
      admin = api(serveur.base, r.json.token);
      expect((await admin("GET", "/api/auth/2fa/statut")).json.actif).toBe(false);
      const m = (await sql.query("select totp_secret, totp_attente, codes_secours from administrateurs where principal")).rows[0];
      expect(m).toEqual({ totp_secret: null, totp_attente: null, codes_secours: [] });
      expect((await login()).json.etape).toBeUndefined();
    });

    it("le journal garde la trace de l'activation, des connexions et de la désactivation", async () => {
      const journal = (await admin("GET", "/api/journal")).texte;
      expect(journal).toContain("Double authentification activée");
      expect(journal).toContain("double authentification");
      expect(journal).toContain("Double authentification désactivée");
      expect(journal).not.toContain(secret);
    });
  });

  describe("script de réinitialisation (téléphone perdu)", () => {
    const lancer = (...args) =>
      spawnSync(process.execPath, ["server/scripts/reset-2fa-admin.js", ...args], {
        cwd: new URL("../..", import.meta.url),
        env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, DATABASE_URL: base.url, DOTENV_CONFIG_PATH: "aucun-fichier" },
        encoding: "utf-8",
      });
    const cible = () => {
      const u = new URL(base.url);
      return `${u.hostname}:${u.port || 5432}/${u.pathname.slice(1)}`;
    };

    it("simulation : indique l'état sans rien modifier ; refuse d'écrire sans la cible exacte ; réinitialise avec elle", async () => {
      // réactive la 2FA
      secret = (await admin("POST", "/api/auth/2fa/preparer", { motDePasse: MDP_ADMIN })).json.secret;
      const act = await admin("POST", "/api/auth/2fa/activer", { code: code() });
      expect(act.status).toBe(200);
      admin = api(serveur.base, act.json.token);

      const simulation = lancer();
      expect(simulation.status).toBe(0);
      expect(simulation.stdout).toContain("ACTIVE");
      expect(simulation.stdout).toContain("Simulation");
      expect((await sql.query("select totp_actif from administrateurs where principal")).rows[0].totp_actif).toBe(true);

      const refus = lancer("--apply");
      expect(refus.status).toBe(2);
      expect((await sql.query("select totp_actif from administrateurs where principal")).rows[0].totp_actif).toBe(true);

      const ok = lancer("--apply", `--confirmer-cible=${cible()}`);
      expect(ok.status).toBe(0);
      expect(ok.stdout).toContain("désactivée");
      expect((await sql.query("select totp_actif, totp_secret from administrateurs where principal")).rows[0]).toEqual({ totp_actif: false, totp_secret: null });
      // toutes les sessions sont fermées, et la connexion par mot de passe seul refonctionne
      expect((await admin("GET", "/api/auth/me")).status).toBe(401);
      const r = await login();
      expect(r.status).toBe(200);
      expect(r.json.token).toBeTruthy();
    });
  });
});

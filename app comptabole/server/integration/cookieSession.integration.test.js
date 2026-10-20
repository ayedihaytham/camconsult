import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import { connecterAdmin, creerBaseJetable, demarrerServeur } from "./helpers.js";
import { codeDuPas, pasCourant } from "../totp.js";

/**
 * Jeton de session dans un cookie HttpOnly, contre un vrai PostgreSQL jetable (TEST_DATABASE_URL) et le vrai serveur : le navigateur envoie
 * « X-Session-Mode: cookie », reçoit le jeton dans un cookie que le JavaScript ne lit pas, et jamais dans le corps. Les clients sans cet en-tête
 * (tests, outils) gardent le fonctionnement par « Authorization: Bearer ». Ignoré sans TEST_DATABASE_URL.
 */
const actif = Boolean(process.env.TEST_DATABASE_URL);
vi.setConfig({ testTimeout: 180_000, hookTimeout: 90_000 });

describe.skipIf(!actif)("intégration PostgreSQL : session par cookie HttpOnly", () => {
  let base, serveur, admin, sql;
  const MDP = "Mdp-Cookie-Test-58";
  const jetonDe = (lien) => new URL(lien).searchParams.get("token");

  /** Client « navigateur » : garde le cookie de session reçu (pot à cookies) et envoie les en-têtes du front. */
  function navigateur({ csrf = true, mode = true, entetes = {} } = {}) {
    let cookie = null;
    const appel = async (methode, chemin, corps, extra = {}) => {
      const r = await fetch(`${serveur.base}${chemin}`, {
        method: methode,
        headers: {
          "Content-Type": "application/json",
          ...(mode ? { "X-Session-Mode": "cookie" } : {}),
          ...(csrf ? { "X-Requested-With": "cabinet" } : {}),
          ...(cookie ? { Cookie: `cabinet_session=${cookie}` } : {}),
          ...entetes,
          ...extra,
        },
        body: corps === undefined ? undefined : JSON.stringify(corps),
      });
      const posés = r.headers.getSetCookie?.() ?? [];
      const ligne = posés.find((c) => c.startsWith("cabinet_session="));
      if (ligne) {
        const valeur = decodeURIComponent(ligne.split(";")[0].slice("cabinet_session=".length));
        cookie = valeur === "" ? null : valeur;
      }
      const texte = await r.text();
      let json = null;
      try {
        json = JSON.parse(texte);
      } catch {
        /* non JSON */
      }
      return { status: r.status, json, texte, entetes: r.headers, setCookie: ligne ?? null };
    };
    return { appel, cookie: () => cookie, fixer: (c) => (cookie = c) };
  }
  async function compte() {
    const n = Math.random().toString(36).slice(2, 8);
    const identifiant = `k.${n}`;
    const r = await admin("POST", "/api/employes", { nom: "Synthetique", prenom: "Test", identifiant, email: `${identifiant}@example.test`, type: "Comptable", role: "collaborateur" });
    expect(r.status).toBe(201);
    await fetch(`${serveur.base}/api/auth/activate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: jetonDe(r.json.lienAcces), motDePasse: MDP }) });
    await sql.query("delete from sessions_connexion where compte = $1", [String(r.json.id)]); // l'activation ouvre une session : liste propre
    return { identifiant, id: r.json.id };
  }

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

  describe("connexion", () => {
    it("le jeton arrive dans un cookie HttpOnly, SameSite=Strict, limité à /api, et JAMAIS dans le corps", async () => {
      const c = await compte();
      const nav = navigateur();
      const r = await nav.appel("POST", "/api/auth/login", { identifiant: c.identifiant, motDePasse: MDP });
      expect(r.status).toBe(200);
      expect(r.json.token).toBeUndefined();
      expect(r.json.session.role).toBe("employe");
      expect(r.setCookie).toMatch(/^cabinet_session=[^;]+;/);
      expect(r.setCookie).toContain("HttpOnly");
      expect(r.setCookie).toContain("SameSite=Strict");
      expect(r.setCookie).toContain("Path=/api");
      expect(r.setCookie).toContain("Max-Age=43200");
      // le jeton n'apparaît nulle part dans le corps de la réponse
      expect(r.texte).not.toContain(nav.cookie());
      expect(jwt.decode(nav.cookie())).toMatchObject({ role: "employe", employeId: c.id });
    });

    it("« Secure » n'est posé que pour une requête reçue en HTTPS (X-Forwarded-Proto transmis par nginx)", async () => {
      const c = await compte();
      const http = await navigateur().appel("POST", "/api/auth/login", { identifiant: c.identifiant, motDePasse: MDP });
      expect(http.setCookie).not.toContain("Secure");
      const https = await navigateur({ entetes: { "X-Forwarded-Proto": "https" } }).appel("POST", "/api/auth/login", { identifiant: c.identifiant, motDePasse: MDP });
      expect(https.setCookie).toContain("Secure");
    });

    it("sans l'en-tête de mode, rien ne change : jeton dans le corps, aucun cookie (outils, tests, API hébergée ailleurs)", async () => {
      const c = await compte();
      const nav = navigateur({ mode: false, csrf: false });
      const r = await nav.appel("POST", "/api/auth/login", { identifiant: c.identifiant, motDePasse: MDP });
      expect(r.json.token).toBeTruthy();
      expect(r.setCookie).toBeNull();
      const me = await nav.appel("GET", "/api/auth/me", undefined, { Authorization: `Bearer ${r.json.token}` });
      expect(me.status).toBe(200);
    });

    it("un mauvais mot de passe ne pose aucun cookie", async () => {
      const c = await compte();
      const r = await navigateur().appel("POST", "/api/auth/login", { identifiant: c.identifiant, motDePasse: "mauvais" });
      expect(r.status).toBe(401);
      expect(r.setCookie).toBeNull();
    });
  });

  describe("utilisation du cookie", () => {
    it("le cookie authentifie les requêtes (lecture et écriture), sans en-tête Authorization", async () => {
      const c = await compte();
      const nav = navigateur();
      await nav.appel("POST", "/api/auth/login", { identifiant: c.identifiant, motDePasse: MDP });
      expect((await nav.appel("GET", "/api/auth/me")).json.session.nom).toContain("Test");
      expect((await nav.appel("GET", "/api/societes")).status).toBe(200);
      expect((await nav.appel("POST", "/api/auth/deconnecter-autres", {})).status).toBe(200);
    });

    it("sans cookie ni en-tête : 401 ; cookie falsifié, expiré ou d'un autre secret : 401", async () => {
      const nav = navigateur();
      expect((await nav.appel("GET", "/api/auth/me")).status).toBe(401);
      for (const faux of ["n-importe-quoi", jwt.sign({ role: "admin" }, "un-autre-secret-de-plus-de-24-caracteres", { expiresIn: "1h" }), jwt.sign({ role: "admin" }, serveur.env.JWT_SECRET, { expiresIn: -10 })]) {
        nav.fixer(faux);
        expect([faux.slice(0, 12), (await nav.appel("GET", "/api/auth/me")).status]).toEqual([faux.slice(0, 12), 401]);
      }
    });

    it("protection CSRF : une écriture authentifiée par cookie exige l'en-tête de l'application ; la lecture, non", async () => {
      const c = await compte();
      const nav = navigateur();
      await nav.appel("POST", "/api/auth/login", { identifiant: c.identifiant, motDePasse: MDP });
      const pirate = navigateur({ csrf: false });
      pirate.fixer(nav.cookie());
      expect((await pirate.appel("GET", "/api/auth/me")).status).toBe(200);
      const ecriture = await pirate.appel("POST", "/api/auth/deconnecter-autres", {});
      expect(ecriture.status).toBe(403);
      expect(ecriture.json.error).toMatch(/refusée/);
      // une valeur quelconque n'ouvre pas non plus
      expect((await pirate.appel("POST", "/api/auth/deconnecter-autres", {}, { "X-Requested-With": "XMLHttpRequest" })).status).toBe(403);
      // la session n'a pas été touchée par les tentatives refusées
      expect((await nav.appel("GET", "/api/auth/me")).status).toBe(200);
    });

    it("l'exigence CSRF ne vise que le cookie : avec « Authorization: Bearer », aucune restriction", async () => {
      const c = await compte();
      const connexion = await navigateur({ mode: false, csrf: false }).appel("POST", "/api/auth/login", { identifiant: c.identifiant, motDePasse: MDP });
      const outil = navigateur({ mode: false, csrf: false });
      const r = await outil.appel("POST", "/api/auth/deconnecter-autres", {}, { Authorization: `Bearer ${connexion.json.token}` });
      expect(r.status).toBe(200);
    });

    it("l'en-tête Authorization l'emporte sur le cookie", async () => {
      const c = await compte();
      const nav = navigateur();
      await nav.appel("POST", "/api/auth/login", { identifiant: c.identifiant, motDePasse: MDP });
      const r = await nav.appel("GET", "/api/auth/me", undefined, { Authorization: "Bearer pas-un-jeton" });
      expect(r.status).toBe(401);
    });
  });

  describe("renouvellement, migration, déconnexion", () => {
    it("session active : le renouvellement passe par un nouveau cookie, sans en-tête lisible par le JavaScript", async () => {
      const c = await compte();
      const nav = navigateur();
      await nav.appel("POST", "/api/auth/login", { identifiant: c.identifiant, motDePasse: MDP });
      const d = jwt.decode(nav.cookie());
      nav.fixer(jwt.sign({ role: "employe", employeId: c.id, v: d.v, sid: d.sid, iat: Math.floor(Date.now() / 1000) - 4 * 3600 }, serveur.env.JWT_SECRET, { expiresIn: "12h" }));
      const r = await nav.appel("GET", "/api/auth/me");
      expect(r.status).toBe(200);
      expect(r.entetes.get("x-token-renouvele")).toBeNull();
      expect(r.setCookie).toContain("HttpOnly");
      expect(jwt.decode(nav.cookie()).sid).toBe(d.sid); // même session, jeton neuf
      expect(jwt.decode(nav.cookie()).exp - jwt.decode(nav.cookie()).iat).toBe(12 * 3600);
    });

    it("migration : un navigateur qui arrive avec son ancien jeton (stockage local) reçoit son cookie, sans se reconnecter", async () => {
      const c = await compte();
      const ancien = (await navigateur({ mode: false, csrf: false }).appel("POST", "/api/auth/login", { identifiant: c.identifiant, motDePasse: MDP })).json.token;
      const nav = navigateur();
      const r = await nav.appel("GET", "/api/auth/me", undefined, { Authorization: `Bearer ${ancien}` });
      expect(r.status).toBe(200);
      expect(r.setCookie).toContain("HttpOnly");
      expect(nav.cookie()).toBe(ancien);
      // désormais le cookie suffit
      const seul = navigateur();
      seul.fixer(nav.cookie());
      expect((await seul.appel("GET", "/api/auth/me")).status).toBe(200);
    });

    it("« Se déconnecter » efface le cookie et ferme la session : l'ancien cookie est refusé", async () => {
      const c = await compte();
      const nav = navigateur();
      await nav.appel("POST", "/api/auth/login", { identifiant: c.identifiant, motDePasse: MDP });
      const ancien = nav.cookie();
      const r = await nav.appel("POST", "/api/auth/logout", {});
      expect(r.status).toBe(200);
      expect(r.setCookie).toContain("Max-Age=0");
      expect(nav.cookie()).toBeNull();
      const rejeu = navigateur();
      rejeu.fixer(ancien);
      expect((await rejeu.appel("GET", "/api/auth/me")).status).toBe(401);
    });

    it("changer son mot de passe garde le navigateur connecté (nouveau cookie) et ferme les autres appareils", async () => {
      const c = await compte();
      const pc = navigateur();
      const tel = navigateur();
      await pc.appel("POST", "/api/auth/login", { identifiant: c.identifiant, motDePasse: MDP });
      await tel.appel("POST", "/api/auth/login", { identifiant: c.identifiant, motDePasse: MDP });
      await sql.query("update employes set doit_changer_mdp = false where id = $1", [c.id]);
      const ancienPc = pc.cookie();
      const r = await pc.appel("POST", "/api/auth/change-password", { motDePasse: "Nouveau-Mdp-Cookie-81" });
      expect(r.status).toBe(200);
      expect(r.json.token).toBeUndefined();
      expect(pc.cookie()).not.toBe(ancienPc);
      expect((await pc.appel("GET", "/api/auth/me")).status).toBe(200);
      expect((await tel.appel("GET", "/api/auth/me")).status).toBe(401);
    });

    it("la liste des appareils fonctionne par cookie, et fermer un autre appareil le déconnecte", async () => {
      const c = await compte();
      const pc = navigateur();
      const tel = navigateur();
      await pc.appel("POST", "/api/auth/login", { identifiant: c.identifiant, motDePasse: MDP });
      await tel.appel("POST", "/api/auth/login", { identifiant: c.identifiant, motDePasse: MDP });
      const liste = (await pc.appel("GET", "/api/auth/sessions")).json;
      expect(liste).toHaveLength(2);
      const autre = liste.find((s) => !s.courante).id;
      expect((await pc.appel("POST", `/api/auth/sessions/${autre}/revoquer`, {})).status).toBe(200);
      expect((await tel.appel("GET", "/api/auth/me")).status).toBe(401);
    });
  });

  describe("administrateur avec double authentification", () => {
    it("les deux étapes passent par le cookie : le mot de passe n'en pose aucun, le code oui, sans jeton dans le corps", async () => {
      // active la 2FA (jeton Bearer de l'administrateur)
      const secret = (await admin("POST", "/api/auth/2fa/preparer", { motDePasse: "Mdp-Admin-De-Test-1!" })).json.secret;
      const act = await admin("POST", "/api/auth/2fa/activer", { code: codeDuPas(secret, pasCourant()) });
      expect(act.status).toBe(200);

      const nav = navigateur();
      const etape1 = await nav.appel("POST", "/api/auth/login", { identifiant: "admin.test", motDePasse: "Mdp-Admin-De-Test-1!" });
      expect(etape1.json.etape).toBe("2fa");
      expect(etape1.setCookie).toBeNull(); // pas de cookie de session avant le code
      expect((await nav.appel("GET", "/api/auth/me")).status).toBe(401);

      const etape2 = await nav.appel("POST", "/api/auth/2fa", { ticket: etape1.json.ticket, code: codeDuPas(secret, pasCourant() + 1) });
      expect(etape2.status).toBe(200);
      expect(etape2.json.token).toBeUndefined();
      expect(etape2.setCookie).toContain("HttpOnly");
      expect((await nav.appel("GET", "/api/auth/me")).json.session.role).toBe("admin");
    });
  });
});

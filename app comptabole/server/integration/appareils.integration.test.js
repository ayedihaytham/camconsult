import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import { api, connecterAdmin, creerBaseJetable, demarrerServeur } from "./helpers.js";

/**
 * Appareils connectés : liste des sessions du compte et révocation d'UNE session, contre un vrai PostgreSQL jetable (TEST_DATABASE_URL) et
 * le vrai serveur. Ignoré sans cette variable.
 */
const actif = Boolean(process.env.TEST_DATABASE_URL);
vi.setConfig({ testTimeout: 180_000, hookTimeout: 90_000 });

const CHROME_WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const SAFARI_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

describe.skipIf(!actif)("intégration PostgreSQL : appareils connectés", () => {
  let base, serveur, admin, sql;
  const MDP = "Mdp-Appareils-Test-27";
  const jetonDe = (lien) => new URL(lien).searchParams.get("token");

  /** Appel API avec un navigateur donné (en-tête User-Agent). */
  const appel = (jeton, ua) => async (methode, chemin, corps) => {
    const r = await fetch(`${serveur.base}${chemin}`, {
      method: methode,
      headers: { "Content-Type": "application/json", "User-Agent": ua, ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}) },
      body: corps === undefined ? undefined : JSON.stringify(corps),
    });
    const texte = await r.text();
    let json = null;
    try {
      json = JSON.parse(texte);
    } catch {
      /* non JSON */
    }
    return { status: r.status, json, texte, entetes: r.headers };
  };
  async function connexion(identifiant, motDePasse, ua) {
    const r = await appel(null, ua)("POST", "/api/auth/login", { identifiant, motDePasse });
    expect(r.status).toBe(200);
    return { jeton: r.json.token, api: appel(r.json.token, ua) };
  }
  async function compte(extra = {}) {
    const n = Math.random().toString(36).slice(2, 8);
    const identifiant = `a.${n}`;
    const r = await admin("POST", "/api/employes", { nom: "Synthetique", prenom: "Test", identifiant, email: `${identifiant}@example.test`, type: "Comptable", role: "collaborateur", ...extra });
    expect(r.status).toBe(201);
    await api(serveur.base)("POST", "/api/auth/activate", { token: jetonDe(r.json.lienAcces), motDePasse: MDP });
    // l'activation ouvre elle-même une session (son jeton n'est pas utilisé ici) : on part d'une liste vide
    await sql.query("delete from sessions_connexion where compte = $1", [String(r.json.id)]);
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

  it("chaque connexion ouvre une session ; la liste dit l'appareil, l'adresse, les dates, et marque la courante", async () => {
    const c = await compte();
    const pc = await connexion(c.identifiant, MDP, CHROME_WINDOWS);
    const tel = await connexion(c.identifiant, MDP, SAFARI_IPHONE);
    const liste = (await pc.api("GET", "/api/auth/sessions")).json;
    expect(liste).toHaveLength(2);
    expect(liste.filter((s) => s.courante)).toHaveLength(1);
    expect(liste.find((s) => s.courante).appareil).toBe("Chrome / Brave sur Windows");
    expect(liste.find((s) => !s.courante).appareil).toBe("Safari sur iPhone");
    for (const s of liste) {
      expect(s.adresse).toBeTruthy();
      expect(new Date(s.creeLe).getTime()).toBeLessThanOrEqual(Date.now());
      expect(new Date(s.expireLe).getTime()).toBeGreaterThan(Date.now());
    }
    // vue depuis le téléphone : la courante est l'autre
    const vueTel = (await tel.api("GET", "/api/auth/sessions")).json;
    expect(vueTel.find((s) => s.courante).appareil).toBe("Safari sur iPhone");
  });

  it("révoquer UNE session : cet appareil est refusé aussitôt, les autres continuent", async () => {
    const c = await compte();
    const pc = await connexion(c.identifiant, MDP, CHROME_WINDOWS);
    const tel = await connexion(c.identifiant, MDP, SAFARI_IPHONE);
    const autre = await connexion(c.identifiant, MDP, CHROME_WINDOWS);
    const sidTel = (await pc.api("GET", "/api/auth/sessions")).json.find((s) => s.appareil === "Safari sur iPhone").id;
    const r = await pc.api("POST", `/api/auth/sessions/${sidTel}/revoquer`, {});
    expect(r.status).toBe(200);
    const refus = await tel.api("GET", "/api/auth/me");
    expect(refus.status).toBe(401);
    expect(refus.json.error).toMatch(/session a été fermée/);
    expect((await pc.api("GET", "/api/auth/me")).status).toBe(200);
    expect((await autre.api("GET", "/api/auth/me")).status).toBe(200);
    expect((await pc.api("GET", "/api/auth/sessions")).json).toHaveLength(2);
    // une session déjà révoquée : introuvable ; la sienne : à fermer par « Se déconnecter »
    expect((await pc.api("POST", `/api/auth/sessions/${sidTel}/revoquer`, {})).status).toBe(404);
    const sidCourante = (await pc.api("GET", "/api/auth/sessions")).json.find((s) => s.courante).id;
    expect((await pc.api("POST", `/api/auth/sessions/${sidCourante}/revoquer`, {})).status).toBe(400);
    expect((await pc.api("POST", "/api/auth/sessions/pas-un-identifiant/revoquer", {})).status).toBe(400);
  });

  it("un compte ne voit ni ne révoque les sessions d'un autre compte", async () => {
    const a = await compte();
    const b = await compte();
    const sa = await connexion(a.identifiant, MDP, CHROME_WINDOWS);
    const sb = await connexion(b.identifiant, MDP, CHROME_WINDOWS);
    const sidA = (await sa.api("GET", "/api/auth/sessions")).json[0].id;
    expect((await sb.api("GET", "/api/auth/sessions")).texte).not.toContain(sidA);
    expect((await sb.api("POST", `/api/auth/sessions/${sidA}/revoquer`, {})).status).toBe(404);
    expect((await sa.api("GET", "/api/auth/me")).status).toBe(200);
  });

  it("« Se déconnecter » ferme la session : le jeton est refusé et la ligne disparaît de la liste", async () => {
    const c = await compte();
    const pc = await connexion(c.identifiant, MDP, CHROME_WINDOWS);
    const tel = await connexion(c.identifiant, MDP, SAFARI_IPHONE);
    expect((await pc.api("POST", "/api/auth/logout", {})).status).toBe(200);
    expect((await pc.api("GET", "/api/auth/me")).status).toBe(401);
    expect((await tel.api("GET", "/api/auth/sessions")).json).toHaveLength(1);
  });

  it("« Déconnecter mes autres appareils » et un changement de mot de passe ne laissent que la session courante dans la liste", async () => {
    const c = await compte();
    const pc = await connexion(c.identifiant, MDP, CHROME_WINDOWS);
    await connexion(c.identifiant, MDP, SAFARI_IPHONE);
    const r = await pc.api("POST", "/api/auth/deconnecter-autres", {});
    expect(r.status).toBe(200);
    const apres = appel(r.json.token, CHROME_WINDOWS);
    const liste = (await apres("GET", "/api/auth/sessions")).json;
    expect(liste).toHaveLength(1);
    expect(liste[0].courante).toBe(true);
    expect((await pc.api("GET", "/api/auth/me")).status).toBe(401);
  });

  it("une session expirée (date dépassée) est refusée et n'est plus listée", async () => {
    const c = await compte();
    const pc = await connexion(c.identifiant, MDP, CHROME_WINDOWS);
    await sql.query("update sessions_connexion set expire_le = now() - interval '1 minute' where compte = $1", [c.id]);
    expect((await pc.api("GET", "/api/auth/me")).status).toBe(401);
    const neuve = await connexion(c.identifiant, MDP, CHROME_WINDOWS);
    expect((await neuve.api("GET", "/api/auth/sessions")).json).toHaveLength(1);
  });

  it("la dernière activité est rafraîchie (de temps en temps) quand l'appareil s'en sert", async () => {
    const c = await compte();
    const pc = await connexion(c.identifiant, MDP, CHROME_WINDOWS);
    await sql.query("update sessions_connexion set derniere_activite = now() - interval '1 hour' where compte = $1", [c.id]);
    await pc.api("GET", "/api/auth/me");
    await vi.waitFor(async () => {
      const r = await sql.query("select extract(epoch from (now() - derniere_activite)) as s from sessions_connexion where compte = $1", [c.id]);
      expect(Number(r.rows[0].s)).toBeLessThan(60);
    });
  });

  it("un jeton émis avant la liste (sans identifiant de session) reste valable, et rejoint la liste à son renouvellement", async () => {
    const c = await compte();
    const pc = await connexion(c.identifiant, MDP, CHROME_WINDOWS);
    const v = jwt.decode(pc.jeton).v;
    const ancien = jwt.sign({ role: "employe", employeId: c.id, v, iat: Math.floor(Date.now() / 1000) - 4 * 3600 }, serveur.env.JWT_SECRET, { expiresIn: "12h" });
    const r = await appel(ancien, CHROME_WINDOWS)("GET", "/api/auth/me");
    expect(r.status).toBe(200);
    const neuf = r.entetes.get("x-token-renouvele");
    expect(jwt.decode(neuf).sid).toBeTruthy();
    const liste = (await appel(neuf, CHROME_WINDOWS)("GET", "/api/auth/sessions")).json;
    expect(liste.some((s) => s.courante)).toBe(true);
  });

  it("le renouvellement d'un jeton garde la même session (pas de ligne en double)", async () => {
    const c = await compte();
    const pc = await connexion(c.identifiant, MDP, CHROME_WINDOWS);
    const d = jwt.decode(pc.jeton);
    const vieux = jwt.sign({ role: "employe", employeId: c.id, v: d.v, sid: d.sid, iat: Math.floor(Date.now() / 1000) - 4 * 3600 }, serveur.env.JWT_SECRET, { expiresIn: "12h" });
    const r = await appel(vieux, CHROME_WINDOWS)("GET", "/api/auth/me");
    expect(jwt.decode(r.entetes.get("x-token-renouvele")).sid).toBe(d.sid);
    expect((await pc.api("GET", "/api/auth/sessions")).json).toHaveLength(1);
  });

  describe("l'administrateur et les sessions d'un employé", () => {
    it("il voit les appareils connectés d'un employé et en ferme un", async () => {
      const c = await compte();
      const pc = await connexion(c.identifiant, MDP, CHROME_WINDOWS);
      const tel = await connexion(c.identifiant, MDP, SAFARI_IPHONE);
      const liste = await admin("GET", `/api/employes/${c.id}/sessions`);
      expect(liste.status).toBe(200);
      expect(liste.json).toHaveLength(2);
      const sidTel = liste.json.find((s) => s.appareil === "Safari sur iPhone").id;
      expect((await admin("POST", `/api/employes/${c.id}/sessions/${sidTel}/revoquer`, {})).status).toBe(200);
      expect((await tel.api("GET", "/api/auth/me")).status).toBe(401);
      expect((await pc.api("GET", "/api/auth/me")).status).toBe(200);
      expect((await admin("POST", `/api/employes/${c.id}/sessions/${sidTel}/revoquer`, {})).status).toBe(404);
    });

    it("« tout fermer » déconnecte toutes ses sessions", async () => {
      const c = await compte();
      const a = await connexion(c.identifiant, MDP, CHROME_WINDOWS);
      const b = await connexion(c.identifiant, MDP, SAFARI_IPHONE);
      const r = await admin("POST", `/api/employes/${c.id}/sessions/revoquer-toutes`, {});
      expect(r.status).toBe(200);
      expect(r.json.revoquees).toBe(2);
      expect((await a.api("GET", "/api/auth/me")).status).toBe(401);
      expect((await b.api("GET", "/api/auth/me")).status).toBe(401);
      // le compte n'est pas désactivé : une nouvelle connexion fonctionne
      expect((await connexion(c.identifiant, MDP, CHROME_WINDOWS)).jeton).toBeTruthy();
    });

    it("réservé à l'administrateur ; compte inconnu : 404 ; la session d'un compte ne passe pas pour celle d'un autre", async () => {
      const c = await compte();
      const d = await compte();
      const sc = await connexion(c.identifiant, MDP, CHROME_WINDOWS);
      const sd = await connexion(d.identifiant, MDP, CHROME_WINDOWS);
      expect((await sd.api("GET", `/api/employes/${c.id}/sessions`)).status).toBe(403);
      expect((await sd.api("POST", `/api/employes/${c.id}/sessions/revoquer-toutes`, {})).status).toBe(403);
      expect((await admin("GET", "/api/employes/00000000-0000-0000-0000-000000000000/sessions")).status).toBe(404);
      const sidD = (await sd.api("GET", "/api/auth/sessions")).json[0].id;
      expect((await admin("POST", `/api/employes/${c.id}/sessions/${sidD}/revoquer`, {})).status).toBe(404);
      expect((await sd.api("GET", "/api/auth/me")).status).toBe(200);
      expect((await sc.api("GET", "/api/auth/me")).status).toBe(200);
    });
  });

  it("l'administrateur a ses propres appareils, séparés de ceux des employés", async () => {
    const c = await compte();
    await connexion(c.identifiant, MDP, CHROME_WINDOWS);
    const a1 = await connexion("admin.test", "Mdp-Admin-De-Test-1!", CHROME_WINDOWS);
    const liste = (await a1.api("GET", "/api/auth/sessions")).json;
    expect(liste.length).toBeGreaterThanOrEqual(1);
    expect((await sql.query("select count(*)::int n from sessions_connexion where compte = 'admin'")).rows[0].n).toBe(liste.length);
    expect((await a1.api("GET", "/api/auth/me")).json.session.role).toBe("admin");
  });
});

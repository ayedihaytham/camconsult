import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import { connecterAdmin, creerBaseJetable, demarrerServeur } from "./helpers.js";
import { codeDuPas, pasCourant } from "../totp.js";

/**
 * Plusieurs administrateurs, contre un vrai PostgreSQL jetable (TEST_DATABASE_URL) et le vrai serveur : migration du compte historique en
 * administrateur principal, création par un autre administrateur (mot de passe provisoire), sessions et double authentification séparées,
 * protection du principal, désactivation immédiate. Ignoré sans TEST_DATABASE_URL.
 */
const actif = Boolean(process.env.TEST_DATABASE_URL);
vi.setConfig({ testTimeout: 180_000, hookTimeout: 90_000 });

describe.skipIf(!actif)("intégration PostgreSQL : plusieurs administrateurs", () => {
  let base, serveur, principal, sql;
  const MDP_PRINCIPAL = "Mdp-Admin-De-Test-1!";
  const NOUVEAU = "Nouveau-Mdp-Admin-77";

  const appel = async (jeton, methode, chemin, corps) => {
    const r = await fetch(`${serveur.base}${chemin}`, {
      method: methode,
      headers: { "Content-Type": "application/json", ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}) },
      body: corps === undefined ? undefined : JSON.stringify(corps),
    });
    const texte = await r.text();
    let json = null;
    try {
      json = JSON.parse(texte);
    } catch {
      /* non JSON */
    }
    return { status: r.status, json, texte };
  };
  const connexion = (identifiant, motDePasse) => appel(null, "POST", "/api/auth/login", { identifiant, motDePasse });
  let compteur = 0;
  /** Crée un administrateur (par le principal) et le fait passer par la première connexion : renvoie son jeton définitif. */
  async function nouvelAdmin() {
    const identifiant = `adm.${Date.now().toString(36)}${compteur++}`;
    const c = await principal("POST", "/api/administrateurs", { nom: "Second Admin", fonction: "Associé", identifiant, motDePasse: MDP_PRINCIPAL });
    expect(c.status).toBe(201);
    const l = await connexion(identifiant, c.json.motDePasseProvisoire);
    const ch = await appel(l.json.token, "POST", "/api/auth/change-password", { motDePasse: NOUVEAU });
    expect(ch.status).toBe(200);
    return { id: c.json.id, identifiant, jeton: ch.json.token, provisoire: c.json.motDePasseProvisoire };
  }

  beforeAll(async () => {
    base = await creerBaseJetable();
    serveur = await demarrerServeur(base.url);
    principal = await connecterAdmin(serveur.base);
    sql = await base.client();
  });
  afterAll(async () => {
    await sql?.end();
    await serveur?.arreter();
    await base?.supprimer();
  });

  describe("administrateur principal (migration du compte historique)", () => {
    it("le compte historique est l'administrateur principal, seul de son espèce", async () => {
      const liste = (await principal("GET", "/api/administrateurs")).json;
      const p = liste.find((a) => a.principal);
      expect(p).toMatchObject({ identifiant: "admin.test", statut: "actif", moi: true });
      expect(liste.filter((a) => a.principal)).toHaveLength(1);
      expect((await sql.query("select count(*)::int n from administrateurs where principal")).rows[0].n).toBe(1);
    });

    it("un jeton émis avant les comptes multiples (sans adminId) reste celui du principal", async () => {
      const id = (await sql.query("select id, session_version from administrateurs where principal")).rows[0];
      const ancien = jwt.sign({ role: "admin", v: id.session_version }, serveur.env.JWT_SECRET, { expiresIn: "1h" });
      const me = await appel(ancien, "GET", "/api/auth/me");
      expect(me.status).toBe(200);
      expect(me.json.session).toMatchObject({ role: "admin", principal: true, adminId: id.id });
    });
  });

  describe("création par un autre administrateur", () => {
    it("exige le mot de passe de celui qui agit ; donne un mot de passe provisoire montré une seule fois, jamais relu", async () => {
      const refus = await principal("POST", "/api/administrateurs", { nom: "Mal Confirmé", identifiant: "mal.confirme", motDePasse: "faux" });
      expect(refus.status).toBe(400);
      const ok = await principal("POST", "/api/administrateurs", { nom: "Karim Trabelsi", fonction: "Expert-comptable", identifiant: "karim.t", motDePasse: MDP_PRINCIPAL });
      expect(ok.status).toBe(201);
      expect(ok.json.motDePasseProvisoire).toMatch(/^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/);
      expect(ok.json).toMatchObject({ identifiant: "karim.t", principal: false, doitChangerMotDePasse: true, statut: "actif" });
      const liste = await principal("GET", "/api/administrateurs");
      expect(liste.texte).not.toContain(ok.json.motDePasseProvisoire);
      expect(liste.texte).not.toMatch(/mdp_hash|scrypt\$/);
      expect((await sql.query("select mdp_hash from administrateurs where identifiant = 'karim.t'")).rows[0].mdp_hash).not.toContain(ok.json.motDePasseProvisoire);
    });

    it("identifiant déjà pris par un administrateur ou un employé : refusé ; et réciproquement pour un employé", async () => {
      expect((await principal("POST", "/api/administrateurs", { nom: "Doublon Admin", identifiant: "KARIM.T", motDePasse: MDP_PRINCIPAL })).status).toBe(409);
      const e = await principal("POST", "/api/employes", { nom: "Synthetique", prenom: "Emp", identifiant: "emp.collision", email: "emp.collision@example.test", type: "Comptable", role: "collaborateur" });
      expect(e.status).toBe(201);
      expect((await principal("POST", "/api/administrateurs", { nom: "Doublon Employé", identifiant: "emp.collision", motDePasse: MDP_PRINCIPAL })).status).toBe(409);
      const inverse = await principal("POST", "/api/employes", { nom: "Autre", prenom: "Emp", identifiant: "karim.t", email: "autre@example.test", type: "Comptable", role: "collaborateur" });
      expect(inverse.status).toBe(409);
    });

    it("un employé ne gère pas les administrateurs", async () => {
      const identifiant = "emp.sans.droit";
      const c = await principal("POST", "/api/employes", { nom: "Synthetique", prenom: "Emp", identifiant, email: "sd@example.test", type: "Comptable", role: "collaborateur" });
      const jeton = new URL(c.json.lienAcces).searchParams.get("token");
      const act = await appel(null, "POST", "/api/auth/activate", { token: jeton, motDePasse: "Mdp-Employe-Test-12" });
      expect((await appel(act.json.token, "GET", "/api/administrateurs")).status).toBe(403);
      expect((await appel(act.json.token, "POST", "/api/administrateurs", { nom: "Pirate", identifiant: "pirate.x", motDePasse: "x" })).status).toBe(403);
      expect((await appel(null, "GET", "/api/administrateurs")).status).toBe(401);
    });
  });

  describe("première connexion et sessions séparées", () => {
    it("le mot de passe provisoire n'ouvre que le choix du mot de passe, puis donne les droits d'administrateur", async () => {
      const c = await principal("POST", "/api/administrateurs", { nom: "Première Connexion", identifiant: "premiere.co", motDePasse: MDP_PRINCIPAL });
      const l = await connexion("premiere.co", c.json.motDePasseProvisoire);
      expect(l.status).toBe(200);
      expect(l.json.session).toMatchObject({ role: "admin", principal: false, doitChangerMotDePasse: true });
      expect((await appel(l.json.token, "GET", "/api/societes")).json.code).toBe("CHANGER_MOT_DE_PASSE");
      expect((await appel(l.json.token, "GET", "/api/administrateurs")).status).toBe(403);
      const faible = await appel(l.json.token, "POST", "/api/auth/change-password", { motDePasse: "court" });
      expect(faible.status).toBe(400);
      const ch = await appel(l.json.token, "POST", "/api/auth/change-password", { motDePasse: NOUVEAU });
      expect(ch.status).toBe(200);
      expect(ch.json.session.doitChangerMotDePasse).toBe(false);
      expect((await appel(ch.json.token, "GET", "/api/societes")).status).toBe(200);
      expect((await appel(ch.json.token, "GET", "/api/administrateurs")).status).toBe(200);
      // l'ancien mot de passe provisoire ne sert plus ; le nouveau, oui
      expect((await connexion("premiere.co", c.json.motDePasseProvisoire)).status).toBe(401);
      expect((await connexion("premiere.co", NOUVEAU)).status).toBe(200);
      // un administrateur déjà installé ne peut pas passer par cette route pour changer son mot de passe
      expect((await appel(ch.json.token, "POST", "/api/auth/change-password", { motDePasse: "Autre-Mdp-Admin-99" })).status).toBe(403);
    });

    it("chaque administrateur a ses propres appareils et sa propre version de sessions", async () => {
      const a = await nouvelAdmin();
      const mes = (await appel(a.jeton, "GET", "/api/auth/sessions")).json;
      expect(mes).toHaveLength(1);
      expect(mes[0].courante).toBe(true);
      // changer son mot de passe (PATCH /credentials) ferme ses autres sessions, pas celles du principal
      const autre = await connexion(a.identifiant, NOUVEAU);
      const avant = (await principal("GET", "/api/auth/me")).status;
      expect(avant).toBe(200);
      const ch = await appel(a.jeton, "PATCH", "/api/auth/credentials", { currentPassword: NOUVEAU, motDePasse: "Encore-Un-Mdp-Admin-5" });
      expect(ch.status).toBe(200);
      expect((await appel(autre.json.token, "GET", "/api/auth/me")).status).toBe(401);
      expect((await principal("GET", "/api/auth/me")).status).toBe(200);
      expect((await appel(ch.json.token, "GET", "/api/auth/me")).status).toBe(200);
    });

    it("« Déconnecter mes autres appareils » ne touche que les sessions du même administrateur", async () => {
      const a = await nouvelAdmin();
      const b = await nouvelAdmin();
      const a2 = await connexion(a.identifiant, NOUVEAU);
      const r = await appel(a.jeton, "POST", "/api/auth/deconnecter-autres", {});
      expect(r.status).toBe(200);
      expect((await appel(a2.json.token, "GET", "/api/auth/me")).status).toBe(401);
      expect((await appel(b.jeton, "GET", "/api/auth/me")).status).toBe(200);
      expect((await principal("GET", "/api/auth/me")).status).toBe(200);
    });
  });

  describe("double authentification propre à chaque administrateur", () => {
    it("activée pour l'un, elle n'est pas demandée à l'autre ; chacun a son secret et ses codes", async () => {
      const a = await nouvelAdmin();
      const b = await nouvelAdmin();
      const prep = await appel(a.jeton, "POST", "/api/auth/2fa/preparer", { motDePasse: NOUVEAU });
      expect(prep.status).toBe(200);
      const act = await appel(a.jeton, "POST", "/api/auth/2fa/activer", { code: codeDuPas(prep.json.secret, pasCourant()) });
      expect(act.status).toBe(200);
      expect(act.json.codesSecours).toHaveLength(10);
      // A doit maintenant fournir un code ; B et le principal non
      const la = await connexion(a.identifiant, NOUVEAU);
      expect(la.json.etape).toBe("2fa");
      expect(la.json.token).toBeUndefined();
      expect((await connexion(b.identifiant, NOUVEAU)).json.token).toBeTruthy();
      expect((await connexion("admin.test", MDP_PRINCIPAL)).json.token).toBeTruthy();
      // le ticket de A ne donne que la session de A, même avec le code d'un autre
      const mauvais = await appel(null, "POST", "/api/auth/2fa", { ticket: la.json.ticket, code: "000000" });
      expect(mauvais.status).toBe(401);
      const bon = await appel(null, "POST", "/api/auth/2fa", { ticket: la.json.ticket, code: codeDuPas(prep.json.secret, pasCourant() + 1) });
      expect(bon.status).toBe(200);
      expect(bon.json.session).toMatchObject({ identifiant: a.identifiant, principal: false });
      expect((await sql.query("select count(*)::int n from administrateurs where totp_actif")).rows[0].n).toBeGreaterThanOrEqual(1);
      expect((await sql.query("select totp_actif from administrateurs where principal")).rows[0].totp_actif).toBe(false);
    });

    it("un autre administrateur peut retirer la double authentification d'un collègue (téléphone perdu), pas celle du principal", async () => {
      const a = await nouvelAdmin();
      const prep = await appel(a.jeton, "POST", "/api/auth/2fa/preparer", { motDePasse: NOUVEAU });
      await appel(a.jeton, "POST", "/api/auth/2fa/activer", { code: codeDuPas(prep.json.secret, pasCourant()) });
      const p = (await principal("GET", "/api/administrateurs")).json.find((x) => x.principal);
      expect((await principal("POST", `/api/administrateurs/${a.id}/retirer-2fa`, { motDePasse: "faux" })).status).toBe(400);
      expect((await principal("POST", `/api/administrateurs/${a.id}/retirer-2fa`, { motDePasse: MDP_PRINCIPAL })).status).toBe(200);
      expect((await connexion(a.identifiant, NOUVEAU)).json.token).toBeTruthy();
      // l'autre sens : un collègue ne peut rien sur le principal
      const b = await nouvelAdmin();
      expect((await appel(b.jeton, "POST", `/api/administrateurs/${p.id}/retirer-2fa`, { motDePasse: NOUVEAU })).status).toBe(403);
    });
  });

  describe("protection du principal et désactivation", () => {
    it("un collègue ne peut ni désactiver, ni réinitialiser, ni modifier, ni déconnecter le principal", async () => {
      const b = await nouvelAdmin();
      const p = (await principal("GET", "/api/administrateurs")).json.find((x) => x.principal);
      for (const [methode, chemin, corps] of [
        ["POST", `/api/administrateurs/${p.id}/desactiver`, { motDePasse: NOUVEAU }],
        ["POST", `/api/administrateurs/${p.id}/reinitialiser`, { motDePasse: NOUVEAU }],
        ["PATCH", `/api/administrateurs/${p.id}`, { nom: "Piraté" }],
        ["POST", `/api/administrateurs/${p.id}/sessions/00000000-0000-0000-0000-000000000000/revoquer`, {}],
      ]) {
        const r = await appel(b.jeton, methode, chemin, corps);
        expect([chemin.split("/").slice(-1)[0], r.status]).toEqual([chemin.split("/").slice(-1)[0], 403]);
      }
      expect((await principal("GET", "/api/auth/me")).json.session.nom).not.toBe("Piraté");
      // et le principal lui-même ne peut pas se désactiver
      expect((await principal("POST", `/api/administrateurs/${p.id}/desactiver`, { motDePasse: MDP_PRINCIPAL })).status).toBe(403);
    });

    it("on ne peut pas désactiver ni réinitialiser son propre compte", async () => {
      const b = await nouvelAdmin();
      expect((await appel(b.jeton, "POST", `/api/administrateurs/${b.id}/desactiver`, { motDePasse: NOUVEAU })).status).toBe(400);
      expect((await appel(b.jeton, "POST", `/api/administrateurs/${b.id}/reinitialiser`, { motDePasse: NOUVEAU })).status).toBe(400);
      expect((await appel(b.jeton, "GET", "/api/auth/me")).status).toBe(200);
    });

    it("désactiver coupe l'accès AUSSITÔT (session ouverte comprise), refuse la connexion, et se réverse", async () => {
      const b = await nouvelAdmin();
      expect((await appel(b.jeton, "GET", "/api/administrateurs")).status).toBe(200);
      expect((await principal("POST", `/api/administrateurs/${b.id}/desactiver`, { motDePasse: "faux" })).status).toBe(400);
      expect((await principal("POST", `/api/administrateurs/${b.id}/desactiver`, { motDePasse: MDP_PRINCIPAL })).status).toBe(200);
      expect((await appel(b.jeton, "GET", "/api/auth/me")).status).toBe(401);
      expect((await appel(b.jeton, "GET", "/api/administrateurs")).status).toBe(401);
      expect((await connexion(b.identifiant, NOUVEAU)).status).toBe(401);
      expect((await principal("GET", "/api/administrateurs")).json.find((x) => x.id === b.id).statut).toBe("desactive");
      expect((await principal("POST", `/api/administrateurs/${b.id}/reactiver`, { motDePasse: MDP_PRINCIPAL })).status).toBe(200);
      expect((await connexion(b.identifiant, NOUVEAU)).status).toBe(200);
    });

    it("réinitialiser : nouveau mot de passe provisoire, anciennes sessions et ancien mot de passe refusés, choix du nouveau à la connexion", async () => {
      const b = await nouvelAdmin();
      const r = await principal("POST", `/api/administrateurs/${b.id}/reinitialiser`, { motDePasse: MDP_PRINCIPAL });
      expect(r.status).toBe(200);
      expect(r.json.motDePasseProvisoire).toBeTruthy();
      expect((await appel(b.jeton, "GET", "/api/auth/me")).status).toBe(401);
      expect((await connexion(b.identifiant, NOUVEAU)).status).toBe(401);
      const l = await connexion(b.identifiant, r.json.motDePasseProvisoire);
      expect(l.json.session.doitChangerMotDePasse).toBe(true);
    });

    it("le journal garde la trace de qui a fait quoi, sans mot de passe", async () => {
      const journal = (await sql.query("select actor, action, label from journal order by id desc limit 200")).rows;
      const textes = journal.map((j) => `${j.actor} ${j.action} ${j.label}`).join("\n");
      expect(textes).toMatch(/Administrateur créé : Karim Trabelsi \(karim\.t\)/);
      expect(textes).toMatch(/Administrateur désactivé/);
      expect(textes).not.toContain(NOUVEAU);
    });
  });

  describe("appareils d'un autre administrateur", () => {
    it("un collègue voit ses sessions et peut en fermer une", async () => {
      const b = await nouvelAdmin();
      const b2 = await connexion(b.identifiant, NOUVEAU);
      const liste = (await principal("GET", `/api/administrateurs/${b.id}/sessions`)).json;
      expect(liste).toHaveLength(2);
      const cible = liste[0].id;
      expect((await principal("POST", `/api/administrateurs/${b.id}/sessions/${cible}/revoquer`, {})).status).toBe(200);
      const restants = [await appel(b.jeton, "GET", "/api/auth/me"), await appel(b2.json.token, "GET", "/api/auth/me")].map((r) => r.status).sort();
      expect(restants).toEqual([200, 401]);
    });
  });
});

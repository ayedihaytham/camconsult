import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import { api, connecterAdmin, creerBaseJetable, demarrerServeur } from "./helpers.js";

/**
 * Plusieurs administrateurs : chacun a sa boîte de notifications (état « lu » propre), et les traces d'audit métier (apurement) nomment
 * la personne. Contre un vrai PostgreSQL jetable (TEST_DATABASE_URL). Ignoré sans TEST_DATABASE_URL.
 */
const actif = Boolean(process.env.TEST_DATABASE_URL);
vi.setConfig({ testTimeout: 120_000, hookTimeout: 90_000 });

describe.skipIf(!actif)("intégration PostgreSQL : notifications et traces par administrateur", () => {
  let base, serveur, principal, sql, A, B, idA, idB, idP, societe, employe;
  const MDP = "Mdp-Admin-De-Test-1!";
  const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
  /** Les notifications sont écrites sans attendre la réponse : on laisse la base les recevoir. */
  async function notifs(client) {
    await attendre(250);
    return (await client("GET", "/api/notifications")).json;
  }

  async function creerAdmin(identifiant, nom) {
    const c = await principal("POST", "/api/administrateurs", { nom, identifiant, motDePasse: MDP });
    expect(c.status).toBe(201);
    const l = await fetch(`${serveur.base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifiant, motDePasse: c.json.motDePasseProvisoire }) }).then((r) => r.json());
    const ch = await fetch(`${serveur.base}/api/auth/change-password`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${l.token}` }, body: JSON.stringify({ motDePasse: "Nouveau-Mdp-Admin-77" }) }).then((r) => r.json());
    return { id: c.json.id, client: api(serveur.base, ch.token) };
  }

  beforeAll(async () => {
    base = await creerBaseJetable();
    serveur = await demarrerServeur(base.url);
    principal = await connecterAdmin(serveur.base);
    sql = await base.client();
    idP = (await sql.query("select id from administrateurs where principal")).rows[0].id;
    ({ id: idA, client: A } = await creerAdmin("karim.t", "Karim Trabelsi"));
    ({ id: idB, client: B } = await creerAdmin("sara.m", "Sara Mejri"));
    societe = (await sql.query("insert into societes(raison_sociale,code) values('Synthétique Traces','TRC') returning id")).rows[0].id;
    // un employé de cabinet qui écrit « au cabinet »
    employe = (
      await sql.query(
        `insert into employes(nom,prenom,identifiant,mot_de_passe,role,societes_assignees,statut,permissions)
         values('Synthetique','Emp','emp.traces','','collaborateur',$1::jsonb,'actif',$2::jsonb) returning id`,
        [JSON.stringify([societe]), JSON.stringify({ messagerie: true, consulterDossiers: true })],
      )
    ).rows[0].id;
  });
  afterAll(async () => {
    await sql?.end();
    await serveur?.arreter();
    await base?.supprimer();
  });

  describe("notifications : une boîte par administrateur", () => {
    it("un message à destination du cabinet notifie CHAQUE administrateur actif, dans sa propre boîte", async () => {
      const emp = api(serveur.base, jwt.sign({ role: "employe", employeId: employe, v: 0 }, serveur.env.JWT_SECRET, { expiresIn: "1h" }));
      const r = await emp("POST", "/api/messages", { conversationId: `conv-${employe}`, auteurId: employe, contenu: "Bonjour le cabinet" });
      expect(r.status, r.texte).toBe(201);
      for (const client of [principal, A, B]) {
        const liste = await notifs(client);
        expect(liste.filter((n) => /Message de/.test(n.titre))).toHaveLength(1);
      }
      expect((await sql.query("select user_key from notifications where titre like 'Message de%' order by user_key")).rows.map((x) => x.user_key).sort()).toEqual([`admin:${idA}`, `admin:${idB}`, `admin:${idP}`].sort());
      expect((await sql.query("select count(*)::int n from notifications where user_key = 'admin'")).rows[0].n).toBe(0);
    });

    it("l'état « lu » est propre à chacun : A lit, B et le principal gardent la notification non lue", async () => {
      const avantA = await notifs(A);
      expect(avantA.every((n) => n.lu === false)).toBe(true);
      expect((await A("POST", "/api/notifications/mark-read", {})).status).toBe(200);
      expect((await notifs(A)).every((n) => n.lu === true)).toBe(true);
      expect((await notifs(B)).some((n) => n.lu === false)).toBe(true);
      expect((await notifs(principal)).some((n) => n.lu === false)).toBe(true);
    });

    it("la notification d'un administrateur désactivé n'est plus écrite ; elle l'est de nouveau à la réactivation", async () => {
      expect((await principal("POST", `/api/administrateurs/${idB}/desactiver`, { motDePasse: MDP })).status).toBe(200);
      const emp = api(serveur.base, jwt.sign({ role: "employe", employeId: employe, v: 0 }, serveur.env.JWT_SECRET, { expiresIn: "1h" }));
      await emp("POST", "/api/messages", { conversationId: `conv-${employe}`, auteurId: employe, contenu: "Second message" });
      await attendre(300);
      expect((await sql.query("select count(*)::int n from notifications where user_key = $1 and titre like 'Message de%'", [`admin:${idB}`])).rows[0].n).toBe(1);
      expect((await sql.query("select count(*)::int n from notifications where user_key = $1 and titre like 'Message de%'", [`admin:${idA}`])).rows[0].n).toBe(2);
      await principal("POST", `/api/administrateurs/${idB}/reactiver`, { motDePasse: MDP });
      // la désactivation a fermé ses sessions : il se reconnecte avec son mot de passe
      const relog = await fetch(`${serveur.base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifiant: "sara.m", motDePasse: "Nouveau-Mdp-Admin-77" }) }).then((r) => r.json());
      B = api(serveur.base, relog.token);
    });
  });

  describe("présence", () => {
    it("un employé voit « admin » en ligne dès qu'un administrateur l'est ; un administrateur ne voit que les employés", async () => {
      const emp = api(serveur.base, jwt.sign({ role: "employe", employeId: employe, v: 0 }, serveur.env.JWT_SECRET, { expiresIn: "1h" }));
      expect((await emp("GET", "/api/events/presence")).json.ids).toEqual([]);
      const flux = await fetch(`${serveur.base}/api/events`, { headers: { Authorization: `Bearer ${(await connecterJeton())}` } });
      await attendre(200);
      expect((await emp("GET", "/api/events/presence")).json.ids).toEqual(["admin"]);
      expect((await principal("GET", "/api/events/presence")).json.ids.every((i) => !String(i).startsWith("admin"))).toBe(true);
      await flux.body.cancel();
    });
  });

  describe("traces d'audit métier : le nom de la personne", () => {
    async function profil(client, version) {
      return client("PUT", `/api/apurement/societes/${societe}/profil`, {
        expectedVersion: version,
        verifier: true,
        donnees: { raisonSociale: "SYNTHETIQUE", matriculeFiscal: "1234567AB000", activite: "INDUSTRIE", ville: "TUNIS", rue: "RUE TEST", numero: "1", codePostal: "1000", reference: "Vérification synthétique" },
      });
    }

    it("chaque administrateur est nommé dans l'historique ; la vérification porte son compte", async () => {
      const p1 = await profil(A, 0);
      expect(p1.status, p1.texte).toBe(200);
      const p2 = await profil(B, p1.json.version);
      expect(p2.status, p2.texte).toBe(200);
      const p3 = await profil(principal, p2.json.version);
      expect(p3.status, p3.texte).toBe(200);
      const histo = await principal("GET", `/api/apurement/audit?societeId=${societe}&entityId=${p1.json.id}`);
      expect(histo.status, histo.texte).toBe(200);
      expect(histo.json.map((h) => h.nomActeur).sort()).toEqual(["Karim Trabelsi", "Sara Mejri", "Administrateur Test".replace("Administrateur Test", (await sql.query("select nom from administrateurs where principal")).rows[0].nom)].sort());
      const acteurs = (await sql.query("select acteur from apurement_audit order by created_at")).rows.map((r) => r.acteur);
      expect(acteurs).toEqual([`admin:${idA}`, `admin:${idB}`, `admin:${idP}`]);
      expect((await sql.query("select verified_by from apurement_profils_fiscaux where societe_id = $1", [societe])).rows[0].verified_by).toBe(`admin:${idP}`);
    });

    it("une ancienne trace « admin » se lit comme l'administrateur principal, et n'est jamais réécrite", async () => {
      const entite = (await sql.query("select id from apurement_profils_fiscaux where societe_id = $1", [societe])).rows[0].id;
      await sql.query("insert into apurement_audit(societe_id,acteur,action,entity_id) values($1,'admin','profil.modifier',$2)", [societe, entite]);
      const histo = (await principal("GET", `/api/apurement/audit?societeId=${societe}&entityId=${entite}`)).json;
      const nomPrincipal = (await sql.query("select nom from administrateurs where principal")).rows[0].nom;
      expect(histo.filter((h) => h.nomActeur === nomPrincipal).length).toBeGreaterThanOrEqual(2);
      expect((await sql.query("select count(*)::int n from apurement_audit where acteur = 'admin'")).rows[0].n).toBe(1);
    });
  });

  describe("migration (dernier test : redémarre le serveur)", () => {
    it("migration : les anciennes notifications « admin » reviennent au principal au démarrage", async () => {
      await sql.query("insert into notifications(user_key,type,titre) values('admin','societe','Ancienne notification')");
      await serveur.arreter();
      serveur = await demarrerServeur(base.url);
      principal = await connecterAdmin(serveur.base);
      const ligne = (await sql.query("select user_key from notifications where titre = 'Ancienne notification'")).rows[0];
      expect(ligne.user_key).toBe(`admin:${idP}`);
      expect((await notifs(principal)).some((n) => n.titre === "Ancienne notification")).toBe(true);
    });
  });

  async function connecterJeton() {
    const r = await fetch(`${serveur.base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifiant: "admin.test", motDePasse: MDP }) }).then((x) => x.json());
    return r.token;
  }
});

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import { api, connecterAdmin, creerBaseJetable, demarrerServeur } from "./helpers.js";

/**
 * Authentification et rôles, contre un vrai PostgreSQL jetable (TEST_DATABASE_URL) et le vrai serveur, données synthétiques :
 * jetons (algorithme imposé, renouvellement, révocation), changement de mot de passe, changement forcé, comptes désactivés, et matrice
 * des accès par rôle (administrateur, responsable des collaborateurs, collaborateur, responsable et délégué de société).
 */
const actif = Boolean(process.env.TEST_DATABASE_URL);
vi.setConfig({ testTimeout: 120_000, hookTimeout: 90_000 });

describe.skipIf(!actif)("intégration PostgreSQL : sessions et rôles", () => {
  let base, serveur, admin, sql, propre, autre;
  const MDP = "Mdp-Session-Test-42";
  const jetonDe = (lien) => new URL(lien).searchParams.get("token");

  /** Crée un compte, l'active et le connecte : renvoie son identifiant, son id, son jeton et un appelant API. */
  async function compte(extra = {}) {
    const n = Math.random().toString(36).slice(2, 8);
    const identifiant = `s.${n}`;
    const r = await admin("POST", "/api/employes", { nom: "Synthetique", prenom: "Test", identifiant, email: `${identifiant}@example.test`, type: "Comptable", ...extra });
    expect(r.status).toBe(201);
    await api(serveur.base)("POST", "/api/auth/activate", { token: jetonDe(r.json.lienAcces), motDePasse: MDP });
    const c = await api(serveur.base)("POST", "/api/auth/login", { identifiant, motDePasse: MDP });
    expect(c.status).toBe(200);
    return { identifiant, id: r.json.id, jeton: c.json.token, appel: api(serveur.base, c.json.token) };
  }
  const secret = () => serveur.env.JWT_SECRET;
  const maintenant = () => Math.floor(Date.now() / 1000);

  beforeAll(async () => {
    base = await creerBaseJetable();
    serveur = await demarrerServeur(base.url);
    admin = await connecterAdmin(serveur.base);
    sql = await base.client();
    propre = (await admin("POST", "/api/societes", { raisonSociale: "Société PROPRE", code: "SES-A" })).json.id;
    autre = (await admin("POST", "/api/societes", { raisonSociale: "Société ETRANGERE", code: "SES-B" })).json.id;
  });
  afterAll(async () => {
    await sql?.end();
    await serveur?.arreter();
    await base?.supprimer();
  });

  describe("jetons", () => {
    it("l'algorithme est imposé : un jeton signé avec le bon secret mais un autre algorithme est refusé", async () => {
      const hs512 = jwt.sign({ role: "admin" }, secret(), { algorithm: "HS512", expiresIn: "1h" });
      expect((await api(serveur.base, hs512)("GET", "/api/auth/me")).status).toBe(401);
      const hs256 = jwt.sign({ role: "admin" }, secret(), { algorithm: "HS256", expiresIn: "1h" });
      expect((await api(serveur.base, hs256)("GET", "/api/auth/me")).status).toBe(200);
    });

    it("session active : un jeton de plus de 3 h est renouvelé (en-tête), le neuf fonctionne ; un jeton récent ne l'est pas", async () => {
      const ancien = jwt.sign({ role: "admin", iat: maintenant() - 4 * 3600 }, secret(), { expiresIn: "12h" });
      const r = await api(serveur.base, ancien)("GET", "/api/auth/me");
      expect(r.status).toBe(200);
      const neuf = r.entetes.get("x-token-renouvele");
      expect(neuf).toBeTruthy();
      expect((await api(serveur.base, neuf)("GET", "/api/auth/me")).status).toBe(200);
      const decode = jwt.decode(neuf);
      expect(decode.role).toBe("admin");
      expect(decode.exp - decode.iat).toBe(12 * 3600);
      const recent = await api(serveur.base, jwt.sign({ role: "admin" }, secret(), { expiresIn: "12h" }))("GET", "/api/auth/me");
      expect(recent.entetes.get("x-token-renouvele")).toBeNull();
    });

    it("un jeton expiré n'est jamais renouvelé", async () => {
      const expire = jwt.sign({ role: "admin", iat: maintenant() - 13 * 3600 }, secret(), { expiresIn: "12h" });
      const r = await api(serveur.base, expire)("GET", "/api/auth/me");
      expect(r.status).toBe(401);
      expect(r.entetes.get("x-token-renouvele")).toBeNull();
    });

    it("le jeton d'un compte employé renouvelé reste celui du même compte (jamais celui d'un autre)", async () => {
      const e = await compte({ role: "collaborateur", societesAssignees: [propre] });
      const version = jwt.decode(e.jeton).v;
      const ancien = jwt.sign({ role: "employe", employeId: e.id, v: version, iat: maintenant() - 4 * 3600 }, secret(), { expiresIn: "12h" });
      const r = await api(serveur.base, ancien)("GET", "/api/auth/me");
      expect(r.status).toBe(200);
      expect(jwt.decode(r.entetes.get("x-token-renouvele"))).toMatchObject({ role: "employe", employeId: e.id, v: version });
    });
  });

  describe("mots de passe et révocation", () => {
    it("changer son mot de passe annule les anciens jetons (autre appareil) et en donne un neuf pour celui-ci", async () => {
      const e = await compte({ role: "collaborateur", societesAssignees: [propre] });
      const autreAppareil = (await api(serveur.base)("POST", "/api/auth/login", { identifiant: e.identifiant, motDePasse: MDP })).json.token;
      await sql.query("update employes set doit_changer_mdp = false where id = $1", [e.id]);
      const r = await e.appel("POST", "/api/auth/change-password", { motDePasse: "Nouveau-Mdp-Session-77" });
      expect(r.status).toBe(200);
      expect(r.json.token).toBeTruthy();
      expect((await api(serveur.base, e.jeton)("GET", "/api/auth/me")).status).toBe(401);
      expect((await api(serveur.base, autreAppareil)("GET", "/api/auth/me")).status).toBe(401);
      expect((await api(serveur.base, r.json.token)("GET", "/api/auth/me")).status).toBe(200);
      const connexion = await api(serveur.base)("POST", "/api/auth/login", { identifiant: e.identifiant, motDePasse: "Nouveau-Mdp-Session-77" });
      expect(connexion.status).toBe(200);
    });

    it("une réinitialisation par lien déconnecte les sessions ouvertes de la personne", async () => {
      const e = await compte({ role: "collaborateur", societesAssignees: [propre] });
      expect((await e.appel("GET", "/api/auth/me")).status).toBe(200);
      const lien = await admin("POST", `/api/employes/${e.id}/envoyer-acces`, {});
      expect(lien.status).toBe(200);
      expect(lien.json.but).toBe("reset");
      const r = await api(serveur.base)("POST", "/api/auth/activate", { token: jetonDe(lien.json.lienAcces), motDePasse: "Reinit-Mdp-Session-88" });
      expect(r.status).toBe(200);
      expect((await e.appel("GET", "/api/auth/me")).status).toBe(401);
      expect((await api(serveur.base, r.json.token)("GET", "/api/auth/me")).status).toBe(200);
    });

    it("administrateur : le nouveau mot de passe suit la même règle que les employés, annule les anciens jetons et renvoie un jeton neuf", async () => {
      const ancien = (await api(serveur.base)("POST", "/api/auth/login", { identifiant: "admin.test", motDePasse: "Mdp-Admin-De-Test-1!" })).json.token;
      const a = api(serveur.base, ancien);
      expect((await a("PATCH", "/api/auth/credentials", { currentPassword: "Mdp-Admin-De-Test-1!", motDePasse: "court" })).status).toBe(400);
      expect((await a("PATCH", "/api/auth/credentials", { currentPassword: "Mdp-Admin-De-Test-1!", motDePasse: "xx-admin.test-xx" })).status).toBe(400);
      expect((await a("PATCH", "/api/auth/credentials", { currentPassword: "mauvais", motDePasse: "Admin-Nouveau-Mdp-55" })).status).toBe(400);
      // sans changement de mot de passe : rien n'est révoqué
      expect((await a("PATCH", "/api/auth/credentials", { currentPassword: "Mdp-Admin-De-Test-1!" })).status).toBe(200);
      expect((await a("GET", "/api/auth/me")).status).toBe(200);
      const r = await a("PATCH", "/api/auth/credentials", { currentPassword: "Mdp-Admin-De-Test-1!", motDePasse: "Admin-Nouveau-Mdp-55" });
      expect(r.status).toBe(200);
      expect(r.json.token).toBeTruthy();
      expect((await a("GET", "/api/auth/me")).status).toBe(401);
      expect((await api(serveur.base, r.json.token)("GET", "/api/auth/me")).status).toBe(200);
      // remet le mot de passe d'origine pour les autres tests
      const retour = await api(serveur.base, r.json.token)("PATCH", "/api/auth/credentials", { currentPassword: "Admin-Nouveau-Mdp-55", motDePasse: "Mdp-Admin-De-Test-1!" });
      expect(retour.status).toBe(200);
      admin = api(serveur.base, retour.json.token);
    });

    it("un compte désactivé perd l'accès immédiatement, avec son jeton encore valide", async () => {
      const e = await compte({ role: "collaborateur", societesAssignees: [propre] });
      expect((await e.appel("GET", "/api/societes")).status).toBe(200);
      const r = await admin("PATCH", `/api/employes/${e.id}`, { statut: "inactif" });
      expect(r.status).toBe(200);
      expect((await e.appel("GET", "/api/societes")).status).toBe(401);
      const connexion = await api(serveur.base)("POST", "/api/auth/login", { identifiant: e.identifiant, motDePasse: MDP });
      expect(connexion.status).toBe(401);
    });
  });

  describe("mot de passe provisoire", () => {
    it("tant qu'il n'est pas changé, seules les routes d'authentification répondent (le changement forcé n'est pas qu'un écran)", async () => {
      const e = await compte({ role: "collaborateur", societesAssignees: [propre] });
      await sql.query("update employes set doit_changer_mdp = true where id = $1", [e.id]);
      const bloque = await e.appel("GET", "/api/societes");
      expect(bloque.status).toBe(403);
      expect(bloque.json.code).toBe("CHANGER_MOT_DE_PASSE");
      expect((await e.appel("GET", "/api/noeuds")).status).toBe(403);
      expect((await e.appel("POST", "/api/noeuds", { libelle: "x", type: "dossier" })).status).toBe(403);
      const me = await e.appel("GET", "/api/auth/me");
      expect(me.status).toBe(200);
      expect(me.json.session.doitChangerMotDePasse).toBe(true);
      const change = await e.appel("POST", "/api/auth/change-password", { motDePasse: "Definitif-Mdp-Session-9" });
      expect(change.status).toBe(200);
      const apres = api(serveur.base, change.json.token);
      expect((await apres("GET", "/api/societes")).status).toBe(200);
    });

    it("le mot de passe choisi ne peut pas contenir l'identifiant", async () => {
      const e = await compte({ role: "collaborateur", societesAssignees: [propre] });
      await sql.query("update employes set doit_changer_mdp = true where id = $1", [e.id]);
      expect((await e.appel("POST", "/api/auth/change-password", { motDePasse: `${e.identifiant}-abc` })).status).toBe(400);
    });
  });

  describe("matrice des rôles", () => {
    let roles;
    beforeAll(async () => {
      roles = {
        responsableEquipe: await compte({ role: "responsable_collaborateurs" }),
        collaborateur: await compte({ role: "collaborateur", societesAssignees: [propre] }),
        societe: await compte({ role: "societe_employe", societeId: propre }),
        delegue: await compte({ role: "societe_employe", societeId: propre, delegue: true }),
      };
    });

    it("chaque compte voit son rôle dans sa session, et un employé n'a jamais le rôle administrateur", async () => {
      const poste = async (c) => (await c.appel("GET", "/api/auth/me")).json.session;
      expect(await poste(roles.responsableEquipe)).toMatchObject({ role: "employe", poste: "responsable_collaborateurs", societeIds: [] });
      expect(await poste(roles.collaborateur)).toMatchObject({ role: "employe", poste: "collaborateur", societeIds: [propre] });
      expect(await poste(roles.societe)).toMatchObject({ role: "employe", poste: "societe_employe", lectureSeule: true, delegue: false, societeIds: [propre] });
      expect(await poste(roles.delegue)).toMatchObject({ poste: "societe_employe", delegue: true, societeIds: [propre] });
      expect((await admin("GET", "/api/auth/me")).json.session).toMatchObject({ role: "admin", societeIds: null });
    });

    it("routes réservées à l'administrateur : refusées aux quatre autres rôles", async () => {
      const reservees = ["/api/journal", "/api/facturation", "/api/facturation/cabinet", "/api/bordereaux", "/api/data/backup"];
      for (const chemin of reservees) {
        expect((await admin("GET", chemin)).status).toBe(200);
        for (const [nom, c] of Object.entries(roles)) expect([chemin, nom, (await c.appel("GET", chemin)).status]).toEqual([chemin, nom, 403]);
      }
    });

    it("gestion d'équipe : administrateur et responsable des collaborateurs seulement", async () => {
      expect((await admin("GET", "/api/employes")).status).toBe(200);
      expect((await roles.responsableEquipe.appel("GET", "/api/employes")).status).toBe(200);
      for (const c of [roles.collaborateur, roles.societe, roles.delegue]) expect((await c.appel("GET", "/api/employes")).status).toBe(403);
    });

    it("un compte de société n'accède pas aux outils internes du cabinet (apurement, cours de change, état SWIFT, notes, immobilisations)", async () => {
      for (const chemin of ["/api/apurement/synthese", "/api/cours-change", "/api/etat-swift/resume", "/api/notes/modele", "/api/grille-affectat", "/api/immobilisations/categories"]) {
        for (const c of [roles.societe, roles.delegue]) expect([chemin, (await c.appel("GET", chemin)).status]).toEqual([chemin, 403]);
        expect([chemin, (await roles.collaborateur.appel("GET", chemin)).status]).not.toEqual([chemin, 403]);
      }
    });

    it("société étrangère : refusée (403) à tout compte qui n'y est pas rattaché, sur toutes les données par société", async () => {
      // Politique actuelle : le responsable des collaborateurs voit toutes les sociétés pour les collectes, l'état SWIFT et le stock ; pour
      // la banque, les fournisseurs, les états financiers, le suivi devise et les honoraires, l'accès reste celui des sociétés assignées
      // (voir docs/permissions.md). Ce test fige cette politique : la changer est une décision, pas un effet de bord.
      const adminSeul = new Set(["/api/honoraires", "/api/fournisseurs", "/api/banque", "/api/balances", "/api/suivi-devise", "/api/immobilisations/biens"]);
      const chemins = ["/api/collectes/souche", "/api/honoraires", "/api/fournisseurs", "/api/etat-swift", "/api/banque", "/api/stock/mouvements", "/api/balances", "/api/suivi-devise", "/api/immobilisations/biens"];
      for (const chemin of chemins) {
        for (const [nom, c] of Object.entries({ collaborateur: roles.collaborateur, societe: roles.societe, delegue: roles.delegue })) {
          const r = await c.appel("GET", `${chemin}?societeId=${autre}`);
          expect([chemin, nom, r.status]).toEqual([chemin, nom, 403]);
        }
        // l'administrateur et le responsable des collaborateurs voient toutes les sociétés
        expect([chemin, (await admin("GET", `${chemin}?societeId=${autre}`)).status]).not.toEqual([chemin, 403]);
        const statutResponsable = (await roles.responsableEquipe.appel("GET", `${chemin}?societeId=${autre}`)).status;
        if (adminSeul.has(chemin)) expect([chemin, statutResponsable]).toEqual([chemin, 403]);
        else expect([chemin, statutResponsable]).not.toEqual([chemin, 403]);
      }
    });

    it("listes globales : un compte de société ne reçoit que sa société (récapitulatif des honoraires, sociétés, noeuds)", async () => {
      for (const chemin of ["/api/honoraires/recap", "/api/societes", "/api/noeuds"]) {
        for (const c of [roles.societe, roles.delegue]) {
          const r = await c.appel("GET", chemin);
          expect(r.status).toBe(200);
          expect(r.texte).not.toContain(autre);
        }
      }
      expect((await admin("GET", "/api/societes")).texte).toContain(autre);
    });

    it("le responsable des collaborateurs voit toutes les sociétés (comme l'administrateur), pas le collaborateur", async () => {
      expect((await roles.responsableEquipe.appel("GET", "/api/societes")).texte).toContain(autre);
      expect((await roles.collaborateur.appel("GET", "/api/societes")).texte).not.toContain(autre);
    });
  });
});

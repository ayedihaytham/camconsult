import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { api, connecterAdmin, creerBaseJetable, demarrerServeur } from "./helpers.js";

/**
 * Blocage de connexion persistant (force brute), contre un vrai PostgreSQL jetable (TEST_DATABASE_URL) : il survit au redémarrage du
 * serveur ; un nouvel accès demandé par la personne (lien de réinitialisation émis ou utilisé) lève son blocage, jamais celui de
 * l'administrateur. Ignoré sans TEST_DATABASE_URL.
 */
const actif = Boolean(process.env.TEST_DATABASE_URL);
vi.setConfig({ testTimeout: 180_000, hookTimeout: 90_000 });

describe.skipIf(!actif)("intégration PostgreSQL : blocage de connexion persistant", () => {
  let base, serveur, admin, sql;
  const MDP = "Mdp-Blocage-Test-31";
  const jetonDe = (lien) => new URL(lien).searchParams.get("token");
  const login = (identifiant, motDePasse) => api(serveur.base)("POST", "/api/auth/login", { identifiant, motDePasse });

  async function compte() {
    const n = Math.random().toString(36).slice(2, 8);
    const identifiant = `b.${n}`;
    const r = await admin("POST", "/api/employes", { nom: "Synthetique", prenom: "Test", identifiant, email: `${identifiant}@example.test`, type: "Comptable", role: "collaborateur" });
    expect(r.status).toBe(201);
    await api(serveur.base)("POST", "/api/auth/activate", { token: jetonDe(r.json.lienAcces), motDePasse: MDP });
    return { identifiant, id: r.json.id };
  }
  /** Huit échecs : le compte est bloqué (le neuvième essai, même avec le bon mot de passe, reçoit 429). */
  async function bloquer(identifiant) {
    for (let i = 0; i < 8; i++) expect((await login(identifiant, "mauvais-mot-de-passe")).status).toBe(401);
    expect((await login(identifiant, MDP)).status).toBe(429);
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

  it("après huit échecs, même le bon mot de passe est refusé (429, Retry-After) ; les compteurs sont en base", async () => {
    const c = await compte();
    await bloquer(c.identifiant);
    const r = await login(c.identifiant, MDP);
    expect(r.status).toBe(429);
    expect(Number(r.entetes.get("retry-after"))).toBeGreaterThan(0);
    const lignes = (await sql.query("select portee, nb from tentatives_connexion where identifiant = $1 order by portee", [c.identifiant])).rows;
    expect(lignes).toEqual([{ portee: "compte", nb: 8 }, { portee: "identifiant", nb: 8 }]);
  });

  it("le blocage SURVIT au redémarrage du serveur", async () => {
    const c = await compte();
    await bloquer(c.identifiant);
    await serveur.arreter();
    serveur = await demarrerServeur(base.url);
    admin = await connecterAdmin(serveur.base);
    expect((await login(c.identifiant, MDP)).status).toBe(429);
    // un autre compte n'est pas touché
    const autre = await compte();
    expect((await login(autre.identifiant, MDP)).status).toBe(200);
  });

  it("la fenêtre de 15 minutes passée, le blocage est levé tout seul", async () => {
    const c = await compte();
    await bloquer(c.identifiant);
    await sql.query("update tentatives_connexion set debut = now() - interval '16 minutes' where identifiant = $1", [c.identifiant]);
    expect((await login(c.identifiant, MDP)).status).toBe(200);
  });

  it("échecs simultanés : aucun n'est perdu (le compteur égale le nombre d'échecs reçus)", async () => {
    const c = await compte();
    const reponses = await Promise.all(Array.from({ length: 6 }, () => login(c.identifiant, "mauvais")));
    const echecs = reponses.filter((r) => r.status === 401).length;
    const nb = (await sql.query("select nb from tentatives_connexion where portee = 'compte' and identifiant = $1", [c.identifiant])).rows[0].nb;
    expect(nb).toBe(echecs);
    expect(echecs).toBe(6);
  });

  it("un nouvel accès demandé (lien de réinitialisation émis par le cabinet) lève le blocage de la personne, aussitôt", async () => {
    const c = await compte();
    await bloquer(c.identifiant);
    const lien = await admin("POST", `/api/employes/${c.id}/envoyer-acces`, {});
    expect(lien.status).toBe(200);
    expect((await login(c.identifiant, MDP)).status).toBe(200);
    expect((await sql.query("select count(*)::int n from tentatives_connexion where identifiant = $1", [c.identifiant])).rows[0].n).toBe(0);
    const journal = await admin("GET", "/api/journal");
    expect(journal.texte).toContain("blocage de connexion levé");
  });

  it("utiliser le lien de réinitialisation (nouveau mot de passe) lève aussi le blocage", async () => {
    const c = await compte();
    const lien = await admin("POST", `/api/employes/${c.id}/envoyer-acces`, {});
    await bloquer(c.identifiant);
    const r = await api(serveur.base)("POST", "/api/auth/activate", { token: jetonDe(lien.json.lienAcces), motDePasse: "Nouveau-Mdp-Blocage-52" });
    expect(r.status).toBe(200);
    expect((await login(c.identifiant, "Nouveau-Mdp-Blocage-52")).status).toBe(200);
  });

  it("le blocage d'une ADRESSE n'est pas levé par la réinitialisation d'un compte", async () => {
    const c = await compte();
    await sql.query("insert into tentatives_connexion (garde, portee, adresse, identifiant, nb, debut) values ('connexion', 'adresse', 'adresse-test', '', 5, now())");
    await bloquer(c.identifiant);
    await admin("POST", `/api/employes/${c.id}/envoyer-acces`, {});
    expect((await sql.query("select nb from tentatives_connexion where portee = 'adresse' and adresse = 'adresse-test'")).rows[0].nb).toBe(5);
  });

  it("l'administrateur : son blocage n'est jamais levé par un lien de réinitialisation, même sur un compte au même identifiant", async () => {
    // Un compte employé qui porterait l'identifiant de l'administrateur (inséré directement : l'API le refuserait peut-être).
    const n = Math.random().toString(36).slice(2, 8);
    const idEmploye = (
      await sql.query(
        `insert into employes (nom, prenom, identifiant, mot_de_passe, type, role, statut, email) values ('Faux', 'Admin', 'admin.test', '', 'Comptable', 'collaborateur', 'actif', $1) returning id`,
        [`faux.${n}@example.test`],
      )
    ).rows[0].id;
    for (let i = 0; i < 8; i++) expect((await login("admin.test", "mauvais-mot-de-passe")).status).toBe(401);
    expect((await login("admin.test", "Mdp-Admin-De-Test-1!")).status).toBe(429);
    const lien = await admin("POST", `/api/employes/${idEmploye}/envoyer-acces`, {});
    expect(lien.status).toBe(200);
    expect((await login("admin.test", "Mdp-Admin-De-Test-1!")).status).toBe(429);
    expect((await sql.query("select nb from tentatives_connexion where portee = 'identifiant' and identifiant = 'admin.test'")).rows[0].nb).toBe(8);
    // même en activant ce lien : le blocage de l'administrateur reste
    await api(serveur.base)("POST", "/api/auth/activate", { token: jetonDe(lien.json.lienAcces), motDePasse: "Autre-Mdp-Blocage-63" });
    expect((await login("admin.test", "Mdp-Admin-De-Test-1!")).status).toBe(429);
  });
});

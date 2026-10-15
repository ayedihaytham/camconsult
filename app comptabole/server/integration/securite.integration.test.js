import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { api, connecterAdmin, creerBaseJetable, demarrerServeur } from "./helpers.js";

/**
 * Tests d'intégration contre un VRAI PostgreSQL jetable et le VRAI serveur (démarré en mode production), avec des données synthétiques.
 * Ils exigent TEST_DATABASE_URL (serveur PostgreSQL de test, jamais la production). Sans elle ils sont IGNORÉS, et l'avertissement
 * ci-dessous le dit : un « test ignoré » n'est pas un test réussi.
 *   TEST_DATABASE_URL=postgres://utilisateur:motdepasse@localhost:5432/postgres npm run test:integration
 */
const actif = Boolean(process.env.TEST_DATABASE_URL);
if (!actif) console.warn("[integration] IGNORÉS : TEST_DATABASE_URL absent — aucun test d'intégration PostgreSQL n'a été exécuté.");

vi.setConfig({ testTimeout: 90_000, hookTimeout: 90_000 });

describe.skipIf(!actif)("intégration PostgreSQL : sécurité, migration et concurrence", () => {
  let base;
  let serveur;
  let admin;
  let sql;

  const creerEmploye = async (extra = {}) => {
    const n = Math.random().toString(36).slice(2, 8);
    const r = await admin("POST", "/api/employes", {
      nom: "Synthetique",
      prenom: "Test",
      identifiant: `t.${n}`,
      email: `t.${n}@example.test`,
      type: "Comptable",
      ...extra,
    });
    expect(r.status).toBe(201);
    return { identifiant: `t.${n}`, id: r.json.id, lien: r.json.lienAcces, reponse: r };
  };
  const jetonDe = (lien) => new URL(lien).searchParams.get("token");

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

  it("le serveur démarre en production sur une base vide, expose la santé et des en-têtes de sécurité sans X-Powered-By", async () => {
    const r = await api(serveur.base)("GET", "/api/health");
    expect(r.status).toBe(200);
    expect(r.entetes.get("x-powered-by")).toBeNull();
    expect(r.entetes.get("x-content-type-options")).toBe("nosniff");
    expect(r.entetes.get("content-security-policy-report-only")).toContain("default-src 'self'");
    const tables = (await sql.query("select count(*)::int n from information_schema.tables where table_schema = 'public'")).rows[0].n;
    expect(tables).toBeGreaterThan(40);
  });

  it("création d'un compte : aucun mot de passe en base, lien à usage unique, rien de secret dans la liste", async () => {
    const e = await creerEmploye();
    const ligne = (await sql.query("select mot_de_passe, mdp_hash, doit_changer_mdp from employes where id = $1", [e.id])).rows[0];
    expect(ligne).toEqual({ mot_de_passe: "", mdp_hash: null, doit_changer_mdp: true });
    const liste = await admin("GET", "/api/employes");
    expect(liste.texte).not.toContain("scrypt$");
    expect(liste.texte).not.toContain(jetonDe(e.lien));
    // Le jeton n'est stocké que sous forme d'empreinte.
    const jetons = (await sql.query("select token_hash from password_tokens where employe_id = $1", [e.id])).rows;
    expect(jetons).toHaveLength(1);
    expect(jetons[0].token_hash).not.toBe(jetonDe(e.lien));
  });

  it("activation : réussit une fois, refuse la réutilisation, puis la connexion fonctionne et l'empreinte est enregistrée", async () => {
    const e = await creerEmploye();
    const jeton = jetonDe(e.lien);
    const a = await api(serveur.base)("POST", "/api/auth/activate", { token: jeton, motDePasse: "Nouveau-Mdp-Test-42" });
    expect(a.status).toBe(200);
    expect(a.texte).not.toContain("Nouveau-Mdp-Test-42");
    expect((await api(serveur.base)("POST", "/api/auth/activate", { token: jeton, motDePasse: "Autre-Mdp-Test-4242" })).status).toBe(400);
    expect((await api(serveur.base)("POST", "/api/auth/login", { identifiant: e.identifiant, motDePasse: "Nouveau-Mdp-Test-42" })).status).toBe(200);
    const ligne = (await sql.query("select mdp_hash, mot_de_passe, doit_changer_mdp from employes where id = $1", [e.id])).rows[0];
    expect(ligne.mdp_hash.startsWith("scrypt$")).toBe(true);
    expect(ligne.mot_de_passe).toBe("");
    expect(ligne.doit_changer_mdp).toBe(false);
  });

  it("dix activations simultanées avec le même lien : une seule réussit", async () => {
    const e = await creerEmploye();
    const jeton = jetonDe(e.lien);
    const reponses = await Promise.all(Array.from({ length: 10 }, (_, i) => api(serveur.base)("POST", "/api/auth/activate", { token: jeton, motDePasse: `Mdp-Simultane-Test-${i}x` })));
    expect(reponses.filter((r) => r.status === 200)).toHaveLength(1);
    expect(reponses.filter((r) => r.status === 400)).toHaveLength(9);
    const ligne = (await sql.query("select mdp_hash from employes where id = $1", [e.id])).rows[0];
    expect(ligne.mdp_hash.startsWith("scrypt$")).toBe(true);
  });

  it("lien expiré refusé ; un nouveau lien invalide l'ancien", async () => {
    const e = await creerEmploye();
    await sql.query("update password_tokens set expires_at = now() - interval '1 minute' where employe_id = $1", [e.id]);
    expect((await api(serveur.base)("POST", "/api/auth/activate", { token: jetonDe(e.lien), motDePasse: "Mdp-Expire-Test-12" })).status).toBe(400);
    const nouveau = await admin("POST", `/api/employes/${e.id}/envoyer-acces`);
    expect(nouveau.status).toBe(200);
    expect(nouveau.json.emailEnvoi).toBe("smtp");
    const un = await admin("POST", `/api/employes/${e.id}/envoyer-acces`);
    expect((await api(serveur.base)("POST", "/api/auth/activate", { token: jetonDe(nouveau.json.lienAcces), motDePasse: "Mdp-Ancien-Lien-12" })).status).toBe(400);
    expect((await api(serveur.base)("POST", "/api/auth/activate", { token: jetonDe(un.json.lienAcces), motDePasse: "Mdp-Dernier-Lien-12" })).status).toBe(200);
  });

  it("compte hérité : se connecte, est converti une seule fois même avec huit premières connexions simultanées, puis reste utilisable", async () => {
    const id = "legacy.test";
    await sql.query(
      "insert into employes (nom, prenom, identifiant, mot_de_passe, type, role, email, statut, doit_changer_mdp) values ('Herite','Compte',$1,'Ancien-Mdp-Clair-77','Comptable','collaborateur','h@example.test','actif',false)",
      [id],
    );
    const reponses = await Promise.all(Array.from({ length: 8 }, () => api(serveur.base)("POST", "/api/auth/login", { identifiant: id, motDePasse: "Ancien-Mdp-Clair-77" })));
    expect(reponses.map((r) => r.status)).toEqual(Array(8).fill(200));
    const ligne = (await sql.query("select mdp_hash, mot_de_passe from employes where identifiant = $1", [id])).rows[0];
    expect(ligne.mot_de_passe).toBe("");
    expect(ligne.mdp_hash.startsWith("scrypt$")).toBe(true);
    expect((await api(serveur.base)("POST", "/api/auth/login", { identifiant: id, motDePasse: "Ancien-Mdp-Clair-77" })).status).toBe(200);
    expect((await api(serveur.base)("POST", "/api/auth/login", { identifiant: id, motDePasse: "Mauvais-Mdp-Clair-77" })).status).toBe(401);
  });

  it("période de validation (MIGRATE_LEGACY_PASSWORDS=false) : un compte hérité se connecte sans être converti, donc un retour arrière reste possible", async () => {
    await serveur.arreter();
    serveur = await demarrerServeur(base.url, { MIGRATE_LEGACY_PASSWORDS: "false" });
    const id = "legacy.canari";
    await sql.query(
      "insert into employes (nom, prenom, identifiant, mot_de_passe, type, role, email, statut) values ('Herite','Canari',$1,'Mdp-Clair-Canari-5','Comptable','collaborateur','c@example.test','actif')",
      [id],
    );
    expect((await api(serveur.base)("POST", "/api/auth/login", { identifiant: id, motDePasse: "Mdp-Clair-Canari-5" })).status).toBe(200);
    const ligne = (await sql.query("select mdp_hash, mot_de_passe from employes where identifiant = $1", [id])).rows[0];
    expect(ligne).toEqual({ mdp_hash: null, mot_de_passe: "Mdp-Clair-Canari-5" });
    // Levée du réglage : la conversion reprend à la connexion suivante.
    await serveur.arreter();
    serveur = await demarrerServeur(base.url);
    admin = await connecterAdmin(serveur.base);
    expect((await api(serveur.base)("POST", "/api/auth/login", { identifiant: id, motDePasse: "Mdp-Clair-Canari-5" })).status).toBe(200);
    expect((await sql.query("select mot_de_passe from employes where identifiant = $1", [id])).rows[0].mot_de_passe).toBe("");
  });

  it("un échec de connexion ne modifie pas un compte hérité", async () => {
    const id = "legacy.echec";
    await sql.query(
      "insert into employes (nom, prenom, identifiant, mot_de_passe, type, role, email, statut) values ('Herite','Echec',$1,'Mdp-Clair-Echec-9','Comptable','collaborateur','e@example.test','actif')",
      [id],
    );
    await api(serveur.base)("POST", "/api/auth/login", { identifiant: id, motDePasse: "faux-mot-de-passe-1" });
    const ligne = (await sql.query("select mdp_hash, mot_de_passe from employes where identifiant = $1", [id])).rows[0];
    expect(ligne).toEqual({ mdp_hash: null, mot_de_passe: "Mdp-Clair-Echec-9" });
  });

  it("un compte jamais activé, inactif ou inconnu reçoit la même réponse", async () => {
    const e = await creerEmploye();
    const reponses = await Promise.all([e.identifiant, "inconnu.total"].map((identifiant) => api(serveur.base)("POST", "/api/auth/login", { identifiant, motDePasse: "Nimporte-Quoi-123" })));
    for (const r of reponses) expect([r.status, r.json.error]).toEqual([401, "Identifiant ou mot de passe incorrect"]);
  });

  it("le blocage de connexion s'applique (8 échecs) puis refuse même le bon mot de passe", async () => {
    const e = await creerEmploye();
    await api(serveur.base)("POST", "/api/auth/activate", { token: jetonDe(e.lien), motDePasse: "Mdp-Blocage-Test-33" });
    for (let i = 0; i < 8; i++) await api(serveur.base)("POST", "/api/auth/login", { identifiant: e.identifiant, motDePasse: `faux-${i}-mot-de-passe` });
    const r = await api(serveur.base)("POST", "/api/auth/login", { identifiant: e.identifiant, motDePasse: "Mdp-Blocage-Test-33" });
    expect(r.status).toBe(429);
    expect(Number(r.entetes.get("retry-after"))).toBeGreaterThan(0);
  });

  it("derrière nginx (un saut de confiance) : l'adresse retenue est la dernière du X-Forwarded-For (celle qu'ajoute nginx), pas une valeur forgée à gauche", async () => {
    const e = await creerEmploye();
    await api(serveur.base)("POST", "/api/auth/activate", { token: jetonDe(e.lien), motDePasse: "Mdp-Proxy-Test-77" });
    const tenter = (gauche) =>
      fetch(`${serveur.base}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": `${gauche}, 203.0.113.50`, "X-Forwarded-Proto": "https" },
        body: JSON.stringify({ identifiant: e.identifiant, motDePasse: "faux-mot-de-passe-proxy" }),
      });
    for (let i = 0; i < 8; i++) expect((await tenter(`198.51.100.${i}`)).status).toBe(401);
    // Huit échecs « venant » d'adresses forgées différentes à gauche : le compteur de l'adresse réelle les a tous comptés.
    expect((await tenter("198.51.100.99")).status).toBe(429);
  });

  it("HSTS n'est envoyé que pour une requête reçue en HTTPS (X-Forwarded-Proto transmis par nginx)", async () => {
    const http = await fetch(`${serveur.base}/api/health`);
    const https = await fetch(`${serveur.base}/api/health`, { headers: { "X-Forwarded-Proto": "https" } });
    expect(http.headers.get("strict-transport-security")).toBeNull();
    expect(https.headers.get("strict-transport-security")).toMatch(/max-age=\d+/);
  });

  it("journal : modification et suppression refusées par la base elle-même, et plus de route de suppression", async () => {
    await admin("GET", "/api/journal");
    await expect(sql.query("update journal set label = 'falsifié'")).rejects.toThrow(/ajout seul/);
    await expect(sql.query("delete from journal")).rejects.toThrow(/ajout seul/);
    expect((await admin("DELETE", "/api/journal")).status).toBe(404);
    expect((await sql.query("select count(*)::int n from journal")).rows[0].n).toBeGreaterThan(0);
  });

  it("réinitialisation : refusée en production même confirmée, aucune donnée supprimée", async () => {
    const avant = (await sql.query("select count(*)::int n from employes")).rows[0].n;
    const r = await admin("POST", "/api/data/reset", { confirmation: "RÉINITIALISER" });
    expect(r.status).toBe(403);
    expect((await sql.query("select count(*)::int n from employes")).rows[0].n).toBe(avant);
  });

  it("société : l'API ne renvoie ni identifiant ni mot de passe, même si la base en contient (valeurs héritées)", async () => {
    const s = await admin("POST", "/api/societes", { raisonSociale: "Société Synthétique", code: "SYN-1", email: "s@example.test" });
    expect(s.status).toBe(201);
    await sql.query("update societes set identifiant = 'login-herite-test', mot_de_passe = 'mdp-herite-test' where id = $1", [s.json.id]);
    const liste = await admin("GET", "/api/societes");
    expect(liste.texte).not.toContain("login-herite-test");
    expect(liste.texte).not.toContain("mdp-herite-test");
  });

  it("suppression d'une société : refusée (409) si elle porte une facture, impossible même confirmée (conservation), et rien n'est perdu", async () => {
    const s = await admin("POST", "/api/societes", { raisonSociale: "Société Facturée", code: "SYN-2" });
    await sql.query("insert into factures (societe_id, numero) values ($1, '2026-9001')", [s.json.id]);
    const refus = await admin("POST", "/api/societes/bulk-delete", { ids: [s.json.id] });
    expect(refus.status).toBe(409);
    expect(refus.json.error).toMatch(/facture/);
    const confirme = await admin("POST", "/api/societes/bulk-delete", { ids: [s.json.id], confirmationDefinitive: "SUPPRIMER DEFINITIVEMENT" });
    expect([409, 500]).toContain(confirme.status);
    expect((await sql.query("select count(*)::int n from societes where id = $1", [s.json.id])).rows[0].n).toBe(1);
    expect((await sql.query("select count(*)::int n from factures where societe_id = $1", [s.json.id])).rows[0].n).toBe(1);
  });

  it("société sans écriture à conserver : supprimée avec ses données, après confirmation non requise", async () => {
    const s = await admin("POST", "/api/societes", { raisonSociale: "Société Vide", code: "SYN-3" });
    const r = await admin("POST", "/api/societes/bulk-delete", { ids: [s.json.id] });
    expect(r.status).toBe(200);
    expect(r.json.deleted).toBe(1);
  });

  it("règlements fournisseurs simultanés : jamais plus que le solde de la facture", async () => {
    const s = await admin("POST", "/api/societes", { raisonSociale: "Société Règlements", code: "SYN-4" });
    const m = (
      await sql.query(
        "insert into stock_mouvements (societe_id, fournisseur, achat_num_facture, achat_devise) values ($1, 'SOTACIB KAIROUAN', 'FA-1', 'EUR') returning id",
        [s.json.id],
      )
    ).rows[0].id;
    await sql.query("insert into stock_lignes (mouvement_id, categorie, designation, quantite, prix_unitaire, montant_devise) values ($1, 'achat', 'Ciment', 10, 100, 1000)", [m]);
    const regler = (i) =>
      admin("POST", "/api/fournisseurs/reglements", {
        societeId: s.json.id,
        fournisseurCle: "sotacib kairouan",
        mode: "virement",
        reference: `R${i}`,
        devise: "EUR",
        affectations: [{ mouvementId: m, montant: 300 }],
      });
    const reponses = await Promise.all(Array.from({ length: 8 }, (_, i) => regler(i)));
    const reussis = reponses.filter((r) => r.status === 200).length;
    const total = Number((await sql.query("select coalesce(sum(montant),0) t from fournisseur_affectations where mouvement_id = $1", [m])).rows[0].t);
    expect(total).toBeLessThanOrEqual(1000);
    expect(reussis).toBe(3);
    expect(total).toBe(900);
  });

  it("compte de société : ne peut pas lancer l'extraction par IA (403), quel que soit le corps de la requête", async () => {
    const s = await admin("POST", "/api/societes", { raisonSociale: "Société Cliente", code: "SYN-5" });
    const c = await creerEmploye({ role: "societe_employe", societeId: s.json.id });
    await api(serveur.base)("POST", "/api/auth/activate", { token: jetonDe(c.lien), motDePasse: "Mdp-Societe-Test-55" });
    const connexion = await api(serveur.base)("POST", "/api/auth/login", { identifiant: c.identifiant, motDePasse: "Mdp-Societe-Test-55" });
    const client = api(serveur.base, connexion.json.token);
    expect((await client("POST", "/api/stock/extract", { type: "achat", dataUrl: "data:application/pdf;base64,AAAAAAAAAAAA" })).status).toBe(403);
    expect((await client("POST", "/api/stock/extract-pages", { societeId: s.json.id, dataUrl: "data:application/pdf;base64,AAAAAAAAAAAA" })).status).toBe(403);
    // Et il ne voit aucune donnée d'une autre société.
    const autre = await admin("POST", "/api/societes", { raisonSociale: "Société Autre", code: "SYN-6" });
    const vues = await client("GET", "/api/societes");
    expect(vues.texte).not.toContain(autre.json.id);
  });

  it("isolation par société (filtrage en SQL) : un collaborateur n'obtient que les sociétés qui lui sont assignées, l'administrateur toutes", async () => {
    const a = (await admin("POST", "/api/societes", { raisonSociale: "Société Isolée A", code: "ISO-A" })).json.id;
    const b = (await admin("POST", "/api/societes", { raisonSociale: "Société Isolée B", code: "ISO-B" })).json.id;
    for (const id of [a, b]) {
      await sql.query("insert into noeuds (libelle, type, societe_id) values ($1, 'dossier', $2)", [`Dossier ${id}`, id]);
      await sql.query("insert into collectes (societe_id, periode) values ($1, 'T1 2026')", [id]);
      await sql.query("insert into swift_virements (societe_id, date_operation, montant, libelle, banque, envoye) values ($1, '2026-10-01', 100, 'Virement iso', 'BIAT', true)", [id]);
    }
    const c = await creerEmploye({ societesAssignees: [a] });
    await api(serveur.base)("POST", "/api/auth/activate", { token: jetonDe(c.lien), motDePasse: "Mdp-Collab-Isole-66" });
    const connexion = await api(serveur.base)("POST", "/api/auth/login", { identifiant: c.identifiant, motDePasse: "Mdp-Collab-Isole-66" });
    const collab = api(serveur.base, connexion.json.token);
    for (const chemin of ["/api/societes", "/api/noeuds", "/api/collectes", "/api/data/bootstrap", "/api/etat-swift/resume"]) {
      const r = await collab("GET", chemin);
      expect(r.status).toBe(200);
      expect(r.texte).toContain(a);
      expect(r.texte).not.toContain(b);
      const vueAdmin = await admin("GET", chemin);
      expect(vueAdmin.texte).toContain(a);
      expect(vueAdmin.texte).toContain(b);
    }
    // Accès direct à la société voisine : refusé.
    expect((await collab("GET", `/api/etat-swift?societeId=${b}`)).status).toBe(403);
    expect((await collab("GET", `/api/collectes/${(await sql.query("select id from collectes where societe_id = $1", [b])).rows[0].id}`)).status).toBe(403);
  });

  it("redémarrage sur la même base : le schéma se réapplique sans erreur et les comptes convertis se connectent toujours", async () => {
    await serveur.arreter();
    serveur = await demarrerServeur(base.url);
    admin = await connecterAdmin(serveur.base);
    expect((await api(serveur.base)("POST", "/api/auth/login", { identifiant: "legacy.test", motDePasse: "Ancien-Mdp-Clair-77" })).status).toBe(200);
    expect(serveur.journal()).not.toMatch(/erreur|error/i);
  });
});

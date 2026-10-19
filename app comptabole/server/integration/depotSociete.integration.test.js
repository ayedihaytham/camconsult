import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { api, connecterAdmin, creerBaseJetable, demarrerServeur } from "./helpers.js";

/**
 * Dépôt de documents par le responsable (ou délégué) d'une société : il ajoute des FICHIERS dans les dossiers de SA société, rien d'autre.
 * Tests contre un vrai PostgreSQL jetable (TEST_DATABASE_URL), données synthétiques ; ignorés sans cette variable.
 */
const actif = Boolean(process.env.TEST_DATABASE_URL);
vi.setConfig({ testTimeout: 90_000, hookTimeout: 90_000 });

describe.skipIf(!actif)("intégration PostgreSQL : dépôt de documents par une société", () => {
  let base, serveur, admin, sql, client, societeA, societeB, dossierA, sousDossierA, dossierB, dossierCabinet;

  const jetonDe = (lien) => new URL(lien).searchParams.get("token");
  const fichier = (extra = {}) => ({ libelle: "facture.pdf", type: "fichier", societeId: societeA, parentId: dossierA, format: "pdf", taille: "10 Ko", ...extra });

  beforeAll(async () => {
    base = await creerBaseJetable();
    serveur = await demarrerServeur(base.url);
    admin = await connecterAdmin(serveur.base);
    sql = await base.client();
    societeA = (await admin("POST", "/api/societes", { raisonSociale: "Société Cliente A", code: "DEP-A" })).json.id;
    societeB = (await admin("POST", "/api/societes", { raisonSociale: "Société Cliente B", code: "DEP-B" })).json.id;
    const dossier = async (libelle, societeId, parentId = null, cabinetOnly = false) =>
      (await sql.query("insert into noeuds (libelle, type, societe_id, parent_id, cabinet_only) values ($1, 'dossier', $2, $3, $4) returning id", [libelle, societeId, parentId, cabinetOnly])).rows[0].id;
    dossierA = await dossier("COMPTABILITÉ 2026", societeA);
    sousDossierA = await dossier("BANQUE", societeA, dossierA);
    dossierB = await dossier("COMPTABILITÉ 2026", societeB);
    dossierCabinet = await dossier("TRAVAIL CABINET", societeA, dossierA, true);

    const n = Math.random().toString(36).slice(2, 8);
    const cree = await admin("POST", "/api/employes", { nom: "Resp", prenom: "Societe", identifiant: `r.${n}`, email: `r.${n}@example.test`, type: "Comptable", role: "societe_employe", societeId: societeA });
    expect(cree.status).toBe(201);
    await api(serveur.base)("POST", "/api/auth/activate", { token: jetonDe(cree.json.lienAcces), motDePasse: "Mdp-Societe-Depot-77" });
    const connexion = await api(serveur.base)("POST", "/api/auth/login", { identifiant: `r.${n}`, motDePasse: "Mdp-Societe-Depot-77" });
    client = api(serveur.base, connexion.json.token);
  });
  afterAll(async () => {
    await sql?.end();
    await serveur?.arreter();
    await base?.supprimer();
  });

  it("le responsable de société ajoute un fichier dans un dossier de sa société, et le cabinet le voit", async () => {
    const r = await client("POST", "/api/noeuds", fichier({ parentId: sousDossierA }));
    expect(r.status).toBe(201);
    expect(r.json).toMatchObject({ libelle: "facture.pdf", type: "fichier", societeId: societeA, parentId: sousDossierA });
    const vueAdmin = await admin("GET", "/api/noeuds");
    expect(vueAdmin.texte).toContain(r.json.id);
    const vueClient = await client("GET", "/api/noeuds");
    expect(vueClient.texte).toContain(r.json.id);
  });

  it("il ne crée aucun dossier (ni à la racine, ni dans un dossier)", async () => {
    expect((await client("POST", "/api/noeuds", { libelle: "Nouveau", type: "dossier", societeId: societeA, parentId: dossierA })).status).toBe(403);
    expect((await client("POST", "/api/noeuds", { libelle: "Nouveau", type: "dossier", societeId: societeA, parentId: null })).status).toBe(403);
  });

  it("il ne dépose pas à la racine, ni pour une autre société, ni dans un dossier réservé au cabinet", async () => {
    expect((await client("POST", "/api/noeuds", fichier({ parentId: null }))).status).toBe(403);
    expect((await client("POST", "/api/noeuds", fichier({ societeId: societeB, parentId: dossierB }))).status).toBe(403);
    // société annoncée A mais dossier de B : refusé
    expect((await client("POST", "/api/noeuds", fichier({ societeId: societeA, parentId: dossierB }))).status).toBe(403);
    expect((await client("POST", "/api/noeuds", fichier({ parentId: dossierCabinet }))).status).toBe(403);
    const total = (await sql.query("select count(*)::int n from noeuds where type = 'fichier' and libelle = 'facture.pdf'")).rows[0].n;
    expect(total).toBe(1); // seul le dépôt valide du premier test
  });

  it("il ne modifie, ne déplace ni ne supprime rien (droits de structure et de suppression inchangés)", async () => {
    const idFichier = (await sql.query("select id from noeuds where type = 'fichier' limit 1")).rows[0].id;
    expect((await client("PATCH", `/api/noeuds/${idFichier}`, { libelle: "renomme.pdf" })).status).toBe(403);
    expect((await client("POST", `/api/noeuds/${idFichier}/duplicate`, {})).status).toBe(403);
    expect((await client("POST", "/api/noeuds/bulk-delete", { ids: [idFichier] })).status).toBe(403);
    expect((await sql.query("select libelle from noeuds where id = $1", [idFichier])).rows[0].libelle).toBe("facture.pdf");
  });
});

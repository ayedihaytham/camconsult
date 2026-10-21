import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { api, connecterAdmin, creerBaseJetable, demarrerServeur } from "./helpers.js";

/**
 * Collecte « envoi par lignes » : une ligne complétée par la société part au cabinet à l'enregistrement, figée côté société, vue en vert côté
 * cabinet ; la société peut la reprendre si elle l'a complétée par erreur. Contre un vrai PostgreSQL jetable (TEST_DATABASE_URL), données
 * synthétiques ; ignoré sans cette variable.
 */
const actif = Boolean(process.env.TEST_DATABASE_URL);
vi.setConfig({ testTimeout: 90_000, hookTimeout: 90_000 });

describe.skipIf(!actif)("intégration PostgreSQL : envoi par lignes d'une collecte", () => {
  let base, serveur, admin, sql, societe, client, autreClient;
  const ONGLET = "virements_recus";
  const jetonDe = (lien) => new URL(lien).searchParams.get("token");
  const ligne = (n, extra = {}) => ({ data: { date: "2026-09-02", emetteur: `Émetteur ${n}`, reference: `VIR-${n}`, montant: 100 + n, compte_bancaire: "Banque", observations: "" }, ...extra });
  const collecte = async (envoiParLignes) => (await admin("POST", "/api/collectes", { societeId: societe, periode: `Test ${Math.random()}`, onglets: [ONGLET], envoiParLignes })).json;
  const lire = async (id) => (await admin("GET", `/api/collectes/${id}`)).json.lignes.filter((l) => l.onglet === ONGLET).sort((a, b) => a.ordre - b.ordre);

  async function compteSociete(nom) {
    const n = Math.random().toString(36).slice(2, 8);
    const cree = await admin("POST", "/api/employes", { nom: nom, prenom: "Societe", identifiant: `c.${n}`, email: `c.${n}@example.test`, type: "Comptable", role: "societe_employe", societeId: societe });
    expect(cree.status).toBe(201);
    await api(serveur.base)("POST", "/api/auth/activate", { token: jetonDe(cree.json.lienAcces), motDePasse: "Mdp-Societe-Lignes-77" });
    const connexion = await api(serveur.base)("POST", "/api/auth/login", { identifiant: `c.${n}`, motDePasse: "Mdp-Societe-Lignes-77" });
    return api(serveur.base, connexion.json.token);
  }

  beforeAll(async () => {
    base = await creerBaseJetable();
    serveur = await demarrerServeur(base.url);
    admin = await connecterAdmin(serveur.base);
    sql = await base.client();
    societe = (await admin("POST", "/api/societes", { raisonSociale: "Société Lignes", code: "LGN" })).json.id;
    client = await compteSociete("Resp");
    autreClient = await compteSociete("Deleg");
  });
  afterAll(async () => {
    await sql?.end();
    await serveur?.arreter();
    await base?.supprimer();
  });

  describe("option de la collecte", () => {
    it("le cabinet l'active à la création ou plus tard ; elle est lue dans la collecte ; la société ne peut pas la changer", async () => {
      const c = await collecte(true);
      expect(c.envoiParLignes).toBe(true);
      expect((await collecte(false)).envoiParLignes).toBe(false);
      expect((await collecte(undefined)).envoiParLignes).toBe(false);
      expect((await admin("PATCH", `/api/collectes/${c.id}`, { envoiParLignes: false })).json.envoiParLignes).toBe(false);
      expect((await admin("PATCH", `/api/collectes/${c.id}`, { envoiParLignes: true })).json.envoiParLignes).toBe(true);
      expect((await client("PATCH", `/api/collectes/${c.id}`, { envoiParLignes: false })).status).toBe(403);
    });
  });

  describe("envoi à l'enregistrement", () => {
    it("une ligne marquée complète part au cabinet (date d'envoi), les autres restent à la société ; le cabinet les voit", async () => {
      const c = await collecte(true);
      const r = await client("PUT", `/api/collectes/${c.id}/lignes/${ONGLET}`, { lignes: [ligne(1, { envoyee: true }), ligne(2), ligne(3, { envoyee: true })] });
      expect(r.status, r.texte).toBe(200);
      expect(r.json.lignes.map((l) => Boolean(l.envoyeeLe))).toEqual([true, false, true]);
      const vueCabinet = await lire(c.id);
      expect(vueCabinet.map((l) => Boolean(l.envoyeeLe))).toEqual([true, false, true]);
      // Le journal s'écrit en tâche de fond : on attend qu'il apparaisse.
      await vi.waitFor(async () => {
        expect((await sql.query("select count(*)::int n from journal where label like '2 ligne(s) envoyée(s) au cabinet%'")).rows[0].n).toBeGreaterThanOrEqual(1);
      }, { timeout: 5000, interval: 100 });
    });

    it("sans l'option, « envoyee » est ignoré : rien n'est envoyé", async () => {
      const c = await collecte(false);
      const r = await client("PUT", `/api/collectes/${c.id}/lignes/${ONGLET}`, { lignes: [ligne(1, { envoyee: true })] });
      expect(r.status).toBe(200);
      expect(r.json.lignes[0].envoyeeLe).toBeNull();
    });

    it("le cabinet ne marque pas de lignes comme envoyées par la société, et garde l'état des lignes envoyées quand il enregistre", async () => {
      const c = await collecte(true);
      const r = await client("PUT", `/api/collectes/${c.id}/lignes/${ONGLET}`, { lignes: [ligne(1, { envoyee: true }), ligne(2)] });
      const [envoyee, autre] = r.json.lignes;
      const parCabinet = await admin("PUT", `/api/collectes/${c.id}/lignes/${ONGLET}`, {
        lignes: [{ id: envoyee.id, data: { ...envoyee.data, observations: "contrôlé" }, ordre: 0 }, { id: autre.id, data: autre.data, ordre: 1, envoyee: true }, ligne(3, { envoyee: true })],
      });
      expect(parCabinet.status, parCabinet.texte).toBe(200);
      const lignes = parCabinet.json.lignes;
      expect(lignes[0].data.observations).toBe("contrôlé"); // le cabinet peut corriger
      expect(lignes[0].envoyeeLe).toBeTruthy(); // et l'envoi est conservé
      expect(lignes[1].envoyeeLe).toBeNull(); // « envoyee » ne vaut que pour la société
      expect(lignes[2].envoyeeLe).toBeNull();
      expect(lignes[0].id).toBe(envoyee.id); // identifiants stables
    });
  });

  describe("ligne envoyée : figée pour la société", () => {
    it("elle doit revenir telle quelle ; la modifier ou la retirer est refusé, les autres lignes restent modifiables", async () => {
      const c = await collecte(true);
      const premier = await client("PUT", `/api/collectes/${c.id}/lignes/${ONGLET}`, { lignes: [ligne(1, { envoyee: true }), ligne(2)] });
      const [figee, libre] = premier.json.lignes;
      const url = `/api/collectes/${c.id}/lignes/${ONGLET}`;
      // modifier la ligne figée
      const modif = await client("PUT", url, { lignes: [{ id: figee.id, data: { ...figee.data, montant: 999 } }, { id: libre.id, data: libre.data }] });
      expect(modif.status).toBe(400);
      expect(modif.json.error).toMatch(/déjà envoyée au cabinet/);
      // la retirer
      expect((await client("PUT", url, { lignes: [{ id: libre.id, data: libre.data }] })).status).toBe(400);
      // la renvoyer sans identifiant (ancienne version de l'écran)
      expect((await client("PUT", url, { lignes: [{ data: figee.data }, { data: libre.data }] })).status).toBe(400);
      // modifier seulement l'autre ligne, et en ajouter une : accepté, la ligne figée est inchangée
      const ok = await client("PUT", url, { lignes: [{ id: figee.id, data: figee.data }, { id: libre.id, data: { ...libre.data, montant: 555 } }, ligne(3)] });
      expect(ok.status, ok.texte).toBe(200);
      expect(ok.json.lignes[0]).toMatchObject({ id: figee.id });
      expect(ok.json.lignes[0].data.montant).toBe(figee.data.montant);
      expect(ok.json.lignes[1].data.montant).toBe(555);
      expect(ok.json.lignes).toHaveLength(3);
    });

    it("le texte envoyé pour une ligne figée est ignoré : c'est l'enregistrement du serveur qui fait foi", async () => {
      const c = await collecte(true);
      const premier = await client("PUT", `/api/collectes/${c.id}/lignes/${ONGLET}`, { lignes: [ligne(1, { envoyee: true })] });
      const figee = premier.json.lignes[0];
      const r = await client("PUT", `/api/collectes/${c.id}/lignes/${ONGLET}`, { lignes: [{ id: figee.id, data: figee.data, envoyee: false }] });
      expect(r.status).toBe(200);
      expect(r.json.lignes[0].envoyeeLe).toBeTruthy(); // « envoyee: false » ne reprend pas la ligne
    });
  });

  describe("reprendre une ligne", () => {
    it("la société reprend une ligne envoyée par erreur : elle redevient modifiable, et le cabinet ne la voit plus en vert", async () => {
      const c = await collecte(true);
      const premier = await client("PUT", `/api/collectes/${c.id}/lignes/${ONGLET}`, { lignes: [ligne(1, { envoyee: true })] });
      const figee = premier.json.lignes[0];
      const r = await autreClient("POST", `/api/collectes/${c.id}/lignes/${ONGLET}/${figee.id}/reprendre`, {});
      expect(r.status, r.texte).toBe(200);
      expect(r.json.ligne.envoyeeLe).toBeNull();
      expect((await lire(c.id))[0].envoyeeLe).toBeNull();
      const modif = await client("PUT", `/api/collectes/${c.id}/lignes/${ONGLET}`, { lignes: [{ id: figee.id, data: { ...figee.data, montant: 42 } }] });
      expect(modif.status).toBe(200);
      expect(modif.json.lignes[0].data.montant).toBe(42);
    });

    it("reprendre une ligne non envoyée : 404 ; le cabinet ne passe pas par cette route ; un identifiant invalide : 400", async () => {
      const c = await collecte(true);
      const premier = await client("PUT", `/api/collectes/${c.id}/lignes/${ONGLET}`, { lignes: [ligne(1), ligne(2, { envoyee: true })] });
      const [libre, figee] = premier.json.lignes;
      expect((await client("POST", `/api/collectes/${c.id}/lignes/${ONGLET}/${libre.id}/reprendre`, {})).status).toBe(404);
      expect((await admin("POST", `/api/collectes/${c.id}/lignes/${ONGLET}/${figee.id}/reprendre`, {})).status).toBe(403);
      expect((await client("POST", `/api/collectes/${c.id}/lignes/${ONGLET}/pas-un-uuid/reprendre`, {})).status).toBe(400);
      expect((await lire(c.id))[1].envoyeeLe).toBeTruthy();
    });

    it("une fois le tableau transmis, la ligne ne peut plus être reprise (le tableau est verrouillé pour la société)", async () => {
      const c = await collecte(true);
      const premier = await client("PUT", `/api/collectes/${c.id}/lignes/${ONGLET}`, { lignes: [ligne(1, { envoyee: true })] });
      const figee = premier.json.lignes[0];
      await sql.query("update collecte_sections set statut = 'transmis' where collecte_id = $1 and onglet = $2", [c.id, ONGLET]);
      const r = await client("POST", `/api/collectes/${c.id}/lignes/${ONGLET}/${figee.id}/reprendre`, {});
      expect(r.status).toBe(400);
      expect((await lire(c.id))[0].envoyeeLe).toBeTruthy();
    });
  });
});

import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { creerPkcs12DeTest } from "../signature/fixtures/certificatDeTest.js";
import { demarrerFauxTtn } from "../ttn/fixtures/fauxTtn.js";
import { connecterAdmin, creerBaseJetable, demarrerServeur } from "./helpers.js";

/**
 * Dépôt chez TTN contre un VRAI PostgreSQL jetable, le vrai serveur et un FAUX service TTN local (SOAP). Certificat et données synthétiques.
 * Le faux service fixe le contrat supposé ; il ne prouve pas le comportement du vrai service. Exige TEST_DATABASE_URL ; sinon ignoré.
 */
const actif = Boolean(process.env.TEST_DATABASE_URL);
vi.setConfig({ testTimeout: 180_000, hookTimeout: 180_000 });

describe.skipIf(!actif)("intégration PostgreSQL : dépôt chez TTN (faux service)", () => {
  const SECRET = randomBytes(32).toString("hex");
  const { p12, motDePasse } = creerPkcs12DeTest();
  let base;
  let serveur;
  let ttn;
  let admin;
  let sql;
  let societeId;

  async function factureSignee() {
    const id = (
      await admin("POST", "/api/facturation", {
        societeId, dateEmission: "2026-10-17", echeance: "2026-11-16", tvaTaux: 19, timbre: 1, note: "",
        lignes: [{ description: "Honoraires", quantite: 1, montantHt: 500 }],
      })
    ).json.id;
    expect((await admin("POST", `/api/facturation/${id}/einvoice/preparer`)).status).toBe(201);
    expect((await admin("POST", `/api/facturation/${id}/einvoice/signer`)).status).toBe(200);
    return id;
  }
  const numeroDe = async (id) => (await sql.query("select numero from factures where id = $1", [id])).rows[0].numero;
  const ligne = async (id) => (await sql.query("select * from facture_einvoice where facture_id = $1", [id])).rows[0];
  const liste = async (id) => (await admin("GET", "/api/facturation")).json.find((f) => f.id === id);

  beforeAll(async () => {
    ttn = await demarrerFauxTtn();
    base = await creerBaseJetable();
    serveur = await demarrerServeur(base.url, { SIGNATURE_CLE_SECRET: SECRET, TTN_AUTORISER_LOCAL: "true" });
    admin = await connecterAdmin(serveur.base);
    sql = await base.client();
    societeId = (await admin("POST", "/api/societes", { raisonSociale: "CLIENT EXEMPLE SARL", code: "TT-1", rne: "RNE-1", tva: "7654321KAM000", adresse: "2 Avenue Exemple" })).json.id;
    await admin("PUT", "/api/facturation/cabinet", {
      adresse: "1 Rue Exemple, Tunis", matriculeFiscal: "1234567ABM000", telephone: "", email: "", rib: "00 000 0000000000000 00", mentions: "",
      raisonSociale: "CABINET EXEMPLE", rue: "Rue Exemple", ville: "Tunis", codePostal: "1000", pays: "TN", rc: "",
    });
    await admin("PATCH", `/api/societes/${societeId}`, { adresseRue: "Avenue Exemple", ville: "Sfax", codePostal: "3000", pays: "TN" });
    expect((await admin("PUT", "/api/facturation/signature/certificat", { fichier: p12.toString("base64"), motDePasse })).status).toBe(200);
  });
  afterAll(async () => {
    await sql?.end();
    await serveur?.arreter();
    await base?.supprimer();
    await ttn?.arreter();
  });

  it("sans accès enregistrés : état vide, essai et dépôt refusés (409)", async () => {
    expect((await admin("GET", "/api/facturation/ttn")).json).toMatchObject({ configuree: true, connexion: null });
    expect((await admin("POST", "/api/facturation/ttn/tester")).json.code).toBe("SANS_CONNEXION");
    const id = await factureSignee();
    const r = await admin("POST", `/api/facturation/${id}/einvoice/deposer`);
    expect(r.status).toBe(409);
    expect(r.json.code).toBe("SANS_CONNEXION");
    expect((await ligne(id)).statut).toBe("signee");
  });

  it("enregistrement des accès : validations, mot de passe chiffré en base et jamais renvoyé", async () => {
    expect((await admin("PUT", "/api/facturation/ttn", { url: "pas une adresse", login: "x", motDePasse: "y" })).status).toBe(400);
    expect((await admin("PUT", "/api/facturation/ttn", { url: ttn.url, login: "", motDePasse: "y" })).status).toBe(400);
    expect((await admin("PUT", "/api/facturation/ttn", { url: ttn.url, login: ttn.login })).json.code).toBe("MOT_DE_PASSE"); // premier enregistrement sans mot de passe

    const r = await admin("PUT", "/api/facturation/ttn", { url: ttn.url, login: ttn.login, motDePasse: ttn.motDePasse, environnement: "test" });
    expect(r.status).toBe(200);
    expect(r.json.connexion).toMatchObject({ url: ttn.url, login: ttn.login, environnement: "test", motDePasseDefini: true });
    expect(r.texte).not.toContain(ttn.motDePasse);
    const enBase = (await sql.query("select * from ttn_connexion")).rows[0];
    expect(Buffer.from(enBase.mdp_chiffre).toString("latin1")).not.toContain(ttn.motDePasse);
    expect(JSON.stringify(enBase)).not.toContain(ttn.motDePasse);
    expect((await admin("GET", "/api/facturation/ttn")).texte).not.toContain(ttn.motDePasse);
  });

  it("essai de connexion : réussi avec les bons accès ; mauvais mot de passe → message clair sans le mot de passe ; modification sans retaper le mot de passe", async () => {
    expect((await admin("GET", "/api/facturation/ttn")).json.connexion.dernierEssai).toBeNull(); // accès jamais essayés
    expect((await admin("POST", "/api/facturation/ttn/tester")).json).toMatchObject({ ok: true, environnement: "test" });
    expect((await admin("GET", "/api/facturation/ttn")).json.connexion.dernierEssai).toMatchObject({ ok: true });
    await admin("PUT", "/api/facturation/ttn", { url: ttn.url, login: ttn.login, motDePasse: "mauvais-mdp-ttn-5521" });
    const refus = await admin("POST", "/api/facturation/ttn/tester");
    expect(refus.status).toBe(502);
    expect(refus.json.code).toBe("FAULT");
    expect(refus.texte).not.toContain("mauvais-mdp-ttn-5521");
    expect((await admin("GET", "/api/facturation/ttn")).json.connexion.dernierEssai).toMatchObject({ ok: false }); // l'échec est mémorisé
    // changer l'environnement sans ressaisir le mot de passe conserve le mot de passe enregistré (ici : le mauvais)
    await admin("PUT", "/api/facturation/ttn", { url: ttn.url, login: ttn.login, environnement: "reel" });
    expect((await admin("GET", "/api/facturation/ttn")).json.connexion.environnement).toBe("reel");
    expect((await admin("POST", "/api/facturation/ttn/tester")).status).toBe(502);
    // retour aux bons accès : le résultat du dernier essai est remis à zéro (nouveaux accès, jamais essayés)
    await admin("PUT", "/api/facturation/ttn", { url: ttn.url, login: ttn.login, motDePasse: ttn.motDePasse, environnement: "test" });
    expect((await admin("GET", "/api/facturation/ttn")).json.connexion.dernierEssai).toBeNull();
    expect((await admin("POST", "/api/facturation/ttn/tester")).json.ok).toBe(true);
  });

  it("une facture seulement préparée ne se dépose pas ; signée, elle se dépose avec les octets exacts et le matricule du cabinet", async () => {
    const id = (
      await admin("POST", "/api/facturation", { societeId, dateEmission: "2026-10-17", echeance: "2026-11-16", tvaTaux: 19, timbre: 1, note: "", lignes: [{ description: "H", quantite: 1, montantHt: 100 }] })
    ).json.id;
    await admin("POST", `/api/facturation/${id}/einvoice/preparer`);
    expect((await admin("POST", `/api/facturation/${id}/einvoice/deposer`)).json.code).toBe("NON_SIGNEE");

    await admin("POST", `/api/facturation/${id}/einvoice/signer`);
    const avant = ttn.appels("saveEfact").length;
    const r = await admin("POST", `/api/facturation/${id}/einvoice/deposer`);
    expect(r.status).toBe(200);
    expect(r.json.einvoice.statut).toBe("deposee");
    const l = await ligne(id);
    expect(l.statut).toBe("deposee");
    expect(l.ttn_message).toBe("Facture reçue");
    expect(l.depose_le).toBeTruthy();
    const appel = ttn.appels("saveEfact").at(-1);
    expect(ttn.appels("saveEfact").length).toBe(avant + 1);
    expect(appel).toMatchObject({ numero: await numeroDe(id), matricule: "1234567ABM000", octets: Buffer.byteLength(l.teif_signe_xml) });
    // aucun second dépôt possible
    expect((await admin("POST", `/api/facturation/${id}/einvoice/deposer`)).json.code).toBe("DEJA_DEPOSEE");
    expect(ttn.appels("saveEfact").length).toBe(avant + 1);
  });

  it("validation par TTN : référence, date et QR officiel enregistrés, XML validé téléchargeable, tout est figé", async () => {
    const id = (await sql.query("select facture_id from facture_einvoice where statut = 'deposee' limit 1")).rows[0].facture_id;
    const numero = await numeroDe(id);
    expect((await admin("POST", `/api/facturation/${id}/einvoice/actualiser`)).json.einvoice.statut).toBe("deposee"); // TTN n'a pas encore statué
    ttn.valider(numero, "REF-TTN-0001");
    const r = await admin("POST", `/api/facturation/${id}/einvoice/actualiser`);
    expect(r.json.einvoice).toMatchObject({ statut: "validee", refTtn: "REF-TTN-0001", refTtnDate: "2026-10-17T10:42:00.000Z" });
    expect(r.json.einvoice.qrPng).toMatch(/^iVBORw0KGgo/);

    const l = await ligne(id);
    expect(l.ttn_xml).toContain("<RefTtnVal>");
    const f = await liste(id);
    expect(f.einvoice).toMatchObject({ statut: "validee", refTtn: "REF-TTN-0001" });
    expect(f.einvoice.qrPng).toBeTruthy();

    const dl = await admin("GET", `/api/facturation/${id}/einvoice/xml?version=ttn`);
    expect(dl.status).toBe(200);
    expect(dl.texte).toContain("<RefTtnVal>");

    await expect(sql.query("update facture_einvoice set ttn_xml = 'x' where facture_id = $1", [id])).rejects.toThrow(/ne peut plus être modifiée/);
    await expect(sql.query("update facture_einvoice set teif_signe_xml = 'x' where facture_id = $1", [id])).rejects.toThrow(/ne peut plus être modifiée/);
    expect((await admin("PATCH", `/api/facturation/${id}`, { statut: "annulee" })).status).toBe(409);
    expect((await admin("POST", `/api/facturation/${id}/einvoice/rouvrir`)).json.code).toBe("NON_REJETEE");
    expect((await admin("PUT", `/api/facturation/${id}`, { societeId, lignes: [{ description: "H", montantHt: 1 }] })).status).toBe(409);
  });

  it("rejet par TTN : acquittements enregistrés ; réouverture, correction, nouvelle signature et nouveau dépôt acceptés", async () => {
    const id = await factureSignee();
    const numero = await numeroDe(id);
    expect((await admin("POST", `/api/facturation/${id}/einvoice/deposer`)).status).toBe(200);
    ttn.rejeter(numero, ["Matricule fiscal du client invalide", "Date incohérente"]);
    const r = await admin("POST", `/api/facturation/${id}/einvoice/actualiser`);
    expect(r.json.einvoice.statut).toBe("rejetee");
    expect(r.json.einvoice.acquittements).toEqual([{ message: "Matricule fiscal du client invalide" }, { message: "Date incohérente" }]);
    expect((await admin("POST", `/api/facturation/${id}/einvoice/deposer`)).json.code).toBe("REJETEE");

    // réouverture : la signature et le dépôt sont effacés, la facture redevient modifiable
    expect((await admin("POST", `/api/facturation/${id}/einvoice/rouvrir`)).json.einvoice.statut).toBe("prete");
    const l = await ligne(id);
    expect([l.teif_signe_xml, l.signe_le, l.depose_le, l.ttn_message, l.ttn_acquittements]).toEqual([null, null, null, null, null]);
    expect((await admin("PUT", `/api/facturation/${id}`, { societeId, dateEmission: "2026-10-18", echeance: "2026-11-17", tvaTaux: 19, timbre: 1, note: "corrigée", lignes: [{ description: "Honoraires corrigés", quantite: 1, montantHt: 600 }] })).status).toBe(200);
    expect((await admin("POST", `/api/facturation/${id}/einvoice/regenerer`)).status).toBe(200);
    expect((await admin("POST", `/api/facturation/${id}/einvoice/signer`)).status).toBe(200);
    // TTN connaît ce numéro comme REJETÉ : le redépôt est permis (il remet son traitement à zéro dans le faux service)
    const avant = ttn.appels("saveEfact").length;
    expect((await admin("POST", `/api/facturation/${id}/einvoice/deposer`)).status).toBe(200);
    expect(ttn.appels("saveEfact").length).toBe(avant + 1);
    expect((await ligne(id)).statut).toBe("deposee");
  });

  it("anti-doublon : un numéro que TTN connaît déjà n'est jamais redéposé", async () => {
    const id = await factureSignee();
    const numero = await numeroDe(id);
    ttn.etat.factures.set(numero, { xml: "<TEIF><ds:Signature/></TEIF>", etat: "attente", ref: "", acquittements: [] });
    const avant = ttn.appels("saveEfact").length;
    const r = await admin("POST", `/api/facturation/${id}/einvoice/deposer`);
    expect(r.status).toBe(200);
    expect(ttn.appels("saveEfact").length).toBe(avant);
    const l = await ligne(id);
    expect(l.statut).toBe("deposee");
    expect(l.ttn_message).toMatch(/déjà connue de TTN/);
  });

  it("coupure du service : la facture reste « signée », l'erreur est enregistrée, un nouvel essai réussit", async () => {
    const id = await factureSignee();
    ttn.etat.comportement.depot = "panne";
    const r = await admin("POST", `/api/facturation/${id}/einvoice/deposer`);
    expect(r.status).toBe(502);
    expect(r.json.code).toBe("RESEAU");
    const l = await ligne(id);
    expect(l.statut).toBe("signee");
    expect(l.ttn_derniere_erreur).toMatch(/Impossible de joindre/);
    ttn.etat.comportement.depot = "ok";
    expect((await admin("POST", `/api/facturation/${id}/einvoice/deposer`)).status).toBe(200);
    expect((await ligne(id)).ttn_derniere_erreur).toBeNull();
  });

  it("actualisation globale (même passage que le suivi automatique) : valide les factures déposées en une fois", async () => {
    const deposees = (await sql.query("select f.numero from facture_einvoice e join factures f on f.id = e.facture_id where e.statut = 'deposee'")).rows.map((r) => r.numero);
    expect(deposees.length).toBeGreaterThanOrEqual(2);
    for (const n of deposees) ttn.valider(n, `REF-${n}`);
    const r = await admin("POST", "/api/facturation/ttn/actualiser");
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ verifiees: deposees.length, changees: deposees.length, erreur: null });
    expect((await sql.query("select count(*)::int n from facture_einvoice where statut = 'deposee'")).rows[0].n).toBe(0);
  });

  it("historique d'une facture : le journal filtré sur elle, du plus récent au plus ancien, sans secret", async () => {
    const id = (await sql.query("select facture_id from facture_einvoice where statut = 'validee' limit 1")).rows[0].facture_id;
    const r = await admin("GET", `/api/facturation/${id}/journal`);
    expect(r.status).toBe(200);
    const labels = r.json.map((e) => e.label).join(" | ");
    expect(labels).toContain("facture électronique préparée");
    expect(labels).toContain("facture électronique signée");
    expect(labels).toContain("déposée chez TTN");
    expect(labels).toContain("validée par TTN");
    expect(new Date(r.json[0].at).getTime()).toBeGreaterThanOrEqual(new Date(r.json.at(-1).at).getTime());
    expect(r.json[0]).toMatchObject({ actor: expect.any(String), action: expect.any(String) });
    for (const secret of [ttn.motDePasse, SECRET]) expect(r.texte).not.toContain(secret);
    expect((await admin("GET", "/api/facturation/pas-un-uuid/journal")).status).toBe(400);
  });

  it("échéance antérieure à l'émission : refusée à la création comme à la modification (400)", async () => {
    const corps = { societeId, dateEmission: "2026-10-18", echeance: "2026-10-01", tvaTaux: 19, timbre: 1, note: "", lignes: [{ description: "H", quantite: 1, montantHt: 100 }] };
    const refus = await admin("POST", "/api/facturation", corps);
    expect(refus.status).toBe(400);
    expect(refus.json.error).toMatch(/échéance/);
    const id = (await admin("POST", "/api/facturation", { ...corps, echeance: "2026-11-01" })).json.id;
    expect((await admin("PUT", `/api/facturation/${id}`, corps)).status).toBe(400);
    expect((await admin("PUT", `/api/facturation/${id}`, { ...corps, echeance: "2026-10-18" })).status).toBe(200); // le même jour reste permis
  });

  it("une facture rejetée peut être annulée (elle n'a jamais été acceptée)", async () => {
    const id = await factureSignee();
    await admin("POST", `/api/facturation/${id}/einvoice/deposer`);
    ttn.rejeter(await numeroDe(id));
    await admin("POST", `/api/facturation/${id}/einvoice/actualiser`);
    expect((await ligne(id)).statut).toBe("rejetee");
    expect((await admin("PATCH", `/api/facturation/${id}`, { statut: "annulee" })).status).toBe(200);
  });

  it("le journal trace les opérations sans aucun mot de passe ; suppression des accès", async () => {
    const textes = (await sql.query("select label from journal where label ilike '%TTN%' order by id")).rows.map((r) => r.label).join("\n");
    expect(textes).toContain("Accès TTN enregistrés");
    expect(textes).toContain("déposée chez TTN");
    expect(textes).toContain("validée par TTN");
    expect(textes).toContain("rejetée par TTN");
    expect(textes).toContain("rouverte après rejet TTN");
    for (const secret of [ttn.motDePasse, "mauvais-mdp-ttn-5521", SECRET, motDePasse]) {
      expect(textes).not.toContain(secret);
      expect(serveur.journal()).not.toContain(secret);
    }
    const r = await admin("DELETE", "/api/facturation/ttn");
    expect(r.json.connexion).toBeNull();
    expect((await sql.query("select count(*)::int n from ttn_connexion")).rows[0].n).toBe(0);
  });
});

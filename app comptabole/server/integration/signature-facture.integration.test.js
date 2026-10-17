import { createHash, randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { creerPkcs12DeTest, MOT_DE_PASSE_TEST } from "../signature/fixtures/certificatDeTest.js";
import { connecterAdmin, creerBaseJetable, demarrerServeur } from "./helpers.js";

/**
 * Signature de la facture électronique contre un VRAI PostgreSQL jetable et le vrai serveur (processus séparé), certificat SYNTHÉTIQUE.
 * Exige TEST_DATABASE_URL (serveur de test local) ; sans elle, ignoré.
 */
const actif = Boolean(process.env.TEST_DATABASE_URL);
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

describe.skipIf(!actif)("intégration PostgreSQL : signature de la facture électronique", () => {
  const SECRET = randomBytes(32).toString("hex");
  const { p12, motDePasse } = creerPkcs12DeTest();
  const fichier = p12.toString("base64");
  let base;
  let serveur;
  let admin;
  let sql;
  let societeId;
  const factures = [];

  const nouvelleFacture = async () =>
    (
      await admin("POST", "/api/facturation", {
        societeId,
        dateEmission: "2026-10-17",
        echeance: "2026-11-16",
        tvaTaux: 19,
        timbre: 1,
        note: "",
        lignes: [{ description: "Honoraires", quantite: 1, montantHt: 500 }],
      })
    ).json.id;

  beforeAll(async () => {
    base = await creerBaseJetable();
    serveur = await demarrerServeur(base.url, { SIGNATURE_CLE_SECRET: SECRET });
    admin = await connecterAdmin(serveur.base);
    sql = await base.client();
    societeId = (
      await admin("POST", "/api/societes", { raisonSociale: "CLIENT EXEMPLE SARL", code: "SG-1", rne: "RNE-1", tva: "7654321KAM000", adresse: "2 Avenue Exemple" })
    ).json.id;
    await admin("PUT", "/api/facturation/cabinet", {
      adresse: "1 Rue Exemple, Tunis", matriculeFiscal: "1234567ABM000", telephone: "", email: "", rib: "00 000 0000000000000 00", mentions: "",
      raisonSociale: "CABINET EXEMPLE", rue: "Rue Exemple", ville: "Tunis", codePostal: "1000", pays: "TN", rc: "",
    });
    await admin("PATCH", `/api/societes/${societeId}`, { adresseRue: "Avenue Exemple", ville: "Sfax", codePostal: "3000", pays: "TN" });
    for (let i = 0; i < 3; i++) {
      const id = await nouvelleFacture();
      expect((await admin("POST", `/api/facturation/${id}/einvoice/preparer`)).status).toBe(201);
      factures.push(id);
    }
  });
  afterAll(async () => {
    await sql?.end();
    await serveur?.arreter();
    await base?.supprimer();
  });

  it("état initial : signature activée côté serveur, aucun certificat, verrouillée", async () => {
    const r = await admin("GET", "/api/facturation/signature");
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ configuree: true, certificat: null, deverrouille: false, expireLe: null });
  });

  it("sans certificat ni déverrouillage : refus 409 et rien n'est modifié", async () => {
    const r = await admin("POST", `/api/facturation/${factures[0]}/einvoice/signer`);
    expect(r.status).toBe(409);
    expect(r.json.code).toBe("SIGNATURE_VERROUILLEE");
    expect((await sql.query("select statut from facture_einvoice where facture_id = $1", [factures[0]])).rows[0].statut).toBe("prete");
    expect((await admin("POST", "/api/facturation/signature/deverrouiller", { motDePasse })).json.code).toBe("SANS_CERTIFICAT");
  });

  it("mauvais mot de passe au chargement : refus 422, rien d'enregistré, mot de passe jamais répété", async () => {
    const r = await admin("PUT", "/api/facturation/signature/certificat", { fichier, motDePasse: "mauvais-mdp-7391" });
    expect(r.status).toBe(422);
    expect(r.json.code).toBe("MOT_DE_PASSE");
    expect(r.texte).not.toContain("mauvais-mdp-7391");
    expect((await sql.query("select count(*)::int n from signature_certificat")).rows[0].n).toBe(0);
  });

  it("chargement du certificat : chiffré en base, ni le mot de passe ni le fichier en clair, signature déverrouillée", async () => {
    const r = await admin("PUT", "/api/facturation/signature/certificat", { fichier, motDePasse });
    expect(r.status).toBe(200);
    expect(r.json.certificat).toMatchObject({ sujet: expect.stringContaining("CN=CABINET DE TEST"), expire: false });
    expect(r.json.deverrouille).toBe(true);
    expect(r.texte).not.toContain(motDePasse);
    expect(r.texte).not.toContain(fichier.slice(0, 40));

    const ligne = (await sql.query("select * from signature_certificat")).rows[0];
    const enBase = Buffer.from(ligne.p12_chiffre);
    expect(enBase.includes(p12.subarray(0, 24))).toBe(false); // le début du fichier n'apparaît pas en clair
    expect(enBase.toString("latin1")).not.toContain(motDePasse);
    expect(JSON.stringify(ligne)).not.toContain(motDePasse);
    expect(ligne.empreinte).toMatch(/^[0-9a-f]{64}$/);
  });

  it("signature : statut « signée », message signé enregistré avec son empreinte, retirer le bloc redonne le message préparé", async () => {
    const r = await admin("POST", `/api/facturation/${factures[0]}/einvoice/signer`);
    expect(r.status).toBe(200);
    expect(r.json.einvoice).toMatchObject({ statut: "signee" });
    expect(r.json.einvoice.signeLe).toBeTruthy();

    const e = (await sql.query("select * from facture_einvoice where facture_id = $1", [factures[0]])).rows[0];
    expect(e.statut).toBe("signee");
    expect(e.teif_signe_sha256).toBe(createHash("sha256").update(e.teif_signe_xml, "utf8").digest("hex"));
    expect(e.teif_signe_xml.replace(/<ds:Signature[\s\S]*<\/ds:Signature>/, "")).toBe(e.teif_xml);
    expect(e.teif_signe_xml).toContain('<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="SigFrs">');
    expect(e.signe_empreinte_certificat).toMatch(/^[0-9a-f]{64}$/);

    const liste = (await admin("GET", "/api/facturation")).json.find((f) => f.id === factures[0]);
    expect(liste.einvoice).toMatchObject({ statut: "signee" });
    expect(JSON.stringify(liste)).not.toContain("<TEIF");
  });

  it("téléchargement : le message signé par défaut, le message sans signature à la demande", async () => {
    const signe = await admin("GET", `/api/facturation/${factures[0]}/einvoice/xml`);
    expect(signe.status).toBe(200);
    expect(signe.texte).toContain("<ds:Signature");
    expect(signe.entetes.get("content-disposition")).toBe('attachment; filename="2026-0001.xml"');
    const brut = await admin("GET", `/api/facturation/${factures[0]}/einvoice/xml?version=non-signe`);
    expect(brut.texte).not.toContain("<ds:Signature");
    expect(brut.entetes.get("content-disposition")).toBe('attachment; filename="2026-0001-non-signe.xml"');
    expect((await admin("GET", `/api/facturation/${factures[0]}/einvoice/xml?version=inconnue`)).status).toBe(400);
    expect((await admin("GET", `/api/facturation/${factures[1]}/einvoice/xml?version=signe`)).status).toBe(404);
    const preparee = await admin("GET", `/api/facturation/${factures[1]}/einvoice/xml`);
    expect(preparee.texte).not.toContain("<ds:Signature"); // pas encore signée : le message préparé
  });

  it("une facture signée est figée : ni nouvelle signature, ni régénération, ni annulation, ni modification directe en base", async () => {
    const id = factures[0];
    expect((await admin("POST", `/api/facturation/${id}/einvoice/signer`)).json.code).toBe("DEJA_SIGNEE");
    expect((await admin("POST", `/api/facturation/${id}/einvoice/regenerer`)).status).toBe(409);
    expect((await admin("PATCH", `/api/facturation/${id}`, { statut: "annulee" })).status).toBe(409);
    await expect(sql.query("update facture_einvoice set teif_xml = teif_xml || ' ' where facture_id = $1", [id])).rejects.toThrow(/ne peut plus être modifiée/);
    await expect(sql.query("update facture_einvoice set teif_signe_xml = 'x' where facture_id = $1", [id])).rejects.toThrow(/ne peut plus être modifiée/);
    await expect(sql.query("delete from factures where id = $1", [id])).rejects.toThrow(/violates foreign key/);
  });

  it("les données ont changé depuis la préparation : refus 409, régénération puis signature réussie", async () => {
    const id = factures[1];
    await admin("PATCH", `/api/societes/${societeId}`, { ville: "Sousse" });
    const refus = await admin("POST", `/api/facturation/${id}/einvoice/signer`);
    expect(refus.status).toBe(409);
    expect(refus.json.code).toBe("A_REGENERER");
    expect((await sql.query("select statut from facture_einvoice where facture_id = $1", [id])).rows[0].statut).toBe("prete");
    expect((await admin("POST", `/api/facturation/${id}/einvoice/regenerer`)).status).toBe(200);
    expect((await admin("POST", `/api/facturation/${id}/einvoice/signer`)).status).toBe(200);
    expect((await sql.query("select teif_signe_xml from facture_einvoice where facture_id = $1", [id])).rows[0].teif_signe_xml).toContain("<CityName>Sousse</CityName>");
  });

  it("verrouillage : la signature redevient impossible tant que le mot de passe n'est pas ressaisi", async () => {
    expect((await admin("POST", "/api/facturation/signature/verrouiller")).json.deverrouille).toBe(false);
    const id = factures[2];
    expect((await admin("POST", `/api/facturation/${id}/einvoice/signer`)).json.code).toBe("SIGNATURE_VERROUILLEE");
    const ok = await admin("POST", "/api/facturation/signature/deverrouiller", { motDePasse });
    expect(ok.status).toBe(200);
    expect(ok.json.deverrouille).toBe(true);
    expect(new Date(ok.json.expireLe).getTime()).toBeGreaterThan(Date.now() + 10 * 60 * 1000);
    await admin("POST", "/api/facturation/signature/verrouiller");
  });

  it("essais limités : après 5 mots de passe incorrects, même le bon est refusé (429)", async () => {
    for (let i = 0; i < 5; i++) {
      const r = await admin("POST", "/api/facturation/signature/deverrouiller", { motDePasse: `faux-${i}-7391` });
      expect(r.status).toBe(422);
    }
    const bloque = await admin("POST", "/api/facturation/signature/deverrouiller", { motDePasse });
    expect(bloque.status).toBe(429);
    expect(bloque.json.code).toBe("TROP_ESSAIS");
  });

  it("le mot de passe n'apparaît ni dans le journal d'activité ni dans les journaux du serveur ; les actions sont tracées", async () => {
    const lignes = (await sql.query("select action, label from journal where label ilike '%signature%' or label ilike '%facture électronique%' order by id")).rows;
    const textes = lignes.map((l) => l.label).join("\n");
    expect(textes).toContain("Certificat de signature électronique chargé");
    expect(textes).toContain("facture électronique signée");
    expect(textes).toContain("Signature électronique verrouillée");
    for (const secret of [motDePasse, MOT_DE_PASSE_TEST, "mauvais-mdp-7391", "faux-0-7391", SECRET, fichier.slice(0, 40)]) {
      expect(textes).not.toContain(secret);
      expect(serveur.journal()).not.toContain(secret);
    }
  });

  it("suppression du certificat : plus rien en base, signature verrouillée ; les factures déjà signées restent intactes", async () => {
    const r = await admin("DELETE", "/api/facturation/signature/certificat");
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ certificat: null, deverrouille: false });
    expect((await sql.query("select count(*)::int n from signature_certificat")).rows[0].n).toBe(0);
    expect((await sql.query("select count(*)::int n from facture_einvoice where statut = 'signee'")).rows[0].n).toBe(2);
  });
});

describe.skipIf(!actif)("intégration PostgreSQL : signature désactivée (SIGNATURE_CLE_SECRET absent)", () => {
  let base;
  let serveur;
  let admin;

  beforeAll(async () => {
    base = await creerBaseJetable();
    serveur = await demarrerServeur(base.url, { SIGNATURE_CLE_SECRET: "" });
    admin = await connecterAdmin(serveur.base);
  });
  afterAll(async () => {
    await serveur?.arreter();
    await base?.supprimer();
  });

  it("l'état annonce que la signature n'est pas activée et le chargement d'un certificat est refusé (503)", async () => {
    expect((await admin("GET", "/api/facturation/signature")).json.configuree).toBe(false);
    const { p12, motDePasse } = creerPkcs12DeTest();
    const r = await admin("PUT", "/api/facturation/signature/certificat", { fichier: p12.toString("base64"), motDePasse });
    expect(r.status).toBe(503);
    expect(r.json.code).toBe("NON_CONFIGUREE");
    expect(r.texte).not.toContain(motDePasse);
  });
});

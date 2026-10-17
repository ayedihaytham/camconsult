import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { connecterAdmin, creerBaseJetable, demarrerServeur } from "./helpers.js";

/**
 * Facture électronique (TEIF) contre un VRAI PostgreSQL jetable et le vrai serveur, données synthétiques (aucun matricule réel).
 * Exige TEST_DATABASE_URL (serveur de test local) ; sans elle, ignoré.
 */
const actif = Boolean(process.env.TEST_DATABASE_URL);
vi.setConfig({ testTimeout: 90_000, hookTimeout: 90_000 });

describe.skipIf(!actif)("intégration PostgreSQL : facture électronique (TEIF)", () => {
  let base;
  let serveur;
  let admin;
  let sql;
  let societeId;
  let factureId;

  beforeAll(async () => {
    base = await creerBaseJetable();
    serveur = await demarrerServeur(base.url);
    admin = await connecterAdmin(serveur.base);
    sql = await base.client();
    societeId = (
      await admin("POST", "/api/societes", { raisonSociale: "CLIENT EXEMPLE SARL", code: "FE-1", rne: "RNE-1", tva: "7654321KAM000", adresse: "2 Avenue Exemple" })
    ).json.id;
    factureId = (
      await admin("POST", "/api/facturation", {
        societeId,
        dateEmission: "2026-10-17",
        echeance: "2026-11-16",
        tvaTaux: 19,
        timbre: 1,
        note: "",
        lignes: [{ description: "Honoraires", quantite: 1, montantHt: 500 }, { description: "Déclaration", quantite: 2, montantHt: 100 }],
      })
    ).json.id;
  });
  afterAll(async () => {
    await sql?.end();
    await serveur?.arreter();
    await base?.supprimer();
  });

  it("identité incomplète : refus 422 avec les points à corriger, rien d'enregistré", async () => {
    const etat = await admin("GET", `/api/facturation/${factureId}/einvoice`);
    expect(etat.status).toBe(200);
    expect(etat.json.pret).toBe(false);
    const champs = etat.json.problemes.filter((p) => p.niveau === "bloquant").map((p) => `${p.ou}:${p.champ}`);
    expect(champs).toEqual(expect.arrayContaining(["cabinet:matriculeFiscal", "cabinet:nom", "societe:ville", "societe:codePostal"]));
    const refus = await admin("POST", `/api/facturation/${factureId}/einvoice/preparer`);
    expect(refus.status).toBe(422);
    expect((await sql.query("select count(*)::int n from facture_einvoice")).rows[0].n).toBe(0);
  });

  it("identité complétée par l'API : la facture devient prête, le XML est préparé avec une empreinte exacte", async () => {
    expect(
      (
        await admin("PUT", "/api/facturation/cabinet", {
          adresse: "1 Rue Exemple, Tunis", matriculeFiscal: "1234567ABM000", telephone: "", email: "", rib: "00 000 0000000000000 00", mentions: "",
          raisonSociale: "CABINET EXEMPLE", rue: "Rue Exemple", ville: "Tunis", codePostal: "1000", pays: "TN", rc: "",
        })
      ).status,
    ).toBe(200);
    expect((await admin("PATCH", `/api/societes/${societeId}`, { adresseRue: "Avenue Exemple", ville: "Sfax", codePostal: "3000", pays: "TN" })).status).toBe(200);

    const etat = await admin("GET", `/api/facturation/${factureId}/einvoice`);
    expect(etat.json.pret).toBe(true);

    const prep = await admin("POST", `/api/facturation/${factureId}/einvoice/preparer`);
    expect(prep.status).toBe(201);
    expect(prep.json.einvoice.statut).toBe("prete");

    const ligne = (await sql.query("select teif_xml, teif_sha256, teif_version, statut from facture_einvoice where facture_id = $1", [factureId])).rows[0];
    expect(ligne.statut).toBe("prete");
    expect(ligne.teif_version).toBe("1.8.9");
    expect(ligne.teif_sha256).toBe(createHash("sha256").update(ligne.teif_xml, "utf8").digest("hex"));
    expect(ligne.teif_xml).toContain("<DocumentIdentifier>2026-0001</DocumentIdentifier>");
    expect(ligne.teif_xml).toContain('<MessageSenderIdentifier type="I-01">1234567ABM000</MessageSenderIdentifier>');
    expect(ligne.teif_xml).toContain('<Amount currencyIdentifier="TND">834.000</Amount>'); // 700 + 19 % + timbre 1
  });

  it("la liste des factures expose le résumé (jamais le XML) et le téléchargement porte le numéro de facture", async () => {
    const liste = await admin("GET", "/api/facturation");
    const f = liste.json.find((x) => x.id === factureId);
    expect(f.einvoice).toMatchObject({ statut: "prete" });
    expect(JSON.stringify(f)).not.toContain("<TEIF");

    const xml = await admin("GET", `/api/facturation/${factureId}/einvoice/xml`);
    expect(xml.status).toBe(200);
    expect(xml.entetes.get("content-disposition")).toBe('attachment; filename="2026-0001.xml"');
    expect(xml.texte.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });

  it("préparer deux fois : 409 ; régénérer sans changement : même empreinte ; régénérer après un changement d'identité : nouvelle empreinte", async () => {
    expect((await admin("POST", `/api/facturation/${factureId}/einvoice/preparer`)).status).toBe(409);
    const avant = (await sql.query("select teif_sha256 from facture_einvoice")).rows[0].teif_sha256;
    expect((await admin("POST", `/api/facturation/${factureId}/einvoice/regenerer`)).status).toBe(200);
    expect((await sql.query("select teif_sha256 from facture_einvoice")).rows[0].teif_sha256).toBe(avant);

    await admin("PATCH", `/api/societes/${societeId}`, { ville: "Sousse" });
    expect((await admin("POST", `/api/facturation/${factureId}/einvoice/regenerer`)).status).toBe(200);
    const apres = (await sql.query("select teif_sha256, teif_xml from facture_einvoice")).rows[0];
    expect(apres.teif_sha256).not.toBe(avant);
    expect(apres.teif_xml).toContain("<CityName>Sousse</CityName>");
  });

  it("une facture électronique signée ou déposée ne peut plus être annulée, une facture seulement préparée le peut", async () => {
    await sql.query("update facture_einvoice set statut = 'deposee'");
    const refus = await admin("PATCH", `/api/facturation/${factureId}`, { statut: "annulee" });
    expect(refus.status).toBe(409);
    expect(refus.json.error).toMatch(/avoir/);
    await sql.query("update facture_einvoice set statut = 'prete'");
    expect((await admin("PATCH", `/api/facturation/${factureId}`, { statut: "annulee" })).status).toBe(200);
    // annulée : plus de téléchargement ni de régénération
    expect((await admin("GET", `/api/facturation/${factureId}/einvoice/xml`)).status).toBe(409);
    expect((await admin("POST", `/api/facturation/${factureId}/einvoice/regenerer`)).status).toBe(422);
  });

  it("la pièce est conservée : la facture ne peut pas être supprimée en base tant que sa facture électronique existe", async () => {
    await expect(sql.query("delete from factures where id = $1", [factureId])).rejects.toThrow(/violates foreign key/);
  });
});

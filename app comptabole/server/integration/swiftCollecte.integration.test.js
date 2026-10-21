import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { connecterAdmin, creerBaseJetable, demarrerServeur } from "./helpers.js";

/**
 * Les virements du module « État SWIFT » alimentent automatiquement le tableau « État SWIFT » des collectes de pièces.
 * Contre un vrai PostgreSQL jetable (TEST_DATABASE_URL) ; ignoré sans cette variable.
 */
const actif = Boolean(process.env.TEST_DATABASE_URL);
vi.setConfig({ testTimeout: 90_000, hookTimeout: 90_000 });

describe.skipIf(!actif)("intégration PostgreSQL : l'État SWIFT dans les collectes de pièces", () => {
  let base, serveur, admin, sql, societe;
  const virement = (extra = {}) => admin("POST", "/api/etat-swift", { societeId: societe, date: "2026-10-12", montant: 7672.6, libelle: "ACHAT NEGOCIE SUR LE MARCHE", banque: "BANQ", envoyer: true, ...extra });
  const collecte = async (periode, onglets = ["etat_swift"]) => (await admin("POST", "/api/collectes", { societeId: societe, periode, onglets })).json;
  const lignes = async (id) => (await admin("GET", `/api/collectes/${id}`)).json.lignes.filter((l) => l.onglet === "etat_swift").sort((a, b) => a.ordre - b.ordre);

  beforeAll(async () => {
    base = await creerBaseJetable();
    serveur = await demarrerServeur(base.url);
    admin = await connecterAdmin(serveur.base);
    sql = await base.client();
    societe = (await admin("POST", "/api/societes", { raisonSociale: "Société Swift", code: "SWF" })).json.id;
  });
  afterAll(async () => {
    await sql?.end();
    await serveur?.arreter();
    await base?.supprimer();
  });

  it("à la création de la collecte, les virements envoyés de sa période sont repris (date, libellé, banque, montant) ; les autres non", async () => {
    await virement();
    await virement({ date: "2026-09-02", montant: 100, libelle: "HORS PERIODE" });
    await virement({ date: "2026-10-20", montant: 200, libelle: "PAS ENCORE ENVOYE", envoyer: false });
    const c = await collecte("Octobre 2026");
    const l = await lignes(c.id);
    expect(l).toHaveLength(1);
    // une ligne d'en-tête : la société y ajoute ses factures jusqu'à atteindre le montant
    expect(l[0].data).toMatchObject({ date: "2026-10-12", libelle: "ACHAT NEGOCIE SUR LE MARCHE", banque: "BANQ", montant: 7672.6, num_facture: "", montant_devise: "", montant_tnd: "" });
    expect(l[0].data.ref).toMatch(/^SWIFT-[0-9A-F]{6}$/);
    expect(l[0].data._swift).toBeTruthy();
  });

  it("un virement envoyé après coup est repris dans la collecte ouverte, sans doublon ; un virement non envoyé l'est quand il part", async () => {
    const c = (await admin("GET", "/api/collectes")).json.find((x) => x.periode === "Octobre 2026");
    const envoye = await virement({ date: "2026-10-25", montant: 300, libelle: "SECOND" });
    expect(envoye.status).toBe(201);
    expect((await lignes(c.id)).map((x) => x.data.libelle)).toEqual(["ACHAT NEGOCIE SUR LE MARCHE", "SECOND"]);
    const attente = (await admin("GET", `/api/etat-swift?societeId=${societe}`)).json.find((v) => v.libelle === "PAS ENCORE ENVOYE");
    await admin("PATCH", `/api/etat-swift/${attente.id}`, { envoyer: true });
    expect((await lignes(c.id)).map((x) => x.data.libelle)).toEqual(["ACHAT NEGOCIE SUR LE MARCHE", "SECOND", "PAS ENCORE ENVOYE"]);
    // un second déclenchement ne crée pas de doublon
    await admin("PATCH", `/api/etat-swift/${attente.id}`, { libelle: "PAS ENCORE ENVOYE (modifié)" });
    expect(await lignes(c.id)).toHaveLength(3);
  });

  it("un virement déjà repris dans une collecte n'est pas repris dans une autre de la société", async () => {
    const autre = await collecte("T4 2026");
    expect(await lignes(autre.id)).toHaveLength(0);
  });

  it("les factures justifiées dans le module s'ajoutent sous leur virement, une ligne par facture, sans doublon", async () => {
    const c = (await admin("GET", "/api/collectes")).json.find((x) => x.periode === "Octobre 2026");
    const v = (await admin("GET", `/api/etat-swift?societeId=${societe}`)).json.find((x) => x.libelle === "ACHAT NEGOCIE SUR LE MARCHE");
    const r = await admin("PUT", `/api/etat-swift/${v.id}/factures`, {
      devise: "EUR", equivalentDevise: 2300,
      factures: [{ numFacture: "FA-77", montantDevise: 1000, devise: "EUR", taux: 3.3, montantTnd: 3300 }, { numFacture: "FA-78", montantDevise: 1300, devise: "EUR", taux: 3.3, montantTnd: 4290 }],
    });
    expect(r.status, r.texte).toBe(200);
    const l = await lignes(c.id);
    // le virement, SES factures juste dessous, puis les virements suivants : les lignes d'un même groupe se suivent
    expect(l.map((x) => x.data.libelle + (x.data.num_facture ? ` / ${x.data.num_facture}` : ""))).toEqual([
      "ACHAT NEGOCIE SUR LE MARCHE", "ACHAT NEGOCIE SUR LE MARCHE / FA-77", "ACHAT NEGOCIE SUR LE MARCHE / FA-78", "SECOND", "PAS ENCORE ENVOYE",
    ]);
    expect(l[1].data).toMatchObject({ montant: "", devise: "EUR", montant_devise: 1000, taux: 3.3, montant_tnd: 3300, ref: l[0].data.ref });
    // un nouveau déclenchement ne duplique rien
    await admin("PUT", `/api/etat-swift/${v.id}/factures`, { devise: "EUR", equivalentDevise: 2300, factures: [{ id: r.json.factures[0].id, numFacture: "FA-77", montantDevise: 1000, devise: "EUR", taux: 3.3, montantTnd: 3300 }, { id: r.json.factures[1].id, numFacture: "FA-78", montantDevise: 1300, devise: "EUR", taux: 3.3, montantTnd: 4290 }] });
    expect(await lignes(c.id)).toHaveLength(5);
  });

  it("un tableau transmis n'est jamais modifié par la synchronisation", async () => {
    const c = await collecte("Novembre 2026");
    await sql.query("update collecte_sections set statut = 'transmis' where collecte_id = $1 and onglet = 'etat_swift'", [c.id]);
    await virement({ date: "2026-11-05", montant: 50, libelle: "TROP TARD" });
    expect(await lignes(c.id)).toHaveLength(0);
  });

  it("un tableau « État SWIFT » ajouté plus tard à une collecte reprend les virements de sa période", async () => {
    const c = await collecte("Mars 2027", ["virements_recus"]);
    await virement({ date: "2027-03-03", montant: 60, libelle: "MARS" });
    expect(await lignes(c.id)).toHaveLength(0);
    await admin("PATCH", `/api/collectes/${c.id}`, { onglets: ["virements_recus", "etat_swift"] });
    expect((await lignes(c.id)).map((x) => x.data.libelle)).toEqual(["MARS"]);
  });
});

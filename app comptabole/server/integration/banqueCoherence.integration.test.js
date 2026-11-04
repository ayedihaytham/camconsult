import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { api, connecterAdmin, creerBaseJetable, demarrerServeur } from "./helpers.js";

/**
 * Cohérence entre suivi bancaire, suivi fournisseur et suivi client devise : chaque incohérence est signalée, et rien ne l'est quand tout tombe juste.
 * Contre un vrai PostgreSQL jetable (TEST_DATABASE_URL), données synthétiques ; ignoré sans cette variable.
 */
const actif = Boolean(process.env.TEST_DATABASE_URL);
vi.setConfig({ testTimeout: 90_000, hookTimeout: 90_000 });

describe.skipIf(!actif)("intégration PostgreSQL : cohérence entre modules", () => {
  let base, serveur, admin, client, societe, vide, eur, tnd, mvtStock, fiche, factureId;
  const jetonDe = (lien) => new URL(lien).searchParams.get("token");
  const alertes = async (s = societe) => (await admin("GET", `/api/banque/coherence?societeId=${s}`)).json.alertes;
  const codes = (liste) => liste.map((a) => a.code).sort();
  const mvt = (dateOp, libelle, debit, credit, type) => ({ dateOp, libelle, debit, credit, type });
  const etat = async () => (await admin("GET", `/api/banque?societeId=${societe}`)).json;

  beforeAll(async () => {
    base = await creerBaseJetable();
    serveur = await demarrerServeur(base.url);
    admin = await connecterAdmin(serveur.base);
    societe = (await admin("POST", "/api/societes", { raisonSociale: "Société Cohérence", code: "COH" })).json.id;
    vide = (await admin("POST", "/api/societes", { raisonSociale: "Société Vide", code: "VID" })).json.id;
    const n = Math.random().toString(36).slice(2, 8);
    const cree = await admin("POST", "/api/employes", { nom: "Resp", prenom: "Coh", identifiant: `h.${n}`, email: `h.${n}@example.test`, type: "Comptable", role: "societe_employe", societeId: societe });
    await api(serveur.base)("POST", "/api/auth/activate", { token: jetonDe(cree.json.lienAcces), motDePasse: "Mdp-Societe-Coherence-77" });
    client = api(serveur.base, (await api(serveur.base)("POST", "/api/auth/login", { identifiant: `h.${n}`, motDePasse: "Mdp-Societe-Coherence-77" })).json.token);
    eur = (await admin("POST", "/api/banque/comptes", { societeId: societe, banque: "BTL", devise: "EUR" })).json.comptes[0].id;
    tnd = (await admin("POST", "/api/banque/comptes", { societeId: societe, banque: "BTL", devise: "TND" })).json.comptes.find((c) => c.devise === "TND").id;
    mvtStock = (await admin("POST", "/api/stock/mouvements", {
      societeId: societe, fournisseur: "SOTACIB", achatNumFacture: "F-100", achatDate: "2026-01-05", achatDevise: "EUR", achatCours: 3.3,
      achatLignes: [{ designation: "CEM I", quantite: 1000, prixUnitaire: 44, montantDevise: 44000, montantTnd: 145200 }],
      client: "RUSPINA", venteNumFacture: "V-200", venteDate: "2026-01-20", venteDevise: "EUR", venteCours: 3.4,
      venteLignes: [{ designation: "CEM I", quantite: 1000, prixUnitaire: 50, montantDevise: 50000, montantTnd: 170000 }],
    })).json;
    fiche = (await admin("POST", "/api/suivi-devise", { societeId: societe, client: "RUSPINA", exercice: "2026", devise: "EUR" })).json.id;
    const repris = await admin("POST", `/api/suivi-devise/${fiche}/factures/depuis-stock`, { mouvementIds: [mvtStock.id] });
    factureId = repris.json.factures.find((f) => f.nFacture === "V-200").id;
  });
  afterAll(async () => {
    await serveur?.arreter();
    await base?.supprimer();
  });

  it("une société sans rien : aucune alerte", async () => {
    expect(await alertes(vide)).toEqual([]);
  });

  it("encaissement : non affecté, puis partiellement affecté (le reste est dit), puis entièrement affecté", async () => {
    await admin("POST", `/api/banque/comptes/${eur}/import`, { mouvements: [mvt("2026-02-10", "ENCAISSEMENT RUSPINA", 0, 30000, "encaissement_client")] });
    const e = (await etat()).mouvements.find((m) => m.credit === 30000);
    let a = (await alertes()).filter((x) => x.code === "encaissement_non_affecte");
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ gravite: "attention", mouvementBancaireId: e.id });
    expect(a[0].message).toMatch(/30 000,000 EUR : aucune facture client n'est encore affectée/);
    expect(a[0].lien.route).toBe(`/banque/${societe}`);

    const rc = await admin("POST", `/api/suivi-devise/${fiche}/mouvements`, { type: "reglement", libelle: "ENC", date: "2026-02-10", montant: 20000, mouvementBancaireId: e.id, affectations: [{ factureId, montant: 20000 }] });
    expect(rc.status, rc.texte).toBe(201);
    a = (await alertes()).filter((x) => x.code === "encaissement_non_affecte");
    expect(a[0].message).toMatch(/10 000,000 EUR sur 30 000,000 ne sont affectés à aucune facture client/);

    await admin("POST", `/api/suivi-devise/${fiche}/mouvements`, { type: "reglement", libelle: "ENC 2", date: "2026-02-10", montant: 10000, mouvementBancaireId: e.id, affectations: [{ factureId, montant: 10000 }] });
    expect((await alertes()).filter((x) => x.code === "encaissement_non_affecte")).toEqual([]);
  });

  it("paiement en banque ≠ factures moins retenue : erreur avec l'écart ; égal : rien", async () => {
    await admin("POST", `/api/banque/comptes/${eur}/import`, { mouvements: [mvt("2026-02-01", "PAIEMENT SOTACIB", 19800, 0, "paiement_fournisseur")] });
    const p = (await etat()).mouvements.find((m) => m.debit === 19800).id;
    const corps = { societeId: societe, fournisseurCle: "sotacib", dateReglement: "2026-02-01", mode: "virement", devise: "EUR", mouvementBancaireId: p, affectations: [{ mouvementId: mvtStock.id, montant: 20000 }] };
    const r = await admin("POST", "/api/fournisseurs/reglements", { ...corps, rsMontant: 300 });
    expect(r.status, r.texte).toBe(200);
    let a = (await alertes()).filter((x) => x.code === "montant_banque_different");
    expect(a).toHaveLength(1);
    expect(a[0].gravite).toBe("erreur");
    expect(a[0].message).toMatch(/19 800,000 EUR sortis de la banque, mais factures moins retenue = 19 700,000 EUR \(écart 100,000\)/);
    // la retenue corrigée à 200 : 20 000 − 200 = 19 800 = la banque
    const id = (await admin("GET", `/api/fournisseurs?societeId=${societe}`)).json.reglements[0].id;
    expect((await admin("PATCH", `/api/fournisseurs/reglements/${id}`, { ...corps, rsMontant: 200 })).status).toBe(200);
    a = (await alertes()).filter((x) => x.code === "montant_banque_different");
    expect(a).toEqual([]);
  });

  it("facture sur-réglée côté client : un avoir la rend sur-réglée, avec le lien vers la fiche", async () => {
    // 30 000 affectés sur 50 000 ; un avoir de 25 000 ramène le dû à 25 000 (le montant d'une facture reprise du stock ne se change pas ici)
    const r = await admin("PATCH", `/api/suivi-devise/factures/${factureId}`, { avoirMontant: 25000 });
    expect(r.status, r.texte).toBe(200);
    const a = (await alertes()).filter((x) => x.code === "facture_surreglee");
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ gravite: "erreur", factureId });
    expect(a[0].message).toMatch(/Facture client V-200 \(RUSPINA\) sur-réglée de 5 000,000 EUR : 30 000,000 EUR affectés pour 25 000,000 EUR/);
    expect(a[0].lien.route).toBe(`/suivi-devise/${societe}/${fiche}`);
    await admin("PATCH", `/api/suivi-devise/factures/${factureId}`, { avoirMontant: 0 });
    expect((await alertes()).filter((x) => x.code === "facture_surreglee")).toEqual([]);
  });

  it("change dont l'autre jambe n'est pas reliée : à savoir ; relié : plus d'alerte ; un seul compte : aucune alerte de ce type", async () => {
    await admin("POST", `/api/banque/comptes/${eur}/import`, { mouvements: [mvt("2026-09-02", "VENTE EUR", 300000, 0, "change")] });
    await admin("POST", `/api/banque/comptes/${tnd}/import`, { mouvements: [mvt("2026-09-02", "ACHAT TND", 0, 1011300, "change")] });
    let a = (await alertes()).filter((x) => x.code === "change_non_lie");
    expect(a).toHaveLength(2);
    expect(a[0].gravite).toBe("info");
    const e = await etat();
    const paire = { a: e.mouvements.find((m) => m.libelle === "VENTE EUR").id, b: e.mouvements.find((m) => m.libelle === "ACHAT TND").id };
    expect((await admin("POST", "/api/banque/changes-lies", { paires: [paire] })).status).toBe(200);
    a = (await alertes()).filter((x) => x.code === "change_non_lie");
    expect(a).toEqual([]);
    // un seul compte : le change ne peut pas être relié, donc pas d'alerte
    const seul = (await admin("POST", "/api/banque/comptes", { societeId: vide, banque: "BTL", devise: "EUR" })).json.comptes[0].id;
    await admin("POST", `/api/banque/comptes/${seul}/import`, { mouvements: [mvt("2026-09-02", "VENTE EUR", 100, 0, "change")] });
    expect(await alertes(vide)).toEqual([]);
  });

  it("les alertes sont triées : incohérences d'abord, puis à traiter, puis à savoir", async () => {
    await admin("PATCH", `/api/suivi-devise/factures/${factureId}`, { avoirMontant: 25000 });
    await admin("POST", `/api/banque/comptes/${eur}/import`, { mouvements: [mvt("2026-03-01", "ENCAISSEMENT 2", 0, 10, "encaissement_client"), mvt("2026-03-02", "CHANGE ISOLE", 50, 0, "change")] });
    const g = (await alertes()).map((a) => a.gravite);
    expect(g).toEqual([...g].sort((x, y) => ["erreur", "attention", "info"].indexOf(x) - ["erreur", "attention", "info"].indexOf(y)));
    expect(new Set(g)).toEqual(new Set(["erreur", "attention", "info"]));
  });

  it("chaque alerte dit quels modules elle concerne ; les paiements en banque sans règlement fournisseur sont comptés en une seule alerte", async () => {
    await admin("POST", `/api/banque/comptes/${eur}/import`, { mouvements: [mvt("2026-04-01", "REGLEMENT SOTACIB", 500, 0, "paiement_fournisseur"), mvt("2026-04-02", "REGLEMENT SOTACIB 2", 700, 0, "paiement_fournisseur")] });
    const liste = await alertes();
    const sans = liste.filter((x) => x.code === "paiement_non_rapproche");
    expect(sans).toHaveLength(1);
    expect(sans[0]).toMatchObject({ gravite: "attention", modules: ["banque", "fournisseur"], lien: { route: `/fournisseurs/${societe}` } });
    expect(sans[0].message).toMatch(/^2 paiements fournisseur en banque n'ont pas de règlement/);
    const modules = (code) => [...new Set(liste.filter((x) => x.code === code).map((x) => x.modules.join("+")))];
    expect(modules("encaissement_non_affecte")).toEqual(["banque+devise"]);
    expect(modules("change_non_lie")).toEqual(["banque"]);
    expect(liste.every((x) => Array.isArray(x.modules) && x.modules.length > 0)).toBe(true);
  });

  it("le compte de société n'y accède pas", async () => {
    expect((await client("GET", `/api/banque/coherence?societeId=${societe}`)).status).toBe(403);
    expect((await admin("GET", "/api/banque/coherence")).status).toBe(400);
  });
});

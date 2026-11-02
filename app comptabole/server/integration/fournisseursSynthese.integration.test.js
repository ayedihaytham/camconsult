import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { api, connecterAdmin, creerBaseJetable, demarrerServeur } from "./helpers.js";

/**
 * Situation du suivi fournisseur de toutes les sociétés (page de choix du Suivi fournisseur) : fournisseurs regroupés (fusions comprises), factures à régler,
 * solde dû par devise, n° en double, règlements datés avant leur facture, paiements en banque à rapprocher, principaux soldes dus.
 * Contre un vrai PostgreSQL jetable (TEST_DATABASE_URL), données synthétiques ; ignoré sans cette variable.
 */
const actif = Boolean(process.env.TEST_DATABASE_URL);
vi.setConfig({ testTimeout: 90_000, hookTimeout: 90_000 });

describe.skipIf(!actif)("intégration PostgreSQL : synthèse du suivi fournisseur", () => {
  let base, serveur, admin, client, petra, cam, vide, f1, f3;
  const jetonDe = (lien) => new URL(lien).searchParams.get("token");
  const achat = (societeId, fournisseur, num, date, devise, montant) =>
    admin("POST", "/api/stock/mouvements", { societeId, fournisseur, achatNumFacture: num, achatDate: date, achatDevise: devise, achatCours: devise === "TND" ? 1 : 3.3, achatLignes: [{ designation: "X", quantite: 1, prixUnitaire: montant, montantDevise: montant, montantTnd: 0 }] });
  const synthese = async (appel = admin) => (await appel("GET", "/api/fournisseurs/synthese")).json;
  const de = (liste, id) => liste.find((s) => s.societeId === id);

  beforeAll(async () => {
    base = await creerBaseJetable();
    serveur = await demarrerServeur(base.url);
    admin = await connecterAdmin(serveur.base);
    petra = (await admin("POST", "/api/societes", { raisonSociale: "12-PETRA", code: "PET" })).json.id;
    cam = (await admin("POST", "/api/societes", { raisonSociale: "CAM", code: "CAM" })).json.id;
    vide = (await admin("POST", "/api/societes", { raisonSociale: "VIDE", code: "VID" })).json.id;
    const n = Math.random().toString(36).slice(2, 8);
    const cree = await admin("POST", "/api/employes", { nom: "Resp", prenom: "Cam", identifiant: `f.${n}`, email: `f.${n}@example.test`, type: "Comptable", role: "societe_employe", societeId: cam });
    await api(serveur.base)("POST", "/api/auth/activate", { token: jetonDe(cree.json.lienAcces), motDePasse: "Mdp-Societe-Fourn-77" });
    client = api(serveur.base, (await api(serveur.base)("POST", "/api/auth/login", { identifiant: `f.${n}`, motDePasse: "Mdp-Societe-Fourn-77" })).json.token);

    // 12-PETRA : SOTACIB (deux écritures regroupées par une fusion), GREEN RECYCLING en USD
    f1 = (await achat(petra, "SOTACIB", "F-100", "2026-01-05", "EUR", 44000)).json;
    const f2 = (await achat(petra, "SOTACIB KAIROUAN", "F-200", "2026-02-01", "EUR", 10000)).json;
    f3 = (await achat(petra, "GREEN RECYCLING", "G-1", "2026-03-01", "USD", 5000)).json;
    await achat(petra, "GREEN RECYCLING", "g 1", "2026-03-15", "USD", 700); // même n° comparable : doublon
    expect((await admin("POST", "/api/fournisseurs/fusions", { societeId: petra, source: "sotacib kairouan", cible: "sotacib" })).status).toBe(200);
    // règlement partiel de F-100 (20 000 sur 44 000), daté AVANT la facture
    expect((await admin("POST", "/api/fournisseurs/reglements", { societeId: petra, fournisseurCle: "sotacib", dateReglement: "2026-01-02", mode: "virement", devise: "EUR", affectations: [{ mouvementId: f1.id, montant: 20000 }] })).status).toBe(200);
    // F-200 soldée
    expect((await admin("POST", "/api/fournisseurs/reglements", { societeId: petra, fournisseurCle: "sotacib", dateReglement: "2026-02-10", mode: "virement", devise: "EUR", affectations: [{ mouvementId: f2.id, montant: 10000 }] })).status).toBe(200);
    // paiements en banque : un rapproché, un non rapproché
    const eur = (await admin("POST", "/api/banque/comptes", { societeId: petra, banque: "BTL", devise: "EUR" })).json.comptes[0].id;
    await admin("POST", `/api/banque/comptes/${eur}/import`, { mouvements: [{ dateOp: "2026-04-01", libelle: "PAIEMENT A", debit: 100, credit: 0, type: "paiement_fournisseur" }, { dateOp: "2026-04-02", libelle: "PAIEMENT B", debit: 200, credit: 0, type: "paiement_fournisseur" }] });
    // CAM : une facture soldée, rien d'autre
    const c1 = (await achat(cam, "ACME", "A-1", "2026-02-01", "TND", 1000)).json;
    expect((await admin("POST", "/api/fournisseurs/reglements", { societeId: cam, fournisseurCle: "acme", dateReglement: "2026-02-05", mode: "virement", devise: "TND", affectations: [{ mouvementId: c1.id, montant: 1000 }] })).status).toBe(200);
  });
  afterAll(async () => {
    await serveur?.arreter();
    await base?.supprimer();
  });

  it("fournisseurs regroupés par fusion, factures, à régler, règlements, dernier règlement", async () => {
    const p = de(await synthese(), petra);
    expect(p).toMatchObject({ fournisseurs: 2, factures: 4, impayees: 3, reglements: 2, dernierReglement: "2026-02-10" });
  });

  it("solde dû par devise (la facture soldée n'y est pas), de la plus importante à la moins importante", async () => {
    const p = de(await synthese(), petra);
    expect(p.soldes).toEqual([{ devise: "USD", montant: 5700 }, { devise: "EUR", montant: 24000 }].sort((a, b) => b.montant - a.montant));
  });

  it("principaux soldes dus : les plus gros fournisseurs d'abord, sous leur écriture la plus fréquente", async () => {
    const p = de(await synthese(), petra);
    expect(p.principaux.map((x) => x.nom)).toEqual(["SOTACIB", "GREEN RECYCLING"].sort((a, b) => (a === "SOTACIB" ? -1 : 1)));
    expect(p.principaux.find((x) => x.nom === "SOTACIB").soldes).toEqual([{ devise: "EUR", montant: 24000 }]);
  });

  it("ce qu'il reste à faire : n° en double, règlement daté avant sa facture, paiements en banque à rapprocher", async () => {
    const p = de(await synthese(), petra);
    expect(p).toMatchObject({ doublons: 2, reglementsAvantFacture: 1, paiementsARapprocher: 2 });
  });

  it("une société à jour : aucune facture à régler, aucun solde, rien à faire", async () => {
    const c = de(await synthese(), cam);
    expect(c).toMatchObject({ fournisseurs: 1, factures: 1, impayees: 0, soldes: [], doublons: 0, reglementsAvantFacture: 0, paiementsARapprocher: 0, principaux: [] });
  });

  it("une société sans rien n'y figure ; un compte de société ne voit que la sienne", async () => {
    expect(de(await synthese(), vide)).toBeUndefined();
    const vue = await synthese(client);
    expect(vue.map((s) => s.societeId)).toEqual([cam]);
  });
});

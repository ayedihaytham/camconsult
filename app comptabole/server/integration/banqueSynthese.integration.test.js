import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { api, connecterAdmin, creerBaseJetable, demarrerServeur } from "./helpers.js";

/**
 * Situation bancaire de toutes les sociétés (page de choix du Suivi bancaire) : comptes, soldes, à rapprocher, à revoir et statut de chaque mois.
 * Contre un vrai PostgreSQL jetable (TEST_DATABASE_URL), données synthétiques ; ignoré sans cette variable.
 */
const actif = Boolean(process.env.TEST_DATABASE_URL);
vi.setConfig({ testTimeout: 90_000, hookTimeout: 90_000 });

describe.skipIf(!actif)("intégration PostgreSQL : synthèse bancaire des sociétés", () => {
  let base, serveur, admin, client, petra, cam, sansCompte, compteTnd, compteEur;
  const jetonDe = (lien) => new URL(lien).searchParams.get("token");
  const mvt = (dateOp, libelle, debit, credit, type = "autre") => ({ dateOp, libelle, debit, credit, type });
  const synthese = async (appel = admin) => (await appel("GET", "/api/banque/synthese")).json;
  const de = (liste, id) => liste.find((s) => s.societeId === id);

  beforeAll(async () => {
    base = await creerBaseJetable();
    serveur = await demarrerServeur(base.url);
    admin = await connecterAdmin(serveur.base);
    petra = (await admin("POST", "/api/societes", { raisonSociale: "12-PETRA", code: "PET" })).json.id;
    cam = (await admin("POST", "/api/societes", { raisonSociale: "CAM", code: "CAM" })).json.id;
    sansCompte = (await admin("POST", "/api/societes", { raisonSociale: "SANS COMPTE", code: "SAN" })).json.id;
    const n = Math.random().toString(36).slice(2, 8);
    const cree = await admin("POST", "/api/employes", { nom: "Resp", prenom: "Cam", identifiant: `s.${n}`, email: `s.${n}@example.test`, type: "Comptable", role: "societe_employe", societeId: cam });
    await api(serveur.base)("POST", "/api/auth/activate", { token: jetonDe(cree.json.lienAcces), motDePasse: "Mdp-Societe-Synth-77" });
    client = api(serveur.base, (await api(serveur.base)("POST", "/api/auth/login", { identifiant: `s.${n}`, motDePasse: "Mdp-Societe-Synth-77" })).json.token);

    compteTnd = (await admin("POST", "/api/banque/comptes", { societeId: petra, banque: "BTL", devise: "TND", soldeDepart: 1000, dateDepart: "2026-01-01" })).json.comptes[0].id;
    compteEur = (await admin("POST", "/api/banque/comptes", { societeId: petra, banque: "BTL", devise: "EUR" })).json.comptes.find((c) => c.devise === "EUR").id;
    await admin("POST", `/api/banque/comptes/${compteTnd}/import`, {
      mouvements: [
        mvt("2026-01-05", "FRAIS", 100, 0, "frais"), mvt("2026-01-20", "VIREMENT", 0, 500), mvt("2026-02-03", "PAIEMENT SOTACIB", 50, 0, "paiement_fournisseur"),
        mvt("2026-02-04", "AUTRE PAIEMENT", 20, 0, "paiement_fournisseur"), mvt("2026-03-04", "VIREMENT", 0, 10),
      ],
      releves: [{ mois: "2026-01", soldeReel: 1400 }, { mois: "2026-02", soldeReel: 1360 }],
    });
    await admin("POST", `/api/banque/comptes/${compteEur}/import`, { mouvements: [mvt("2026-02-10", "ENCAISSEMENT", 0, 300, "encaissement_client")], releves: [{ mois: "2026-02", soldeReel: 300 }] });
    const e = (await admin("GET", `/api/banque?societeId=${petra}`)).json;
    await admin("PATCH", `/api/banque/mouvements/${e.mouvements.find((m) => m.libelle === "FRAIS").id}/revoir`, { aRevoir: true });
    // le premier paiement fournisseur est rapproché d'un règlement : il ne compte plus « à rapprocher »
    const stock = (await admin("POST", "/api/stock/mouvements", { societeId: petra, fournisseur: "SOTACIB", achatNumFacture: "F1", achatDate: "2026-01-05", achatDevise: "TND", achatCours: 1, achatLignes: [{ designation: "X", quantite: 1, prixUnitaire: 100, montantDevise: 100, montantTnd: 100 }] })).json;
    const reg = await admin("POST", "/api/fournisseurs/reglements", { societeId: petra, fournisseurCle: "sotacib", dateReglement: "2026-02-03", mode: "virement", devise: "TND", mouvementBancaireId: e.mouvements.find((m) => m.libelle === "PAIEMENT SOTACIB").id, affectations: [{ mouvementId: stock.id, montant: 50 }] });
    expect(reg.status, reg.texte).toBe(200);

    const c2 = (await admin("POST", "/api/banque/comptes", { societeId: cam, banque: "BTL", devise: "EUR", soldeDepart: 0 })).json.comptes[0].id;
    await admin("POST", `/api/banque/comptes/${c2}/import`, { mouvements: [mvt("2026-02-02", "X", 5, 0)] });
  });
  afterAll(async () => {
    await serveur?.arreter();
    await base?.supprimer();
  });

  it("comptes et soldes par devise, mouvements, dernière opération, à rapprocher (hors règlement déjà rapproché) et à revoir", async () => {
    const p = de(await synthese(), petra);
    expect(p.comptes.map((c) => [c.banque, c.devise, c.solde]).sort()).toEqual([["BTL", "EUR", 300], ["BTL", "TND", 1340]]);
    expect(p).toMatchObject({ mouvements: 6, dernierMouvement: "2026-03-04", paiementsARapprocher: 1, aRevoir: 1 });
  });

  it("statut des mois : janvier juste, février en écart (TND : 1 330 calculé, 1 360 réel), mars sans solde réel ; l'écart est dit", async () => {
    const p = de(await synthese(), petra);
    expect(p.annee).toBe(2026);
    // février : TND en écart de 30, EUR juste → le pire statut gagne
    expect(p.mois.slice(0, 4)).toEqual(["ok", "ecart", "saisir", null]);
    expect(p.moisEnEcart).toBe(1);
    expect(p.ecarts).toEqual([{ mois: "2026-02", devise: "TND", banque: "BTL", ecart: 30 }]);
    expect(p.moisASaisir).toBe(1);
    expect(p.aSaisir).toEqual([{ mois: "2026-03", devise: "TND", banque: "BTL" }]);
  });

  it("une société sans compte n'y figure pas ; un compte de société ne voit que la sienne", async () => {
    expect(de(await synthese(), sansCompte)).toBeUndefined();
    const vue = await synthese(client);
    expect(vue.map((s) => s.societeId)).toEqual([cam]);
    expect(vue[0]).toMatchObject({ mouvements: 1, paiementsARapprocher: 0, moisASaisir: 1 });
  });
});

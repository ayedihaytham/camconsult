import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { api, connecterAdmin, creerBaseJetable, demarrerServeur } from "./helpers.js";

/**
 * Circuit financier d'un mouvement de stock : facture d'achat, règlements fournisseur (retenue à la source, paiement en banque), vente, fiche
 * du suivi client devise, règlements client et encaissements en banque, avec le décaissé et l'encaissé en dinars.
 * Contre un vrai PostgreSQL jetable (TEST_DATABASE_URL), données synthétiques ; ignoré sans cette variable.
 */
const actif = Boolean(process.env.TEST_DATABASE_URL);
vi.setConfig({ testTimeout: 90_000, hookTimeout: 90_000 });

describe.skipIf(!actif)("intégration PostgreSQL : circuit financier d'un mouvement de stock", () => {
  let base, serveur, admin, client, societe, mouvement, mouvementVide, fiche, factureId, paiement, encaissement;
  const jetonDe = (lien) => new URL(lien).searchParams.get("token");
  const circuit = async (id = mouvement.id) => (await admin("GET", `/api/stock/mouvements/${id}/circuit`)).json;

  beforeAll(async () => {
    base = await creerBaseJetable();
    serveur = await demarrerServeur(base.url);
    admin = await connecterAdmin(serveur.base);
    societe = (await admin("POST", "/api/societes", { raisonSociale: "Société Circuit", code: "CIR" })).json.id;
    const n = Math.random().toString(36).slice(2, 8);
    const cree = await admin("POST", "/api/employes", { nom: "Resp", prenom: "Circuit", identifiant: `k.${n}`, email: `k.${n}@example.test`, type: "Comptable", role: "societe_employe", societeId: societe });
    await api(serveur.base)("POST", "/api/auth/activate", { token: jetonDe(cree.json.lienAcces), motDePasse: "Mdp-Societe-Circuit-77" });
    client = api(serveur.base, (await api(serveur.base)("POST", "/api/auth/login", { identifiant: `k.${n}`, motDePasse: "Mdp-Societe-Circuit-77" })).json.token);

    const m = await admin("POST", "/api/stock/mouvements", {
      societeId: societe, natureMarchandise: "Ciment",
      fournisseur: "SOTACIB", achatNumFacture: "F-100", achatDate: "2026-01-05", achatDevise: "EUR", achatCours: 3.3,
      achatLignes: [{ designation: "CEM I", quantite: 1000, prixUnitaire: 44, montantDevise: 44000, montantTnd: 145200 }],
      client: "RUSPINA", venteNumFacture: "V-200", venteDate: "2026-01-20", venteDevise: "EUR", venteCours: 3.4,
      venteLignes: [{ designation: "CEM I", quantite: 1000, prixUnitaire: 50, montantDevise: 50000, montantTnd: 170000 }],
    });
    expect(m.status, m.texte).toBe(201);
    mouvement = m.json;
    mouvementVide = (await admin("POST", "/api/stock/mouvements", { societeId: societe, natureMarchandise: "Rien" })).json;

    const eur = (await admin("POST", "/api/banque/comptes", { societeId: societe, banque: "BTL", devise: "EUR" })).json.comptes[0].id;
    await admin("POST", `/api/banque/comptes/${eur}/import`, {
      mouvements: [
        { dateOp: "2026-02-01", libelle: "PAIEMENT SOTACIB", debit: 19700, credit: 0, type: "paiement_fournisseur" },
        { dateOp: "2026-02-10", libelle: "ENCAISSEMENT RUSPINA", debit: 0, credit: 30000, type: "encaissement_client" },
      ],
    });
    const banque = (await admin("GET", `/api/banque?societeId=${societe}`)).json.mouvements;
    paiement = banque.find((x) => x.debit === 19700).id;
    encaissement = banque.find((x) => x.credit === 30000).id;

    // règlement fournisseur : 20 000 EUR dont 300 de retenue à la source (viré 19 700), payé par le mouvement bancaire, cours 3,35
    const r = await admin("POST", "/api/fournisseurs/reglements", {
      societeId: societe, fournisseurCle: "sotacib", dateReglement: "2026-02-01", mode: "virement", devise: "EUR", cours: 3.35,
      rsTaux: 1.5, rsMontant: 300, mouvementBancaireId: paiement,
      affectations: [{ mouvementId: mouvement.id, montant: 20000 }],
    });
    expect(r.status, r.texte).toBe(200);

    // fiche du suivi client devise, vente reprise du stock, règlement client relié à l'encaissement
    fiche = (await admin("POST", "/api/suivi-devise", { societeId: societe, client: "RUSPINA", exercice: "2026", devise: "EUR" })).json.id;
    const repris = await admin("POST", `/api/suivi-devise/${fiche}/factures/depuis-stock`, { mouvementIds: [mouvement.id] });
    expect(repris.status, repris.texte).toBe(201);
    factureId = repris.json.factures.find((f) => f.nFacture === "V-200").id;
    const rc = await admin("POST", `/api/suivi-devise/${fiche}/mouvements`, {
      type: "reglement", libelle: "ENCAISSEMENT RUSPINA", date: "2026-02-10", montant: 30000, mouvementBancaireId: encaissement,
      affectations: [{ factureId, montant: 30000 }],
    });
    expect(rc.status, rc.texte).toBe(201);
  });
  afterAll(async () => {
    await serveur?.arreter();
    await base?.supprimer();
  });

  it("achat : le règlement montre sa retenue, son viré, son cours, son équivalent en dinars et le paiement en banque", async () => {
    const c = await circuit();
    expect(c.achat).toMatchObject({ numFacture: "F-100", fournisseur: "SOTACIB", devise: "EUR", montant: 44000 });
    expect(c.reglementsFournisseur).toHaveLength(1);
    expect(c.reglementsFournisseur[0]).toMatchObject({
      brut: 20000, retenue: 300, vire: 19700, cours: 3.35, coursSource: "reglement", brutTnd: 67000, vireTnd: 65995,
      banque: { id: paiement, montant: 19700, devise: "EUR" },
    });
    expect(c.totaux.resteAPayer).toEqual({ devise: "EUR", montant: 24000 });
  });

  it("vente : la fiche du suivi client devise, le règlement relié à l'encaissement, converti au cours de la vente (estimé)", async () => {
    const c = await circuit();
    expect(c.suiviDevise).toMatchObject({ suiviId: fiche, factureId, client: "RUSPINA", nFacture: "V-200", montantTotal: 50000, regle: 30000, reste: 20000 });
    expect(c.reglementsClient).toHaveLength(1);
    expect(c.reglementsClient[0]).toMatchObject({ montant: 30000, cours: 3.4, coursSource: "vente", montantTnd: 102000, banque: { id: encaissement, montant: 30000 } });
    expect(c.totaux.resteAEncaisser).toEqual({ devise: "EUR", montant: 20000 });
  });

  it("totaux en dinars : décaissé (viré), encaissé et trésorerie", async () => {
    const { totaux } = await circuit();
    expect(totaux).toMatchObject({ decaisseTnd: 65995, encaisseTnd: 102000, tresorerieTnd: 36005, incomplet: false });
  });

  it("sans cours du règlement, celui de la facture d'achat est utilisé et dit estimé ; sans aucun cours, les totaux sont déclarés incomplets", async () => {
    const e = await admin("GET", `/api/fournisseurs?societeId=${societe}`);
    const reglement = e.json.reglements[0];
    const sansCours = await admin("PATCH", `/api/fournisseurs/reglements/${reglement.id}`, {
      societeId: societe, fournisseurCle: "sotacib", dateReglement: "2026-02-01", mode: "virement", devise: "EUR", cours: 0, rsTaux: 1.5, rsMontant: 300, mouvementBancaireId: paiement,
      affectations: [{ mouvementId: mouvement.id, montant: 20000 }],
    });
    expect(sansCours.status, sansCours.texte).toBe(200);
    const c = await circuit();
    expect(c.reglementsFournisseur[0]).toMatchObject({ cours: 3.3, coursSource: "achat", vireTnd: 65010 });
    expect(c.totaux.incomplet).toBe(false);
  });

  it("sans aucun cours connu (ni règlement ni facture) : le dinar n'est pas inventé, les totaux sont déclarés incomplets", async () => {
    const m = (await admin("POST", "/api/stock/mouvements", {
      societeId: societe, natureMarchandise: "Sans cours", fournisseur: "AUTRE FOURNISSEUR", achatNumFacture: "F-300", achatDate: "2026-03-01", achatDevise: "EUR", achatCours: 0,
      achatLignes: [{ designation: "X", quantite: 1, prixUnitaire: 100, montantDevise: 100, montantTnd: 0 }],
    })).json;
    const r = await admin("POST", "/api/fournisseurs/reglements", { societeId: societe, fournisseurCle: "autre fournisseur", dateReglement: "2026-03-05", mode: "virement", devise: "EUR", cours: 0, affectations: [{ mouvementId: m.id, montant: 40 }] });
    expect(r.status, r.texte).toBe(200);
    const c = await circuit(m.id);
    expect(c.reglementsFournisseur[0]).toMatchObject({ brut: 40, cours: null, coursSource: null, vireTnd: null, banque: null });
    expect(c.totaux).toMatchObject({ decaisseTnd: 0, incomplet: true, resteAPayer: { devise: "EUR", montant: 60 } });
  });

  it("un mouvement sans achat ni vente ni règlement : circuit vide, sans erreur", async () => {
    const c = await circuit(mouvementVide.id);
    expect(c).toMatchObject({ achat: null, vente: null, suiviDevise: null, reglementsFournisseur: [], reglementsClient: [] });
    expect(c.totaux).toMatchObject({ decaisseTnd: 0, encaisseTnd: 0, tresorerieTnd: 0, resteAPayer: null, resteAEncaisser: null, incomplet: false });
  });

  it("introuvable : 404 ; le compte de société n'y accède pas : 403", async () => {
    expect((await admin("GET", "/api/stock/mouvements/00000000-0000-4000-8000-000000000000/circuit")).status).toBe(404);
    expect((await client("GET", `/api/stock/mouvements/${mouvement.id}/circuit`)).status).toBe(403);
  });
});

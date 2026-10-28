import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { api, connecterAdmin, creerBaseJetable, demarrerServeur } from "./helpers.js";

/**
 * Suivi client devise ↔ Suivi bancaire : un règlement client est relié à un encaissement du compte et réparti sur plusieurs factures
 * (de plusieurs lots) ; un encaissement peut alimenter plusieurs fiches. Contre un vrai PostgreSQL jetable (TEST_DATABASE_URL) ; ignoré sans cette variable.
 */
const actif = Boolean(process.env.TEST_DATABASE_URL);
vi.setConfig({ testTimeout: 90_000, hookTimeout: 90_000 });

describe.skipIf(!actif)("intégration PostgreSQL : règlements clients reliés à la banque", () => {
  let base, serveur, admin, client, societe, autreSociete, compteEur, compteTnd, encaissement, debit, encaissementTnd, fiche, fiche2025;
  const jetonDe = (lien) => new URL(lien).searchParams.get("token");
  const mvt = (dateOp, libelle, debit, credit) => ({ dateOp, libelle, debit, credit, type: credit > 0 ? "encaissement_client" : "frais" });
  const facture = async (suiviId, nFacture, montantTotal, extra = {}) => (await admin("POST", `/api/suivi-devise/${suiviId}/factures`, { nFacture, montantTotal, dateFacture: "2026-01-10", ...extra })).json.factures.find((f) => f.nFacture === nFacture);
  const reglement = (suiviId, corps) => admin("POST", `/api/suivi-devise/${suiviId}/mouvements`, { type: "reglement", libelle: "ENCAISSEMENT", date: "2026-02-10", ...corps });

  beforeAll(async () => {
    base = await creerBaseJetable();
    serveur = await demarrerServeur(base.url);
    admin = await connecterAdmin(serveur.base);
    societe = (await admin("POST", "/api/societes", { raisonSociale: "Société Devise", code: "DEV" })).json.id;
    autreSociete = (await admin("POST", "/api/societes", { raisonSociale: "Autre Société", code: "AUT" })).json.id;
    const n = Math.random().toString(36).slice(2, 8);
    const cree = await admin("POST", "/api/employes", { nom: "Resp", prenom: "Devise", identifiant: `d.${n}`, email: `d.${n}@example.test`, type: "Comptable", role: "societe_employe", societeId: societe });
    await api(serveur.base)("POST", "/api/auth/activate", { token: jetonDe(cree.json.lienAcces), motDePasse: "Mdp-Societe-Devise-77" });
    client = api(serveur.base, (await api(serveur.base)("POST", "/api/auth/login", { identifiant: `d.${n}`, motDePasse: "Mdp-Societe-Devise-77" })).json.token);
    const eur = await admin("POST", "/api/banque/comptes", { societeId: societe, banque: "BTL", devise: "EUR" });
    compteEur = eur.json.comptes[0].id;
    const tnd = await admin("POST", "/api/banque/comptes", { societeId: societe, banque: "BTL", devise: "TND" });
    compteTnd = tnd.json.comptes.find((c) => c.devise === "TND").id;
    await admin("POST", `/api/banque/comptes/${compteEur}/import`, { mouvements: [mvt("2026-02-10", "ENCAISSEMENT RUSPINA FACT 130+131+132+133/2025", 0, 1000), mvt("2026-02-11", "COMMISSION", 5, 0)] });
    await admin("POST", `/api/banque/comptes/${compteTnd}/import`, { mouvements: [mvt("2026-02-12", "VIREMENT TND", 0, 700)] });
    const etat = (await admin("GET", `/api/banque?societeId=${societe}`)).json;
    encaissement = etat.mouvements.find((m) => m.credit === 1000).id;
    debit = etat.mouvements.find((m) => m.debit === 5).id;
    encaissementTnd = etat.mouvements.find((m) => m.credit === 700).id;
    fiche = (await admin("POST", "/api/suivi-devise", { societeId: societe, client: "RUSPINA", exercice: "2026", devise: "EUR" })).json.id;
    fiche2025 = (await admin("POST", "/api/suivi-devise", { societeId: societe, client: "RUSPINA", exercice: "2025", devise: "EUR" })).json.id;
  });
  afterAll(async () => {
    await serveur?.arreter();
    await base?.supprimer();
  });

  it("un règlement relié à l'encaissement se répartit sur plusieurs factures de plusieurs lots ; chaque facture sait ce qu'elle a reçu", async () => {
    const lotA = (await admin("POST", `/api/suivi-devise/${fiche}/lots`, { libelle: "LC 4000T" })).json.lots[0].id;
    const f1 = await facture(fiche, "130/2026", 400, { lotId: lotA });
    const f2 = await facture(fiche, "131/2026", 500);
    const f3 = await facture(fiche, "132/2026", 300);
    const r = await reglement(fiche, { montant: 600, mouvementBancaireId: encaissement, affectations: [{ factureId: f1.id, montant: 400 }, { factureId: f2.id, montant: 200 }] });
    expect(r.status, r.texte).toBe(201);
    const m = r.json.mouvements[0];
    expect(m).toMatchObject({ mouvementBancaireId: encaissement, montant: 600, banqueLibelle: "ENCAISSEMENT RUSPINA FACT 130+131+132+133/2025" });
    expect(m.affectations).toHaveLength(2);
    const regle = (id) => r.json.factures.find((f) => f.id === id);
    expect(regle(f1.id)).toMatchObject({ regle: 400, reste: 0 });
    expect(regle(f2.id)).toMatchObject({ regle: 200, reste: 300 });
    expect(regle(f3.id)).toMatchObject({ regle: 0, reste: 300 });
    // la banque sait ce qui est déjà relié
    const mb = (await admin("GET", `/api/banque?societeId=${societe}`)).json.mouvements.find((x) => x.id === encaissement);
    expect(mb.affecteClient).toBe(600);
    expect(mb.reglementsClient).toEqual([{ suiviId: fiche, mouvementId: m.id }]);
  });

  it("le même encaissement alimente une seconde fiche, dans la limite de ce qui reste ; au-delà : refusé", async () => {
    const f = await facture(fiche2025, "94/2025", 900);
    expect((await reglement(fiche2025, { montant: 500, mouvementBancaireId: encaissement, affectations: [{ factureId: f.id, montant: 500 }] })).status).toBe(400);
    const ok = await reglement(fiche2025, { montant: 400, mouvementBancaireId: encaissement, affectations: [{ factureId: f.id, montant: 400 }] });
    expect(ok.status, ok.texte).toBe(201);
    expect((await admin("GET", `/api/banque?societeId=${societe}`)).json.mouvements.find((x) => x.id === encaissement).affecteClient).toBe(1000);
  });

  it("refuse : un débit, un encaissement d'une autre devise ou d'une autre société, une facture d'une autre fiche, une répartition trop grande", async () => {
    const f = await facture(fiche, "133/2026", 100);
    const autreFiche = (await admin("POST", "/api/suivi-devise", { societeId: societe, client: "AUTRE", exercice: "2026", devise: "EUR" })).json.id;
    const etrangere = await facture(autreFiche, "9/2026", 100);
    expect((await reglement(fiche, { montant: 5, mouvementBancaireId: debit })).json.error).toMatch(/crédit/);
    expect((await reglement(fiche, { montant: 10, mouvementBancaireId: encaissementTnd })).json.error).toMatch(/TND/);
    expect((await reglement(fiche, { montant: 10, mouvementBancaireId: "00000000-0000-4000-8000-000000000000" })).status).toBe(400);
    const ailleurs = (await admin("POST", "/api/banque/comptes", { societeId: autreSociete, banque: "BTL", devise: "EUR" })).json.comptes[0].id;
    await admin("POST", `/api/banque/comptes/${ailleurs}/import`, { mouvements: [mvt("2026-02-10", "ENCAISSEMENT AILLEURS", 0, 50)] });
    const mAilleurs = (await admin("GET", `/api/banque?societeId=${autreSociete}`)).json.mouvements[0].id;
    expect((await reglement(fiche, { montant: 10, mouvementBancaireId: mAilleurs })).status).toBe(400);
    expect((await reglement(fiche, { montant: 100, affectations: [{ factureId: etrangere.id, montant: 100 }] })).json.error).toMatch(/n'appartient pas/);
    expect((await reglement(fiche, { montant: 50, affectations: [{ factureId: f.id, montant: 80 }] })).json.error).toMatch(/dépasse/);
    expect((await reglement(fiche, { montant: 50, affectations: [{ factureId: f.id, montant: 20 }, { factureId: f.id, montant: 20 }] })).status).toBe(400);
    expect((await admin("POST", `/api/suivi-devise/${fiche}/mouvements`, { type: "avoir", montant: 5, mouvementBancaireId: encaissement })).status).toBe(400);
  });

  it("un règlement saisi à la main (sans banque, sans répartition) reste possible ; la modification et la suppression tiennent les liens à jour", async () => {
    const libre = await reglement(fiche, { montant: 10 });
    expect(libre.status).toBe(201);
    const m = libre.json.mouvements.find((x) => x.montant === 10);
    expect(m).toMatchObject({ mouvementBancaireId: null, affectations: [] });
    // on le relie ensuite à un encaissement puis on le répartit
    const f = (await admin("GET", `/api/suivi-devise/${fiche}`)).json.factures.find((x) => x.nFacture === "132/2026");
    const lie = await admin("PATCH", `/api/suivi-devise/mouvements/${m.id}`, { mouvementBancaireId: encaissementTnd === null ? null : debit });
    expect(lie.status).toBe(400); // un débit n'est pas un encaissement
    const repartit = await admin("PATCH", `/api/suivi-devise/mouvements/${m.id}`, { affectations: [{ factureId: f.id, montant: 10 }] });
    expect(repartit.json.factures.find((x) => x.id === f.id)).toMatchObject({ regle: 10 });
    // réduire le montant sous la répartition : refusé
    expect((await admin("PATCH", `/api/suivi-devise/mouvements/${m.id}`, { montant: 5 })).status).toBe(400);
    // supprimer le règlement libère la facture
    const apres = await admin("DELETE", `/api/suivi-devise/mouvements/${m.id}`);
    expect(apres.json.factures.find((x) => x.id === f.id)).toMatchObject({ regle: 0, reste: 300 });
  });

  it("supprimer l'encaissement garde le règlement, sans lien ; le compte de la société ne touche à rien", async () => {
    expect((await client("POST", `/api/suivi-devise/${fiche}/mouvements`, { type: "reglement", montant: 1 })).status).toBe(403);
    const etat = (await admin("GET", `/api/banque?societeId=${societe}`)).json;
    expect(etat.mouvements.find((x) => x.id === encaissement).reglementsClient).toHaveLength(2);
    await admin("DELETE", `/api/banque/mouvements/${encaissement}`);
    const f = (await admin("GET", `/api/suivi-devise/${fiche}`)).json;
    const m = f.mouvements.find((x) => x.montant === 600);
    expect(m).toMatchObject({ mouvementBancaireId: null, montant: 600 });
    expect(m.affectations).toHaveLength(2);
  });
});

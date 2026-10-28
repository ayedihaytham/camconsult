import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { api, connecterAdmin, creerBaseJetable, demarrerServeur } from "./helpers.js";

/**
 * Suivi bancaire : rapprochement mensuel (solde réel de la banque par mois, opérations en cours) et lignes « à revoir ».
 * Contre un vrai PostgreSQL jetable (TEST_DATABASE_URL), données synthétiques ; ignoré sans cette variable.
 */
const actif = Boolean(process.env.TEST_DATABASE_URL);
vi.setConfig({ testTimeout: 90_000, hookTimeout: 90_000 });

describe.skipIf(!actif)("intégration PostgreSQL : rapprochement bancaire mensuel", () => {
  let base, serveur, admin, societe, client, compteId;
  const jetonDe = (lien) => new URL(lien).searchParams.get("token");
  const mvt = (dateOp, libelle, debit, credit) => ({ dateOp, libelle, debit, credit, type: "frais" });

  beforeAll(async () => {
    base = await creerBaseJetable();
    serveur = await demarrerServeur(base.url);
    admin = await connecterAdmin(serveur.base);
    societe = (await admin("POST", "/api/societes", { raisonSociale: "Société Banque", code: "BNQ" })).json.id;
    const n = Math.random().toString(36).slice(2, 8);
    const cree = await admin("POST", "/api/employes", { nom: "Resp", prenom: "Banque", identifiant: `b.${n}`, email: `b.${n}@example.test`, type: "Comptable", role: "societe_employe", societeId: societe });
    await api(serveur.base)("POST", "/api/auth/activate", { token: jetonDe(cree.json.lienAcces), motDePasse: "Mdp-Societe-Banque-77" });
    const connexion = await api(serveur.base)("POST", "/api/auth/login", { identifiant: `b.${n}`, motDePasse: "Mdp-Societe-Banque-77" });
    client = api(serveur.base, connexion.json.token);
    const c = await admin("POST", "/api/banque/comptes", { societeId: societe, banque: "BTL", devise: "TND", soldeDepart: 1000, dateDepart: "2026-01-01" });
    expect(c.status, c.texte).toBe(200);
    compteId = c.json.comptes[0].id;
  });
  afterAll(async () => {
    await serveur?.arreter();
    await base?.supprimer();
  });

  it("l'import pose les soldes réels et les opérations en cours des mois lus ; un nouvel import remplace ceux du mois", async () => {
    const corps = {
      mouvements: [mvt("2026-01-05", "COMMISSION", 10, 0), mvt("2026-02-03", "VIREMENT", 0, 500)],
      releves: [{ mois: "2026-01", soldeReel: 990 }, { mois: "2026-02", soldeReel: null }],
      enCours: [{ mois: "2026-01", designation: "CHEQ 4000111", debit: 0, credit: 78606.274 }, { mois: "2026-01", designation: "ALIMENTATION", debit: 84250, credit: 0 }],
    };
    const r = await admin("POST", `/api/banque/comptes/${compteId}/import`, corps);
    expect(r.status, r.texte).toBe(200);
    expect(r.json.importes).toBe(2);
    expect(r.json.releves.map((x) => [x.mois, x.soldeReel])).toEqual([["2026-01", 990], ["2026-02", null]]);
    expect(r.json.enCours.map((o) => [o.mois, o.designation])).toEqual([["2026-01", "CHEQ 4000111"], ["2026-01", "ALIMENTATION"]]);
    // même import, une seule opération en cours : celles du mois sont remplacées, les mouvements ne sont pas dupliqués
    const encore = await admin("POST", `/api/banque/comptes/${compteId}/import`, { ...corps, enCours: [corps.enCours[1]] });
    expect(encore.json.importes).toBe(0);
    expect(encore.json.enCours.map((o) => o.designation)).toEqual(["ALIMENTATION"]);
  });

  it("l'import garde les lignes que le classeur signale « à revoir », avec leur note", async () => {
    const r = await admin("POST", `/api/banque/comptes/${compteId}/import`, { mouvements: [{ ...mvt("2026-04-30", "COMMISSION SIGNALEE", 2.975, 0), aRevoir: true, note: "Pas de date d'opération : date de valeur reprise." }, mvt("2026-04-30", "COMMISSION NORMALE", 1, 0)] });
    expect(r.status, r.texte).toBe(200);
    const signalee = r.json.mouvements.find((m) => m.libelle === "COMMISSION SIGNALEE");
    expect(signalee).toMatchObject({ aRevoir: true, note: "Pas de date d'opération : date de valeur reprise." });
    expect(r.json.mouvements.find((m) => m.libelle === "COMMISSION NORMALE")).toMatchObject({ aRevoir: false, note: "" });
  });

  it("solde réel d'un mois : saisie, correction, retrait", async () => {
    const a = await admin("PUT", `/api/banque/comptes/${compteId}/mois/2026-03`, { soldeReel: 1234.5, note: "relevé de mars" });
    expect(a.status, a.texte).toBe(200);
    expect(a.json.releves.find((x) => x.mois === "2026-03")).toMatchObject({ soldeReel: 1234.5, note: "relevé de mars" });
    const b = await admin("PUT", `/api/banque/comptes/${compteId}/mois/2026-03`, { soldeReel: null });
    expect(b.json.releves.find((x) => x.mois === "2026-03").soldeReel).toBeNull();
    expect((await admin("PUT", `/api/banque/comptes/${compteId}/mois/2026-13`, { soldeReel: 1 })).status).toBe(400);
  });

  it("opérations en cours : ajout, modification, suppression ; un débit et un crédit ensemble sont refusés", async () => {
    const ajout = await admin("POST", `/api/banque/comptes/${compteId}/mois/2026-02/en-cours`, { designation: "SALAIRE MARIEM", debit: 0, credit: 876.923 });
    expect(ajout.status, ajout.texte).toBe(200);
    const op = ajout.json.enCours.find((o) => o.designation === "SALAIRE MARIEM");
    expect(op).toMatchObject({ mois: "2026-02", credit: 876.923 });
    expect((await admin("POST", `/api/banque/comptes/${compteId}/mois/2026-02/en-cours`, { designation: "X", debit: 1, credit: 1 })).status).toBe(400);
    expect((await admin("POST", `/api/banque/comptes/${compteId}/mois/2026-02/en-cours`, { designation: "", debit: 1, credit: 0 })).status).toBe(400);
    const modif = await admin("PATCH", `/api/banque/en-cours/${op.id}`, { designation: "SALAIRE MARIEM FEV", debit: 0, credit: 900 });
    expect(modif.json.enCours.find((o) => o.id === op.id)).toMatchObject({ designation: "SALAIRE MARIEM FEV", credit: 900 });
    const sup = await admin("DELETE", `/api/banque/en-cours/${op.id}`);
    expect(sup.json.enCours.some((o) => o.id === op.id)).toBe(false);
  });

  it("une ligne se marque « à revoir » avec une note, puis se démarque", async () => {
    const etat = (await admin("GET", `/api/banque?societeId=${societe}`)).json;
    const m = etat.mouvements[0];
    expect(m).toMatchObject({ aRevoir: false, note: "" });
    const a = await admin("PATCH", `/api/banque/mouvements/${m.id}/revoir`, { aRevoir: true, note: "commission à vérifier" });
    expect(a.json.mouvements.find((x) => x.id === m.id)).toMatchObject({ aRevoir: true, note: "commission à vérifier" });
    const b = await admin("PATCH", `/api/banque/mouvements/${m.id}/revoir`, { aRevoir: false });
    expect(b.json.mouvements.find((x) => x.id === m.id)).toMatchObject({ aRevoir: false, note: "commission à vérifier" });
  });

  it("le compte de la société ne modifie rien : ni solde réel, ni opération en cours, ni marquage", async () => {
    const etat = (await admin("GET", `/api/banque?societeId=${societe}`)).json;
    expect((await client("PUT", `/api/banque/comptes/${compteId}/mois/2026-01`, { soldeReel: 1 })).status).toBe(403);
    expect((await client("POST", `/api/banque/comptes/${compteId}/mois/2026-01/en-cours`, { designation: "X", debit: 1, credit: 0 })).status).toBe(403);
    expect((await client("PATCH", `/api/banque/mouvements/${etat.mouvements[0].id}/revoir`, { aRevoir: true })).status).toBe(403);
    expect((await client("DELETE", `/api/banque/en-cours/${etat.enCours[0].id}`)).status).toBe(403);
  });
});

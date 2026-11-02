import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { api, connecterAdmin, creerBaseJetable, demarrerServeur } from "./helpers.js";

/**
 * Suivi bancaire : les deux jambes d'un même change sont reliées, et le cours réel (dinars ÷ devise) en découle.
 * Contre un vrai PostgreSQL jetable (TEST_DATABASE_URL), données synthétiques ; ignoré sans cette variable.
 */
const actif = Boolean(process.env.TEST_DATABASE_URL);
vi.setConfig({ testTimeout: 90_000, hookTimeout: 90_000 });

describe.skipIf(!actif)("intégration PostgreSQL : jambes d'un change", () => {
  let base, serveur, admin, client, societe, autre, compteEur, compteTnd, compteUsd, mouvements;
  const jetonDe = (lien) => new URL(lien).searchParams.get("token");
  const mvt = (dateOp, libelle, debit, credit, type = "change") => ({ dateOp, libelle, debit, credit, type });
  const etat = async (s = societe) => (await admin("GET", `/api/banque?societeId=${s}`)).json;
  const ligne = (e, libelle) => e.mouvements.find((m) => m.libelle === libelle);

  beforeAll(async () => {
    base = await creerBaseJetable();
    serveur = await demarrerServeur(base.url);
    admin = await connecterAdmin(serveur.base);
    societe = (await admin("POST", "/api/societes", { raisonSociale: "Société Change", code: "CHG" })).json.id;
    autre = (await admin("POST", "/api/societes", { raisonSociale: "Autre Société", code: "AUT" })).json.id;
    const n = Math.random().toString(36).slice(2, 8);
    const cree = await admin("POST", "/api/employes", { nom: "Resp", prenom: "Change", identifiant: `c.${n}`, email: `c.${n}@example.test`, type: "Comptable", role: "societe_employe", societeId: societe });
    await api(serveur.base)("POST", "/api/auth/activate", { token: jetonDe(cree.json.lienAcces), motDePasse: "Mdp-Societe-Change-77" });
    client = api(serveur.base, (await api(serveur.base)("POST", "/api/auth/login", { identifiant: `c.${n}`, motDePasse: "Mdp-Societe-Change-77" })).json.token);
    compteEur = (await admin("POST", "/api/banque/comptes", { societeId: societe, banque: "BTL", devise: "EUR" })).json.comptes[0].id;
    compteTnd = (await admin("POST", "/api/banque/comptes", { societeId: societe, banque: "BTL", devise: "TND" })).json.comptes.find((c) => c.devise === "TND").id;
    compteUsd = (await admin("POST", "/api/banque/comptes", { societeId: societe, banque: "BTL", devise: "USD" })).json.comptes.find((c) => c.devise === "USD").id;
    await admin("POST", `/api/banque/comptes/${compteEur}/import`, { mouvements: [mvt("2026-09-02", "VENTE EUR", 300000, 0), mvt("2026-09-03", "FRAIS", 5, 0, "frais"), mvt("2026-09-04", "ENTREE EUR", 0, 100, "encaissement_client")] });
    await admin("POST", `/api/banque/comptes/${compteTnd}/import`, { mouvements: [mvt("2026-09-02", "ACHAT TND", 0, 1011300), mvt("2026-09-05", "SORTIE TND", 500, 0)] });
    await admin("POST", `/api/banque/comptes/${compteUsd}/import`, { mouvements: [mvt("2026-09-02", "ENTREE USD", 0, 100)] });
    mouvements = await etat();
  });
  afterAll(async () => {
    await serveur?.arreter();
    await base?.supprimer();
  });

  it("relier deux jambes : chacune pointe vers l'autre et le cours réel est dinars ÷ devise, des deux côtés", async () => {
    const a = ligne(mouvements, "VENTE EUR").id;
    const b = ligne(mouvements, "ACHAT TND").id;
    const r = await admin("POST", "/api/banque/changes-lies", { paires: [{ a, b }] });
    expect(r.status, r.texte).toBe(200);
    const eur = ligne(r.json, "VENTE EUR");
    const tnd = ligne(r.json, "ACHAT TND");
    expect(eur).toMatchObject({ changeLie: { id: b, devise: "TND", montant: 1011300, coursReel: 3.371 }, coursReel: 3.371, type: "change" });
    expect(tnd).toMatchObject({ changeLie: { id: a, devise: "EUR", montant: 300000, coursReel: 3.371 }, coursReel: 3.371 });
  });

  it("délier : les deux lignes redeviennent libres, en gardant le type change", async () => {
    const a = ligne(await etat(), "VENTE EUR").id;
    const r = await admin("DELETE", `/api/banque/mouvements/${a}/change-lie`);
    expect(r.status, r.texte).toBe(200);
    expect(ligne(r.json, "VENTE EUR")).toMatchObject({ changeLie: null, coursReel: null, type: "change" });
    expect(ligne(r.json, "ACHAT TND")).toMatchObject({ changeLie: null, coursReel: null });
  });

  it("supprimer une jambe libère l'autre", async () => {
    const e = await etat();
    await admin("POST", "/api/banque/changes-lies", { paires: [{ a: ligne(e, "VENTE EUR").id, b: ligne(e, "ACHAT TND").id }] });
    const r = await admin("DELETE", `/api/banque/mouvements/${ligne(e, "ACHAT TND").id}`);
    expect(ligne(r.json, "VENTE EUR")).toMatchObject({ changeLie: null });
    // on le remet pour la suite
    await admin("POST", `/api/banque/comptes/${compteTnd}/import`, { mouvements: [mvt("2026-09-02", "ACHAT TND", 0, 1011300)] });
  });

  it("refuse : même compte, même devise, même sens, déjà relié ailleurs, autre société, ligne inconnue", async () => {
    const e = await etat();
    const id = (l) => ligne(e, l).id;
    const refus = async (paires, motif, statut = 400) => {
      const r = await admin("POST", "/api/banque/changes-lies", { paires });
      expect(r.status, r.texte).toBe(statut);
      expect(r.json.error).toMatch(motif);
    };
    await refus([{ a: id("VENTE EUR"), b: id("FRAIS") }], /deux comptes différents/);
    await refus([{ a: id("VENTE EUR"), b: id("SORTIE TND") }], /sortir de l'argent d'un compte et l'autre en fait entrer/);
    await refus([{ a: id("VENTE EUR"), b: id("VENTE EUR") }], /elle-même/);
    await admin("POST", "/api/banque/changes-lies", { paires: [{ a: id("VENTE EUR"), b: id("ACHAT TND") }] });
    await refus([{ a: id("VENTE EUR"), b: id("ENTREE USD") }], /déjà reliée à un autre change/);
    await refus([{ a: id("ENTREE EUR"), b: id("ACHAT TND") }], /déjà reliée à un autre change|sortir de l'argent/);
    await refus([{ a: id("VENTE EUR"), b: "00000000-0000-4000-8000-000000000000" }], /introuvables/);
    const ailleurs = (await admin("POST", "/api/banque/comptes", { societeId: autre, banque: "BTL", devise: "TND" })).json.comptes[0].id;
    await admin("POST", `/api/banque/comptes/${ailleurs}/import`, { mouvements: [mvt("2026-09-02", "AUTRE TND", 0, 5)] });
    const idAutre = (await etat(autre)).mouvements[0].id;
    await refus([{ a: id("VENTE EUR"), b: idAutre }], /sociétés différentes/);
    // une même ligne dans deux paires
    await admin("DELETE", `/api/banque/mouvements/${id("VENTE EUR")}/change-lie`);
    await refus([{ a: id("VENTE EUR"), b: id("ACHAT TND") }, { a: id("VENTE EUR"), b: id("ENTREE USD") }], /deux paires|même devise|déjà reliée/);
  });

  it("le compte de société lit mais ne relie ni ne délie", async () => {
    const e = await etat();
    const a = ligne(e, "VENTE EUR").id;
    const b = ligne(e, "ACHAT TND").id;
    expect((await client("POST", "/api/banque/changes-lies", { paires: [{ a, b }] })).status).toBe(403);
    expect((await client("DELETE", `/api/banque/mouvements/${a}/change-lie`)).status).toBe(403);
    expect((await client("GET", `/api/banque?societeId=${societe}`)).status).toBe(200);
  });
});

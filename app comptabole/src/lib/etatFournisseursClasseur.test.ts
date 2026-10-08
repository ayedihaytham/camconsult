import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { lireEtatsFournisseurs, lireFeuilleFournisseur, lireMode, normaliserBanque, numerosFacture, type FeuilleFournisseur } from "./etatFournisseursClasseur";
import { planifier, rapprocherFeuille } from "./etatFournisseursRapprochement";
import type { FactureFournisseur } from "@/types";

const FICHIER = "ETAT FOURNISSEURS PETRA (1).xlsx";

function feuilles() {
  const wb = XLSX.read(readFileSync(`samples/${FICHIER}`), { type: "buffer", cellDates: true });
  return wb.SheetNames.map((nom) => {
    const ws = wb.Sheets[nom];
    const ref = XLSX.utils.decode_range(ws["!ref"]!);
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null, range: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: ref.e }) });
    const fusions = (ws["!merges"] ?? []).filter((m) => m.s.c === m.e.c && m.e.r > m.s.r).map((m) => ({ ligne1: m.s.r, ligne2: m.e.r, colonne: m.s.c }));
    return { nom, rows, fusions };
  });
}

/** Stock simulé qui contiendrait toutes les factures du classeur. */
function stockDe(f: FeuilleFournisseur): FactureFournisseur[] {
  const suivi = { numProforma: "", dateProforma: null, montantProforma: 0, qteProforma: 0, etatProforma: "", numTitre: "", etatChargement: "", vuPasse: "" };
  return f.factures.flatMap((x, i) =>
    x.numeros.map((n) => ({
      id: `${i}-${n}`, fournisseur: f.nom, fournisseurCle: f.nom.toLowerCase(), numFacture: n, date: null, devise: "TND", cours: 0, quantite: x.quantite, designation: "",
      prixUnitaire: 0, montant: x.montant / x.numeros.length, montantTnd: 0, venteNumFacture: "", douaneNumDeclaration: "", suivi,
    })),
  );
}

describe("lecture d'une cellule de règlement", () => {
  it.each([
    ["CHQ N°9200013", "cheque", "9200013"],
    ["CHEQ N°4000183", "cheque", "4000183"],
    ["CHQ  4000100", "cheque", "4000100"],
    ["CHQ N4000103", "cheque", "4000103"],
    ["CHQ N° 4000126   CHQ N° 9200020", "cheque", "4000126 / 9200020"],
    ["TRANSFERT", "virement", ""],
    ["VIR", "virement", ""],
    ["10DT ESP", "especes", ""],
  ])("« %s » -> %s %s", (brut, mode, reference) => {
    expect(lireMode(brut)).toEqual({ mode, reference });
  });

  it("regroupe les écritures d'une même banque", () => {
    expect(["BARAKA", "ALBARAKA", "AL BARAKA ", "Al-Baraka"].map(normaliserBanque)).toEqual(["AL BARAKA", "AL BARAKA", "AL BARAKA", "AL BARAKA"]);
    expect(normaliserBanque("BTL")).toBe("BTL");
    expect(normaliserBanque("BTL    BARAKA")).toBe("BTL / AL BARAKA");
    expect(normaliserBanque("")).toBe("");
  });

  it("sépare les numéros de facture d'une même cellule sans couper un numéro comme 160/2026", () => {
    expect(numerosFacture("902033185     902033341      902033391")).toEqual(["902033185", "902033341", "902033391"]);
    expect(numerosFacture("902034155/902034136")).toEqual(["902034155", "902034136"]);
    expect(numerosFacture("901049909/901049721/")).toEqual(["901049909", "901049721"]);
    expect(numerosFacture("160/2026")).toEqual(["1602026"]);
    expect(numerosFacture("FC2606CC500057")).toEqual(["FC2606CC500057"]);
    expect(numerosFacture("En attente")).toEqual([]);
    expect(numerosFacture("ANNULEE")).toEqual([]);
  });
});

describe.skipIf(!existsSync(`samples/${FICHIER}`))("états fournisseurs du cabinet (classeur réel)", () => {
  const { feuilles: lues, ignorees } = lireEtatsFournisseurs(feuilles());
  const par = (nom: string) => lues.find((f) => f.nom === nom)!;

  it("reconnaît les quatre feuilles, malgré trois mises en page différentes", () => {
    expect(ignorees).toEqual([]);
    expect(lues.map((f) => f.nom)).toEqual(["ENFIDHA", "SOTACIB FERIANA", "SOTACIB KAIROUAN", "CARTHAGE CEMENT"]);
  });

  it("ENFIDHA : 35 factures, 13 règlements alignés sur les factures, retenue de 1 %", () => {
    const f = par("ENFIDHA");
    expect(f.factures).toHaveLength(35);
    expect(f.reglements).toHaveLength(13);
    expect(f.orphelins).toBe(0);
    const [r0] = f.reglements;
    // Un virement de 71 280 règle les deux premières factures (36 000 chacune) avec 720 de RS.
    expect(r0).toMatchObject({ date: "2026-04-10", mode: "virement", banque: "AL BARAKA", rsNumero: "2600034", rsMontant: 720, vire: 71280, factures: [0, 1] });
    expect(f.factures[0]).toMatchObject({ numeros: ["6608001609"], quantite: 200, montant: 36000, venteNumFacture: "2026038", date: "2026-04-07" });
    expect(f.reglements[1]).toMatchObject({ mode: "cheque", reference: "9200013", date: "2026-04-14" });
  });

  it("SOTACIB : la proforma regroupe plusieurs factures (fusion de cellules) avec sa quantité et son état", () => {
    const f = par("SOTACIB FERIANA");
    expect(f.factures[0]).toMatchObject({ numeros: ["902032379"], quantite: 85, montant: 20077.68, declaration: "405821", etatChargement: "CHARGEE", vuPasse: "OUI" });
    expect(f.factures[0].proforma).toMatchObject({ num: "3200001322", qte: 200, montant: 47241.6, etat: "CLOT", date: "2026-01-08" });
    // La deuxième facture est sous la même proforma (cellule fusionnée).
    expect(f.factures[1].proforma?.num).toBe("3200001322");
    expect(f.factures[2].proforma?.num).toBe("3200001323");
    expect(f.reglements[0]).toMatchObject({ rsNumero: "20260002", rsMontant: 236.208, vire: 47005.392, banque: "BTL", factures: [0, 1] });
  });

  it("garde les lignes qui regroupent plusieurs numéros de facture dans une même cellule", () => {
    const f = par("SOTACIB FERIANA");
    const multi = f.factures.filter((x) => x.numeros.length > 1);
    expect(multi.length).toBeGreaterThanOrEqual(5);
    expect(multi[0].numeros.every((n) => /^\d{9}$/.test(n))).toBe(true);
  });

  it("CARTHAGE : proforma en tête, factures à numéro alphanumérique, règlements listés à part (orphelins) et factures annulées ignorées", () => {
    const f = par("CARTHAGE CEMENT");
    expect(f.factures[0]).toMatchObject({ numeros: ["FC2606CC500057"], quantite: 818, date: "2026-06-15" });
    expect(f.factures[0].proforma).toMatchObject({ num: "144/2026", qte: 15000 });
    expect(f.avertissements.filter((a) => /ANNULEE/.test(a)).length).toBeGreaterThanOrEqual(3);
    expect(f.orphelins).toBeGreaterThanOrEqual(1);
    // Deux règlements distincts sur deux lignes voisines (chèques 9200047 et 9200048) ne sont pas fusionnés en un seul.
    const refs = f.reglements.map((r) => r.reference);
    expect(refs).toContain("9200047");
    expect(refs).toContain("9200048");
  });

  it("répartit les règlements sur les factures : paiements exacts, partiels et écarts du classeur", () => {
    const enfidha = par("ENFIDHA");
    const { plans } = planifier(enfidha);
    expect(plans.filter((p) => p.etat === "ok").length).toBeGreaterThanOrEqual(8);
    // Le règlement de 36 900 pour une facture de 36 000 dépasse de 900 : écart signalé, pas caché.
    const ecart = plans.find((p) => p.reglement.lignes.join() === "6");
    expect(ecart).toMatchObject({ etat: "excedent", excedent: 900 });
    // Une facture réglée en deux fois : le second règlement complète d'abord la facture payée en partie.
    const kairouan = planifier(par("SOTACIB KAIROUAN")).plans;
    expect(kairouan.some((p) => p.etat === "partiel")).toBe(true);
  });

  it("rapproche avec un stock complet : tous les règlements dont les factures sont connues deviennent importables", () => {
    const f = par("ENFIDHA");
    const r = rapprocherFeuille(f, stockDe(f));
    expect(r.importables).toHaveLength(13);
    const premier = r.importables[0];
    expect(premier.affectations.map((a) => a.montant)).toEqual([36000, 36000]);
    expect(premier.devise).toBe("TND");
  });

  it("n'importe pas un règlement dont une facture manque dans le stock, et dit laquelle", () => {
    const f = par("ENFIDHA");
    const stock = stockDe(f).filter((s) => s.numFacture !== cleDe("6608001611"));
    const r = rapprocherFeuille(f, stock);
    const premier = r.plans[0];
    expect(premier.etat).toBe("incomplet");
    expect(premier.manquants).toEqual(["6608001611"]);
    expect(r.importables).toHaveLength(12);
  });

  it("n'importe pas une facture présente deux fois dans le stock (impossible de choisir)", () => {
    const f = par("ENFIDHA");
    const stock = stockDe(f);
    stock.push({ ...stock[0], id: "doublon" });
    const r = rapprocherFeuille(f, stock);
    expect(r.plans[0].etat).toBe("incomplet");
    expect(r.lignes[0].ambigus).toEqual(["6608001609"]);
  });
});

const cleDe = (n: string) => n;

describe("lecture d'une feuille construite à la main", () => {
  const entete = ["N° FACTURE", "DATE FACTURE", "QTE FACT", "P.U", "MONT FACT", "DATE TRANSF / CHQ", "MODE DE RGLT", "N° RS", "RS", "MONT VIRMT TND", "BQ", "FACT VENTE N°"];

  it("lit un règlement fusionné sur deux factures : RS et virement additionnés une seule fois", () => {
    const f = lireFeuilleFournisseur("TEST", [
      ["TEST"],
      [],
      entete,
      ["1001001", new Date(2026, 3, 7), 100, 10, 1000, new Date(2026, 3, 10), "CHQ N°555666", 11, 5, 1985, "BTL", "V1"],
      ["1001002", new Date(2026, 3, 8), 100, 10, 1000, null, null, null, 5, null, null, "V2"],
    ], [
      { ligne1: 3, ligne2: 4, colonne: 5 },
      { ligne1: 3, ligne2: 4, colonne: 6 },
      { ligne1: 3, ligne2: 4, colonne: 9 },
    ]);
    expect(f?.factures).toHaveLength(2);
    expect(f?.reglements).toEqual([
      expect.objectContaining({ date: "2026-04-10", mode: "cheque", reference: "555666", rsMontant: 10, vire: 1985, banque: "BTL", factures: [0, 1] }),
    ]);
  });

  it("refuse une feuille qui n'est pas un état fournisseur", () => {
    expect(lireFeuilleFournisseur("X", [["a", "b"], [1, 2]], [])).toBeNull();
  });
});

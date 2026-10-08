import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { extraireCours, lireClasseurBancaire, lireFeuilleBancaire, type FeuilleLue, type FusionVerticale } from "./banqueClasseur";

/** Feuilles d'un vrai classeur du cabinet (dossier d'exemples), avec leurs cellules fusionnées. */
function feuilles(fichier: string): FeuilleLue[] {
  const wb = XLSX.read(readFileSync(`samples/${fichier}`), { type: "buffer", cellDates: true });
  return wb.SheetNames.map((nom) => {
    const ws = wb.Sheets[nom];
    const ref = XLSX.utils.decode_range(ws["!ref"]!);
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null, range: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: ref.e }) });
    const fusions: FusionVerticale[] = (ws["!merges"] ?? [])
      .filter((m) => m.s.c === m.e.c && m.e.r > m.s.r)
      .map((m) => ({ ligne1: m.s.r, ligne2: m.e.r, colonne: m.s.c }));
    return { nom, rows, fusions };
  });
}

const BTL = "BTL EURO PETRA 2026.xlsx";
const BARAKA = "CASH BANK TND BARAKA 08-26.xlsx";

describe.skipIf(!existsSync(`samples/${BTL}`))("classeur BTL EUR (un mois par feuille)", () => {
  const c = lireClasseurBancaire(feuilles(BTL));

  it("lit les 8 feuilles, y compris celles dont l'en-tête tient sur deux lignes", () => {
    expect(c.feuillesIgnorees).toEqual([]);
    expect(c.feuilles.map((f) => f.nom)).toEqual(["01-2026", "02-2026", "03-2026", "04-2026", "05-2026", "06-2026", "07-2026", "08-2026"]);
    expect(c.feuilles.every((f) => f.nbMouvements > 0)).toBe(true);
  });

  it("retrouve les totaux inscrits au pied des feuilles (janvier : 424 458 crédit ; 331 320 débit moins l'opération du 02/02 déjà saisie en février)", () => {
    const janvier = c.feuilles[0];
    expect(janvier.debit).toBe(306320);
    expect(janvier.credit).toBe(424458);
    expect(janvier.ouverture).toBe(2908.12);
    expect(janvier.cloture).toBe(121046.12);
    // Avril : 430 000 de débit, 132 915 de crédit, solde réel 97 534,10.
    const avril = c.feuilles[3];
    expect([avril.debit, avril.credit, avril.ouverture, avril.cloture]).toEqual([430000, 132915, 394619.1, 97534.1]);
  });

  it("retrouve le total d'août : 950 011,20 débit, 1 004 316,57 crédit, solde réel 54 518,87", () => {
    const aout = c.feuilles[7];
    expect(aout.debit).toBe(950011.2);
    expect(aout.credit).toBe(1004316.57);
    expect(aout.ouverture).toBe(213.5);
    expect(aout.soldeReel).toBeCloseTo(54518.87, 2);
    expect(aout.cloture).toBeCloseTo(54518.87, 2);
  });

  it("enchaîne les mois : le départ de chaque feuille est la clôture de la précédente", () => {
    expect(c.avertissements.filter((a) => /démarre/.test(a))).toEqual([]);
    expect(c.feuilles.slice(1).map((f, i) => f.ouverture === c.feuilles[i].cloture)).toEqual(new Array(7).fill(true));
    expect(c.ouverture).toEqual({ date: "2026-01-01", montant: 2908.12 });
    expect(c.soldeReel?.montant).toBeCloseTo(54518.87, 2);
  });

  it("corrige deux erreurs de saisie du classeur et le dit : année 2025 en février, opération du 02/02 saisie deux fois", () => {
    const fev = c.mouvements.filter((m) => m.dateOp.startsWith("2026-02"));
    expect(c.mouvements.some((m) => m.dateOp.startsWith("2025"))).toBe(false);
    expect(fev.find((m) => m.libelle.startsWith("ENCAISSEMENT RUSPINA (fact 202"))?.dateOp).toBe("2026-02-10");
    // L'opération « ALIMENTATION … 25 000 » du 02/02 n'est comptée qu'une fois (feuille de février).
    expect(c.mouvements.filter((m) => m.dateOp === "2026-02-02" && m.debit === 25000 && /ALIMENTATION/.test(m.libelle))).toHaveLength(1);
    expect(c.avertissements.some((a) => /02-2026.*3 dates avec une mauvaise année.*2026/.test(a))).toBe(true);
    expect(c.avertissements.some((a) => /01-2026.*déjà saisie.*feuille suivante/.test(a))).toBe(true);
  });

  it("regroupe une opération et ses frais sous le n° de pièce fusionné (déblocage + TVA + commission + intérêts)", () => {
    const groupe = c.mouvements.filter((m) => m.numPiece === "LD2621800686");
    expect(groupe.map((m) => m.libelle.split(" ")[0])).toEqual(["DEBLOCAGE", "TVA/COMM", "COMMISSION", "PAIEMENT"]);
    expect(groupe.map((m) => m.type)).toEqual(["credit", "frais", "frais", "credit"]);
  });

  it("classe les paiements de LC reçus, le change avec son cours, les frais et les crédits", () => {
    const parType = (t: string) => c.mouvements.filter((m) => m.type === t).length;
    expect(parType("change")).toBeGreaterThanOrEqual(7);
    const cours = c.mouvements.filter((m) => m.type === "change").map((m) => m.cours);
    expect(cours).toContain(3.38);
    expect(cours).toContain(3.399);
    expect(cours).toContain(3.372);
    const recu = c.mouvements.find((m) => m.numPiece === "TF260764909718\\TN1");
    expect(recu).toMatchObject({ type: "encaissement_client", credit: 22420, debit: 0, reference: "VTE 05-2026" });
  });

  it("n'invente pas de n° de pièce quand la colonne contient une catégorie (« PAIEMENT LC », « OPP CHG »)", () => {
    const janvier = c.mouvements.filter((m) => m.dateOp.startsWith("2026-01"));
    expect(janvier.every((m) => !/PAIEMENT LC|OPP CHG|VIREMENT/.test(m.numPiece))).toBe(true);
    expect(janvier.find((m) => m.libelle.startsWith("ALIMENTATION"))?.details).toBe("OPP CHG");
  });

  it("ignore les lignes vides et les totaux sans les compter comme des mouvements", () => {
    expect(c.mouvements.every((m) => m.debit > 0 || m.credit > 0)).toBe(true);
    expect(c.mouvements.some((m) => /TOTAL|SOLDE REEL/i.test(m.libelle))).toBe(false);
  });
});

describe.skipIf(!existsSync(`samples/${BARAKA}`))("classeur Al-Baraka TND", () => {
  const c = lireClasseurBancaire(feuilles(BARAKA));

  it("lit la feuille d'août malgré son en-tête sur deux lignes et sa colonne DETAILS", () => {
    expect(c.feuilles).toHaveLength(1);
    const f = c.feuilles[0];
    expect(f.ouverture).toBe(50141.388);
    expect(f.nbMouvements).toBe(39);
    expect(f.credit).toBe(384750);
    expect(f.debit).toBeCloseTo(434845.965, 3);
    expect(f.cloture).toBeCloseTo(45.423, 3);
    expect(f.soldeReel).toBeCloseTo(45.423, 3);
    expect(c.soldeReel).toMatchObject({ date: "2026-08-31" });
  });

  it("garde les chèques dans les détails, le cours de change et les frais regroupés par pièce", () => {
    const cheque = c.mouvements.find((m) => m.libelle.startsWith("CERTIFICATION CHEQ SOTACIB"));
    expect(cheque).toMatchObject({ details: "CHEQUE 9200112", debit: 296114.32, type: "paiement_fournisseur" });
    const change = c.mouvements.find((m) => m.libelle.startsWith("OPERATION DE CHANGE"));
    expect(change).toMatchObject({ type: "change", cours: 3.375, credit: 384750 });
    // F11:F13 fusionné : TVA, commission et certification partagent une pièce.
    const groupe = c.mouvements.filter((m) => m.numPiece === "TT2621603728");
    expect(groupe.length).toBe(3);
  });

  it("signale les virements où le montant société diffère de celui de la banque (frais)", () => {
    expect(c.ecartsSociete).toHaveLength(3);
    expect(c.ecartsSociete[0]).toMatchObject({ societe: 2659.106, banque: 2962.914 });
    // C'est le montant de la banque qui est importé.
    expect(c.mouvements.find((m) => m.libelle.startsWith("VIREMENT SOLDE DE TT COMPTE YA"))?.debit).toBe(2962.914);
  });

  it("ne confond pas un chèque et une opération de crédit", () => {
    expect(c.mouvements.filter((m) => m.type === "paiement_fournisseur").length).toBeGreaterThanOrEqual(15);
    expect(c.mouvements.filter((m) => m.type === "frais").length).toBeGreaterThanOrEqual(15);
  });
});

describe("lecture d'une feuille construite à la main", () => {
  it("lit un en-tête sur deux lignes avec un bloc société puis un bloc banque", () => {
    const f = lireFeuilleBancaire([
      ["ACCOUNTS TEST"],
      ["", "", "", "START DATE", new Date(2026, 6, 31), "BANK BALANCE", 100],
      [],
      ["DATE OP", "VALUE DATE", "DESCRIPTION", "N° PIECE", "PETRA CMC", null, "BANK", null, "BANK BALANCE"],
      [null, null, null, null, "DEBIT", "CREDIT", "DEBIT", "CREDIT"],
      [new Date(2026, 7, 3), new Date(2026, 7, 3), "LC PAYMENT CLIENT", "TF123456\\TN1", 50, 0, 0, 50, 150],
      [new Date(2026, 7, 4), new Date(2026, 7, 4), "COMMISSION", "CHG987654", 0, 2, 2, 0, 148],
      ["TOTAL", null, null, null, 50, 2, 2, 50],
    ]);
    expect(f?.ouverture).toEqual({ date: "2026-07-31", montant: 100 });
    expect(f?.mouvements.map((m) => [m.libelle, m.debit, m.credit, m.type])).toEqual([
      ["LC PAYMENT CLIENT", 0, 50, "encaissement_client"],
      ["COMMISSION", 2, 0, "frais"],
    ]);
    expect(f?.ecartsSociete).toEqual([]);
  });

  it("refuse une feuille sans en-tête de relevé", () => {
    expect(lireFeuilleBancaire([["a", "b"], [1, 2]])).toBeNull();
  });
});

describe("cours de change", () => {
  it.each([
    ["COURS 3.38", 3.38],
    ["COURS 3,372", 3.372],
    ["ACHAT VENTE DEVISE  3.3990", 3.399],
    ["TAUX DE 3.375TND", 3.375],
  ])("« %s » -> %d", (texte, cours) => expect(extraireCours(texte)).toBe(cours));

  it("ne lit pas un montant ou un n° de pièce comme un cours", () => {
    expect(extraireCours("ACHAT VENTE DEVISE EUR / TND")).toBeNull();
    expect(extraireCours("FT26236F61MD\\TN1")).toBeNull();
  });
});

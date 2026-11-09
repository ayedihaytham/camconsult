import { describe, expect, it } from "vitest";
import { controleReleve, feuilleControle, harmoniserLibelles, montantDe, sansRepetition, totauxImprimes, verifierChaineSoldes } from "./controleReleve";
import type { PdfTextItem } from "./pdfToTables";

const ligne = (texte: string, y: number): PdfTextItem[] => texte.split("|").map((str, i) => ({ str: str.trim(), x: 20 + i * 90, y, w: 60, h: 10 }));
const page = (...lignes: string[]): PdfTextItem[] => lignes.flatMap((l, i) => ligne(l, 800 - i * 20));

const ENTETE = ["Date", "Libellé de l'opération", "Débit", "Crédit"];
const MOUVEMENTS = [
  ENTETE,
  ["31-08-2026", "Solde au: 31/08/2026", "0,000", "12 087,290"],
  ["01-09-2026", "LC Payment Credit", "0,000", "24 640,000"],
  ["01-09-2026", "Commission reglement", "2,000", "0,000"],
  ["02-09-2026", "ACHAT VENTE DEVISE", "300 000,000", "0,000"],
];
const PAGE_FIN = page("Solde|263 274,710|0,000", "Totaux|300 002,000|24 640,000");

describe("montants", () => {
  it("lit les montants imprimés avec espaces de milliers et virgule", () => {
    expect(montantDe("3 139 858,580")).toBe(3139858.58);
    expect(montantDe("0,000")).toBe(0);
    expect(montantDe("Totaux")).toBeNull();
  });
});

describe("totaux imprimés par le relevé", () => {
  it("lit la ligne Totaux (débit, crédit) et la ligne Solde sans date", () => {
    expect(totauxImprimes([PAGE_FIN])).toEqual({ debit: 300002, credit: 24640, soldeDebit: 263274.71, soldeCredit: 0 });
  });

  it("une ligne Solde datée (solde d'ouverture) n'est pas le solde final ; sans ligne Totaux, rien n'est inventé", () => {
    expect(totauxImprimes([page("Solde au 31-08-2026|0,000|12 087,290")])).toBeNull();
  });
});

describe("contrôle d'un relevé converti", () => {
  it("égalité exacte des totaux et du solde : tout est OK, l'ouverture est exclue des totaux", () => {
    const controle = controleReleve([PAGE_FIN], MOUVEMENTS)!;
    expect(controle.lignes.map((l) => [l.libelle, l.calcule, l.releve, l.ok])).toEqual([
      ["Total débit", 300002, 300002, true],
      ["Total crédit", 24640, 24640, true],
      ["Solde final (ouverture + crédits − débits)", -263274.71, -263274.71, true],
    ]);
    expect(controle.ok).toBe(true);
  });

  it("un montant manquant donne l'écart exact et le verdict « À vérifier »", () => {
    const manquant = MOUVEMENTS.map((l) => (l[1] === "ACHAT VENTE DEVISE" ? [l[0], l[1], "000,000", l[3]] : l));
    const controle = controleReleve([PAGE_FIN], manquant)!;
    expect(controle.ok).toBe(false);
    expect(controle.lignes[0]).toMatchObject({ libelle: "Total débit", ecart: -300000, ok: false });
    expect(controle.lignes[1].ok).toBe(true);
  });

  it("sans ligne Totaux dans le relevé, pas de contrôle", () => {
    expect(controleReleve([page("Relevé sans totaux")], MOUVEMENTS)).toBeNull();
  });

  it("la feuille Contrôle liste calculé, relevé, écart et résultat", () => {
    const feuille = feuilleControle(controleReleve([PAGE_FIN], MOUVEMENTS)!);
    expect(feuille.name).toBe("Contrôle");
    expect(feuille.rows[0]).toEqual(["Contrôle", "Calculé", "Relevé", "Écart", "Résultat"]);
    expect(feuille.rows[1]).toEqual(["Total débit", 300002, 300002, 0, "OK"]);
  });
});

describe("libellés lus par OCR", () => {
  const lignes = (libelles: string[]) => [ENTETE, ...libelles.map((l) => ["01-09-2026", l, "1,000", "0,000"])];
  const libelles = (rows: string[][]) => rows.slice(1).map((l) => l[1]);

  it("ramène une variante abîmée au libellé dominant du relevé", () => {
    const rows = lignes([...Array(6).fill("Commission reglement"), "Cemmission reglement", "Commissionreglement", ...Array(4).fill("LC Payment Credit"), "LC Payment Credlt"]);
    expect(libelles(harmoniserLibelles(rows)).filter((l) => l !== "Commission reglement" && l !== "LC Payment Credit")).toEqual([]);
  });

  it("ne touche ni les libellés rares ni les références avec chiffres", () => {
    const rows = lignes([...Array(6).fill("Commission reglement"), "Commission reglements speciaux", "VIR 12345 ALPHA", "VIR 12346 ALPHA", "Frais divers"]);
    expect(libelles(harmoniserLibelles(rows))).toEqual(libelles(rows));
  });

  it("deux libellés distincts aussi fréquents ne sont pas fusionnés", () => {
    const rows = lignes([...Array(4).fill("Paiement principal"), ...Array(4).fill("Paiement interet")]);
    expect(libelles(harmoniserLibelles(rows))).toEqual(libelles(rows));
  });
});

describe("libellés lus par OCR : modèles du compte et répétitions", () => {
  const lignes = (libelles: string[]) => [ENTETE, ...libelles.map((l) => ["01-09-2026", l, "1,000", "0,000"])];
  const libelles = (rows: string[][]) => rows.slice(1).map((l) => l[1]);

  it("une variante abîmée est ramenée à un libellé déjà enregistré dans le compte, même rare dans ce relevé", () => {
    const rows = lignes(["Commissionreglement", "Autre chose 7"]);
    expect(libelles(harmoniserLibelles(rows, ["Commission reglement"]))[0]).toBe("Commission reglement");
    expect(libelles(harmoniserLibelles(rows))[0]).toBe("Commissionreglement");
  });

  it("une description reprise deux fois, la seconde tronquée, redevient la première", () => {
    expect(sansRepetition("Virement recu de l'etranger Virement recu de l'etr")).toBe("Virement recu de l'etranger");
    expect(sansRepetition("Paiement Echeance principal")).toBe("Paiement Echeance principal");
    expect(sansRepetition("Commission Commission")).toBe("Commission Commission");
  });
});

describe("contrôle par les soldes imprimés (relevé sans ligne « Totaux »)", () => {
  const item = (str: string, x: number, y: number) => ({ str, x, y, w: str.length * 5, h: 10 });
  const pages = [[item("Solde départ au", 111, 600), item("1 012 566,79", 482, 600), item("Solde fin", 111, 100), item("26 OCT 26", 155, 100), item("494 710,12", 482, 100)]];
  const entete = ["Date", "Libellé de l'opération", "Débit", "Crédit"];

  it("ouverture + crédits − débits retombe sur le solde final, sans prendre la date pour une partie du montant", () => {
    const c = controleReleve(pages, [entete, ["01/09/2026", "A", "1 661 510,67", ""], ["02/09/2026", "B", "", "1 143 654,00"]]);
    expect(c?.ok).toBe(true);
    expect(c?.lignes[0]).toMatchObject({ calcule: 494710.12, releve: 494710.12, ecart: 0 });
  });

  it("un montant mal lu donne un écart chiffré", () => {
    const c = controleReleve(pages, [entete, ["01/09/2026", "A", "1 661 510,57", ""], ["02/09/2026", "B", "", "1 143 654,00"]]);
    expect(c?.ok).toBe(false);
    expect(c?.lignes[0].ecart).toBe(0.1);
  });
});

describe("preuve ligne par ligne par la colonne Solde", () => {
  const entete = ["Date", "Libellé de l'opération", "Débit", "Crédit", "Solde"];
  const juste = [
    entete,
    ["01/02/2026", "Retrait", "100,000", "", "900,000"],
    ["02/02/2026", "Virement reçu", "", "250,000", "1 150,000"],
    ["03/02/2026", "Chèque 123", "50,000", "", "1 100,000"],
    ["04/02/2026", "Frais", "10,000", "", "1 090,000"],
  ];

  it("des soldes qui suivent : aucune ligne suspecte", () => {
    const r = verifierChaineSoldes(juste, 1000);
    expect(r).toEqual({ verifiees: 4, suspectes: [] });
  });

  it("un montant rangé dans la mauvaise colonne désigne sa ligne", () => {
    const faux = juste.map((l) => [...l]);
    faux[2] = ["02/02/2026", "Virement reçu", "250,000", "", "1 150,000"];
    const r = verifierChaineSoldes(faux, 1000);
    expect(r?.suspectes.map((m) => m.rang)).toEqual([2]);
    expect(r?.suspectes[0]).toMatchObject({ libelle: "Virement reçu", attendu: 650, lu: 1150 });
  });

  it("fonctionne sans solde de départ imprimé, et dans l'ordre inverse des dates", () => {
    expect(verifierChaineSoldes(juste, null)?.suspectes).toEqual([]);
    expect(verifierChaineSoldes([entete, ...juste.slice(1).reverse()], null)?.suspectes).toEqual([]);
  });

  it("le sens inverse (le crédit diminue le solde) est reconnu, une colonne qui n'est pas un solde ne conclut rien", () => {
    const debiteur = [entete, ["01/02", "A", "", "100,000", "900,000"], ["02/02", "B", "", "50,000", "850,000"], ["03/02", "C", "20,000", "", "870,000"], ["04/02", "D", "", "10,000", "860,000"]];
    expect(verifierChaineSoldes(debiteur, 1000)?.suspectes).toEqual([]);
    const au_hasard = [entete, ["01/02", "A", "5,000", "", "17,000"], ["02/02", "B", "5,000", "", "3,000"], ["03/02", "C", "5,000", "", "99,000"], ["04/02", "D", "", "5,000", "1,000"]];
    expect(verifierChaineSoldes(au_hasard, null)).toBeNull();
  });

  it("le contrôle du relevé les reprend : verdict à vérifier avec la ligne en cause", () => {
    const faux = juste.map((l) => [...l]);
    faux[3] = ["03/02/2026", "Chèque 123", "", "50,000", "1 100,000"];
    const c = controleReleve([[]], faux);
    expect(c?.ok).toBe(false);
    expect(c?.lignes.some((l) => l.libelle.startsWith("Ligne 3"))).toBe(true);
    expect(controleReleve([[]], juste)?.ok).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { controleReleve, feuilleControle, harmoniserLibelles, montantDe, totauxImprimes } from "./controleReleve";
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

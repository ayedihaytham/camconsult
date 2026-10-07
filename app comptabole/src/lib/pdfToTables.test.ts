import { describe, expect, it } from "vitest";
import {
  classeurExcel,
  convertirNombre,
  aUnTableauDeMouvements,
  feuillesDePdf,
  lireTextePdf,
  nombreDeCaracteres,
  nomsDeFeuilles,
  reconstruireTableau,
  type PdfTextItem,
} from "./pdfToTables";
import { buildTablesPdf } from "./pdfTables";

/** Morceau de texte : `y` croît vers le haut, comme dans un PDF. */
const t = (str: string, x: number, y: number, w = str.length * 5, h = 10): PdfTextItem => ({ str, x, y, w, h });

describe("convertirNombre", () => {
  it.each([
    ["1 234,50", 1234.5],
    ["1 234 567,890", 1234567.89],
    ["170 778,400", 170778.4],
    ["3,2842", 3.2842],
    ["3.26815", 3.26815],
    ["52000", 52000],
    ["1.234.567", 1234567],
    ["1,234,567.89", 1234567.89],
    ["1.234,56", 1234.56],
    ["-12,5", -12.5],
    ["(12,5)", -12.5],
    ["0,5", 0.5],
    ["1 000", 1000],
  ])("« %s » -> %d", (texte, valeur) => {
    expect(convertirNombre(texte)).toBe(valeur);
  });

  it("accepte les espaces insécables des PDF français", () => {
    expect(convertirNombre("1 234,50")).toBe(1234.5);
    expect(convertirNombre("1 234,50")).toBe(1234.5);
  });

  it.each(["", "abc", "0123", "00012", "12/01/2025", "1 234 5", "1,2,3", "12.", "1234567890123456", "EUR", "12 EUR", "1.234,5.6"])(
    "laisse « %s » en texte",
    (texte) => {
      expect(convertirNombre(texte)).toBeNull();
    },
  );
});

describe("reconstruction d'un tableau", () => {
  // Trois colonnes : libellé (à gauche), débit et crédit (alignés à droite), 4 lignes sous un titre.
  const page: PdfTextItem[] = [
    t("Balance générale", 40, 800, 90),
    t("Compte", 40, 760), t("Débit", 300, 760, 40), t("Crédit", 400, 760, 40),
    t("Clients", 40, 740), t("1 234,500", 280, 740, 60), t("0,000", 410, 740, 30),
    t("Banque", 40, 720), t("0,000", 310, 720, 30), t("2 000,000", 380, 720, 60),
    t("Total", 40, 700), t("1 234,500", 280, 700, 60), t("2 000,000", 380, 700, 60),
  ];

  it("retrouve lignes et colonnes, avec les montants alignés à droite", () => {
    const rows = reconstruireTableau(page, { nombres: true });
    expect(rows).toEqual([
      ["Balance générale", "", ""],
      ["Compte", "Débit", "Crédit"],
      ["Clients", 1234.5, 0],
      ["Banque", 0, 2000],
      ["Total", 1234.5, 2000],
    ]);
  });

  it("garde tout en texte quand la conversion des nombres est désactivée", () => {
    const rows = reconstruireTableau(page, { nombres: false });
    expect(rows[2]).toEqual(["Clients", "1 234,500", "0,000"]);
  });

  it("regroupe des morceaux d'une même cellule (un mot coupé, une phrase)", () => {
    const rows = reconstruireTableau([
      t("Facture", 40, 700, 35), t("d'achat", 78, 700, 35), t("fournisseur", 118, 700, 55),
      t("Montant", 300, 700, 35),
      t("N°", 40, 680, 10), t("12", 52, 680, 10), t("400,000", 300, 680, 35),
    ]);
    expect(rows).toEqual([
      ["Facture d'achat fournisseur", "Montant"],
      ["N° 12", "400,000"],
    ]);
  });

  it("tolère un léger décalage vertical entre les morceaux d'une même ligne", () => {
    const rows = reconstruireTableau([t("Libellé", 40, 700.4), t("Montant", 300, 699.2), t("Achat", 40, 680), t("12,5", 300, 680.8, 20)], { nombres: true });
    expect(rows).toEqual([
      ["Libellé", "Montant"],
      ["Achat", 12.5],
    ]);
  });

  it("supprime les colonnes vides et ignore le texte blanc", () => {
    const rows = reconstruireTableau([t(" ", 100, 700, 5), t("A", 40, 700), t("B", 300, 700), t("C", 40, 680), t("D", 300, 680)]);
    expect(rows).toEqual([["A", "B"], ["C", "D"]]);
  });

  it("garde les cellules séparées quand texte et tableau se mélangent sur la page", () => {
    // Un tableau (libellé à gauche, taux à droite) et, dans la même zone, du texte sur toute la largeur.
    const rows = reconstruireTableau([
      t("Actifs", 228, 770, 25), t("Taux", 485, 770, 21),
      t("3. Tapis, rideaux", 46, 755, 220), t("20%", 487, 755, 18),
      t("Un long paragraphe qui court", 46, 740, 100), t("sur toute la largeur de", 150, 740, 100), t("la page entière", 255, 740, 100), t("et déborde", 360, 740, 100), t("encore", 465, 740, 40),
      t("4. Lingerie", 46, 725, 44), t("33,33%", 481, 725, 31),
    ], { nombres: false });
    expect(rows[0]).toEqual(["Actifs", "Taux"]);
    expect(rows[1]).toEqual(["3. Tapis, rideaux", "20%"]);
    expect(rows[3]).toEqual(["4. Lingerie", "33,33%"]);
  });

  it("met un titre seul dans la première colonne", () => {
    expect(reconstruireTableau([t("Titre", 40, 700, 30)])).toEqual([["Titre"]]);
  });

  it("renvoie un tableau vide sans texte", () => {
    expect(reconstruireTableau([])).toEqual([]);
    expect(reconstruireTableau([t("   ", 10, 10)])).toEqual([]);
  });
});

describe("feuilles d'un PDF", () => {
  const pageA = [t("A", 40, 700), t("1", 300, 700, 5), t("B", 40, 680), t("2", 300, 680, 5)];
  const pageB = [t("C", 40, 700), t("3", 300, 700, 5)];

  it("fait une feuille par page et ignore les pages vides", () => {
    const f = feuillesDePdf([pageA, [], pageB], { nombres: true });
    expect(f.map((s) => s.name)).toEqual(["Page 1", "Page 3"]);
    expect(f[0].rows).toEqual([["A", 1], ["B", 2]]);
  });

  it("regroupe toutes les pages dans une seule feuille sur demande", () => {
    const f = feuillesDePdf([pageA, pageB], { nombres: true, uneSeuleFeuille: true });
    expect(f).toHaveLength(1);
    expect(f[0].rows).toEqual([["A", 1], ["B", 2], ["C", 3]]);
  });

  it("repère un PDF sans texte (scanné)", () => {
    expect(nombreDeCaracteres([[], []])).toBe(0);
    expect(nombreDeCaracteres([pageA])).toBe(4);
  });
});

describe("noms de feuilles Excel", () => {
  it("retire les caractères interdits, tronque à 31 et évite les doublons", () => {
    expect(nomsDeFeuilles(["Page 1", "Page 1", "a/b:c"])).toEqual(["Page 1", "Page 1 2", "a b c"]);
    expect(nomsDeFeuilles(["x".repeat(40)])[0]).toHaveLength(31);
    expect(nomsDeFeuilles([""])).toEqual(["Feuille"]);
  });
});

describe("aller-retour Excel -> PDF -> Excel", () => {
  const original = [
    ["Compte", "Libellé", "Débit", "Crédit"],
    ["411000", "Clients", 1234.5, 0],
    ["512000", "Banque", 0, 2000],
    ["701000", "Ventes de marchandises", 15000.125, 0],
    ["Total", "", 16234.625, 2000],
  ];

  it("retrouve le tableau d'origine après l'avoir écrit en PDF", async () => {
    const doc = await buildTablesPdf({ title: "Balance", sheets: [{ name: "Balance", headerRow: true, rows: original }], fileName: "balance.pdf", plain: true });
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const pages = await lireTextePdf(pdfjs as never, doc.output("arraybuffer"));
    expect(nombreDeCaracteres(pages)).toBeGreaterThan(30);

    const rows = reconstruireTableau(pages[0], { nombres: true });
    // Le titre et le sous-titre du PDF précèdent le tableau ; on compare à partir de l'en-tête.
    const debut = rows.findIndex((r) => r[0] === "Compte");
    expect(debut).toBeGreaterThanOrEqual(0);
    expect(rows.slice(debut, debut + original.length).map((r) => r.slice(0, 4))).toEqual([
      ["Compte", "Libellé", "Débit", "Crédit"],
      [411000, "Clients", 1234.5, 0],
      [512000, "Banque", 0, 2000],
      [701000, "Ventes de marchandises", 15000.125, 0],
      ["Total", "", 16234.625, 2000],
    ]);
  });
});

describe("classeur Excel", () => {
  it("produit un fichier .xlsx relisible avec les nombres typés", async () => {
    const octets = await classeurExcel([
      { name: "Page 1", rows: [["Compte", "Montant"], ["Clients", 1234.5]] },
      { name: "Page 1", rows: [["x"]] },
    ]);
    expect(Array.from(octets.slice(0, 2))).toEqual([0x50, 0x4b]); // « PK » : archive zip d'un .xlsx
    const XLSX = await import("xlsx");
    const wb = XLSX.read(octets, { type: "array" });
    expect(wb.SheetNames).toEqual(["Page 1", "Page 1 2"]);
    const lignes = XLSX.utils.sheet_to_json(wb.Sheets["Page 1"], { header: 1 }) as unknown[][];
    expect(lignes).toEqual([["Compte", "Montant"], ["Clients", 1234.5]]);
    expect(typeof lignes[1][1]).toBe("number");
  });
});

describe("mouvements bancaires seulement", () => {
  const entete = (y: number) => [t("Date", 40, y, 20), t("Libellé", 120, y, 35), t("Débit", 300, y, 25), t("Crédit", 400, y, 30), t("Solde", 500, y, 25)];
  const page1: PdfTextItem[] = [
    t("BANQUE EXEMPLE", 40, 800, 90), t("Relevé de compte n° 123", 40, 780, 110), t("Tunis, avenue Habib Bourguiba", 40, 760, 140),
    ...entete(720),
    t("02/01/2025", 40, 700, 50), t("VIREMENT SALAIRE", 120, 700, 80), t("1 200,000", 390, 700, 45),
    t("suite du libellé", 120, 685, 70),
    t("05/01/2025", 40, 670, 50), t("RETRAIT DAB", 120, 670, 60), t("300,000", 290, 670, 40),
    t("Page 1 / 2", 250, 40, 40),
  ];
  const page2: PdfTextItem[] = [
    ...entete(780),
    t("09/01/2025", 40, 760, 50), t("PRELEVEMENT STEG", 120, 760, 80), t("85,500", 290, 760, 35),
    t("Capital 10 000 DT - RC B123", 40, 60, 130),
  ];

  it("garde l'en-tête et les opérations, sans titre, adresse ni pied de page", () => {
    const [f] = feuillesDePdf([page1, page2], { nombres: true, tableauSeul: true });
    expect(f.name).toBe("Mouvements");
    expect(f.rows.map((r) => r.slice(0, 4))).toEqual([
      ["Date", "Libellé", "Débit", "Crédit"],
      ["02/01/2025", "VIREMENT SALAIRE suite du libellé", "", 1200],
      ["05/01/2025", "RETRAIT DAB", 300, ""],
      ["09/01/2025", "PRELEVEMENT STEG", 85.5, ""],
    ]);
  });

  it("ignore le texte arabe et les mentions de bas de page, garde Date valeur", () => {
    const page: PdfTextItem[] = [
      t("التاريخ", 40, 740, 30), t("Date", 40, 730, 20), t("Libellé de l'opération", 120, 730, 100), t("Date de valeur", 250, 730, 60), t("Débit", 340, 730, 25), t("Crédit", 420, 730, 30),
      t("31-12-2025", 40, 700, 50), t("Solde au: 31/12/2025", 120, 700, 100), t("29-01-2026", 250, 700, 50), t("0,000", 340, 700, 25), t("16 426,680", 410, 700, 50),
      t("02-01-2026", 40, 680, 50), t("Commission acceptation", 120, 680, 100), t("02-01-2026", 250, 680, 50), t("150,000", 340, 680, 35), t("0,000", 420, 680, 25),
      t("LC", 120, 668, 15), t("قسم عدد", 150, 668, 40),
      t("En cas de contestation sur le contenu de ce relevé, nous vous prions de contacter votre agence", 40, 600, 380),
    ];
    const [f] = feuillesDePdf([page], { nombres: true, tableauSeul: true });
    expect(f.rows).toEqual([
      ["Date", "Libellé de l'opération", "Date de valeur", "Débit", "Crédit"],
      ["31-12-2025", "Solde au: 31/12/2025", "29-01-2026", 0, 16426.68],
      ["02-01-2026", "Commission acceptation LC", "02-01-2026", 150, 0],
    ]);
  });

  it("revient au document complet sans tableau de mouvements", () => {
    const pages = [[t("Texte", 40, 700), t("autre", 300, 700)]];
    expect(aUnTableauDeMouvements(pages)).toBe(false);
    expect(feuillesDePdf(pages, { tableauSeul: true })[0].name).toBe("Page 1");
  });
});

import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import type { CollecteFull } from "@/types";
import { feuilleChecklist, feuilleOnglet } from "./exportStyled";
import { sectionReport } from "./exportXlsx";

const collecte = (onglet: string, lignes: Record<string, unknown>[]) =>
  ({
    id: "c",
    societeId: "s",
    periode: "Octobre 2026",
    statut: "brouillon",
    onglets: [onglet],
    devise: "TND",
    sections: [],
    notes: [],
    fichiers: [],
    lignes: lignes.map((data, ordre) => ({ id: `l${ordre}`, onglet, ordre, data })),
  }) as unknown as CollecteFull;

const feuille = (onglet: string, lignes: Record<string, unknown>[]) => {
  const wb = new ExcelJS.Workbook();
  feuilleOnglet(wb, collecte(onglet, lignes), onglet, "I CARGO LINE");
  return wb.worksheets[0];
};
const couleur = (cell: ExcelJS.Cell) => (cell.fill as ExcelJS.FillPattern | undefined)?.fgColor?.argb;
const texte = (ws: ExcelJS.Worksheet, row: number) => Array.from({ length: ws.columnCount }, (_, i) => ws.getRow(row).getCell(i + 1).value);

describe("Excel d'un tableau : même présentation que le PDF", () => {
  const ws = feuille("virements_recus", [
    { date: "2026-10-03", emetteur: "jlfqds", reference: "hkfdsk", montant: 3000000, compte_bancaire: "BIAT", observations: "hi" },
    { date: "2026-10-04", emetteur: "x", reference: "y", montant: 500, compte_bancaire: "BTK", observations: "" },
  ]);

  it("a le titre, le sous-titre du PDF et le bandeau d'en-têtes bleu foncé", () => {
    expect(ws.getCell("A1").value).toBe("DÉTAIL DES VIREMENTS REÇUS");
    expect(ws.getCell("A2").value).toBe("I CARGO LINE · Période : Octobre 2026 · Devise : TND");
    expect(texte(ws, 4)).toEqual(["Date", "Émetteur du virement", "Référence / Motif", "Montant (TND)", "Compte bancaire", "Observations"]);
    expect(couleur(ws.getCell("A4"))).toBe("FF1F4E79");
  });

  it("n'a que les lignes saisies, sans cases jaunes ni lignes vides", () => {
    expect(ws.rowCount).toBe(7); // titre, sous-titre, vide, en-têtes, 2 lignes, total
    for (const adresse of ["A5", "D5", "F5", "A6", "F6"]) expect(couleur(ws.getCell(adresse))).not.toBe("FFFFFF00");
    expect(ws.getCell("B5").value).toBe("jlfqds");
    expect(ws.getCell("D5").value).toBe(3000000);
    expect(ws.getCell("D5").numFmt).toBe("#,##0.000");
    expect(ws.getCell("D5").alignment?.horizontal).toBe("right");
  });

  it("alterne le fond des lignes comme le PDF", () => {
    expect([couleur(ws.getCell("A5")), couleur(ws.getCell("A6"))]).toEqual(["FFFFFFFF", "FFF7F8FA"]);
  });

  it("met la ligne TOTAL juste sous les lignes, en gras sur fond bleu pâle, avec une formule", () => {
    expect(ws.getCell("A7").value).toBe("TOTAL");
    expect(ws.getCell("A7").font?.bold).toBe(true);
    expect(couleur(ws.getCell("A7"))).toBe("FFE8EEF5");
    expect(ws.getCell("D7").value).toEqual({ formula: "SUM(D5:D6)", result: 3000500 });
  });

  it("dit qu'aucune ligne n'est saisie plutôt que de laisser un tableau vide", () => {
    const vide = feuille("virements_recus", []);
    expect(vide.getCell("A5").value).toBe("Aucune ligne saisie.");
    expect(vide.rowCount).toBe(5);
  });
});

describe("Excel d'un bordereau : mêmes colonnes et lignes que le PDF", () => {
  const entete = { date_remise: "2026-05-22", num_bordereau: "391", montant: 10310, banque: "", montant_cheque: "" };
  const cheque = (num: string, montant: number) => ({ date_remise: "2026-05-22", num_bordereau: "391", montant: "", banque: "BTK", num_cheque: num, client_emetteur: "X", montant_cheque: montant, date_echeance: "2026-07-30" });
  const ws = feuille("bordereaux_remise_cheques", [entete, cheque("111", 10000), cheque("121", 310)]);

  it("n'a ni observations ni ligne d'en-tête : le montant du bordereau est sur le premier chèque", () => {
    expect(texte(ws, 4)).toEqual([
      "Date de remise", "N° Bordereau", "Montant du bordereau (TND)", "Banque", "N° Chèque", "Nom du client émetteur (nominatif)", "Montant du chèque (TND)", "Date d'échéance",
    ]);
    expect(ws.getCell("C5").value).toBe(10310);
    expect(ws.getCell("E5").value).toBe("111");
    expect(ws.getCell("C6").value).toBeNull();
    expect(ws.getCell("A7").value).toBe("TOTAL");
    expect(ws.getCell("C7").value).toEqual({ formula: "SUM(C5:C6)", result: 10310 });
  });
});

describe("Excel : colonne calculée", () => {
  it("garde la formule du net crédité d'une traite escomptée", () => {
    const ws = feuille("traites_escomptees", [{ date_escompte: "2026-10-01", banque: "BNA", num_traite: "1", client_emetteur: "X", date_echeance: "2026-12-01", montant: 10000, agios: 125.5 }]);
    const net = ws.getCell("H5").value as { formula: string; result: number };
    expect(net.formula).toContain("ROUND(N(F5)-N(G5),3)");
    expect(net.result).toBe(9874.5);
    expect(ws.getCell("H6").value).toMatchObject({ formula: "SUM(H5:H5)" });
  });
});

describe("Excel de la checklist : en-têtes et valeurs dans les mêmes colonnes", () => {
  const c = {
    ...collecte("bordereaux_remise_cheques", [{ date_remise: "2026-10-03", num_bordereau: "1", montant: 350, montant_cheque: 350 }]),
    onglets: ["etat_caisse", "traites_escomptees", "bordereaux_remise_cheques"],
    majLe: "2026-10-08T10:00:00.000Z",
  } as CollecteFull;
  const wb = new ExcelJS.Workbook();
  feuilleChecklist(wb, c, "I CARGO LINE");
  const ws = wb.worksheets[0];

  it("place chaque valeur sous son en-tête, à partir de la colonne A", () => {
    expect(texte(ws, 4)).toEqual(["Pièce à transmettre", "Onglet correspondant", "Période concernée", "Statut", "Date de réception", "Total (TND)", "Commentaire"]);
    // Ligne du tableau reçu : pièce en A, onglet en B, période en C, statut en D, date en E, total en F.
    expect(ws.getCell("A5").value).toBe("Détail des bordereaux de remise de chèques (nominatifs)");
    expect(ws.getCell("B5").value).toBe("CHQ · Bordereaux remise de chèques");
    expect(ws.getCell("C5").value).toBe("Octobre 2026");
    expect(ws.getCell("D5").value).toBe("Reçu");
    expect(ws.getCell("E5").numFmt).toBe("dd/mm/yyyy");
    expect(ws.getCell("F5").value).toBe(350);
    expect(ws.getCell("F5").numFmt).toBe("#,##0.000");
    // Ni colonne A vide ni décalage : rien dans la colonne H.
    expect(ws.getCell("H5").value).toBeNull();
  });

  it("suit l'ordre des états, sans cases jaunes, avec le statut en couleur", () => {
    expect([ws.getCell("B5").value, ws.getCell("B6").value, ws.getCell("B7").value]).toEqual([
      "CHQ · Bordereaux remise de chèques", "TR · Traites escomptées", "État de caisse",
    ]);
    for (let r = 5; r <= 7; r++) for (const col of "ABCDEFG") expect(couleur(ws.getCell(`${col}${r}`))).not.toBe("FFFFFF00");
    expect(ws.getCell("D5").font?.color?.argb).toBe("FF1E7B4D");
    expect(ws.getCell("D6").font?.color?.argb).toBe("FFB45F06");
  });

  it("met le résumé sous le tableau, dans les mêmes colonnes", () => {
    expect([ws.getCell("A8").value, ws.getCell("B8").value]).toEqual(["Nb de pièces reçues", 1]);
    expect([ws.getCell("A9").value, ws.getCell("B9").value]).toEqual(["Nb de pièces en attente", 2]);
    expect(couleur(ws.getCell("A8"))).toBe("FFE8EEF5");
  });

  it("le PDF de la checklist a les mêmes libellés", () => {
    const rep = sectionReport(c, "checklist", "I CARGO LINE")!;
    expect(rep.rows[0].slice(0, 2)).toEqual(["Détail des bordereaux de remise de chèques (nominatifs)", "CHQ · Bordereaux remise de chèques"]);
  });
});

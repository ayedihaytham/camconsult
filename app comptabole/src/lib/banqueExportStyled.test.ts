import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import type { CompteBancaire, MouvementBancaire, OperationEnCoursBancaire, ReleveMensuel } from "@/types";
import { classeurCompteStyle } from "./banqueExportStyled";
import { lireClasseurBancaire, type FeuilleLue } from "./banqueClasseur";

const compte: CompteBancaire = { id: "c", banque: "BTL", devise: "TND", numero: "", soldeDepart: 1000, dateDepart: "2026-01-01", soldeReel: null, dateReel: null };
const mvt = (id: string, dateOp: string, debit: number, credit: number, extra: Partial<MouvementBancaire> = {}): MouvementBancaire => ({
  id, compteId: "c", dateOp, dateValeur: null, libelle: `LIBELLE ${id}`, details: "", reference: "", numPiece: "", debit, credit, type: "frais", aRevoir: false, note: "", affecteClient: 0, reglementsClient: [], cours: null, reglementId: null, fournisseurCle: null, ...extra,
});
const mouvements = [
  mvt("1", "2026-01-05", 100, 0, { aRevoir: true }),
  mvt("2", "2026-01-20", 0, 500, { type: "encaissement_client", dateValeur: "2026-01-21" }),
  mvt("3", "2026-01-25", 12.5, 0, { type: "paiement_fournisseur" }),
  mvt("4", "2026-02-03", 50, 0),
];
const releves: ReleveMensuel[] = [{ compteId: "c", mois: "2026-01", soldeReel: 1387.5, note: "" }];
const enCours: OperationEnCoursBancaire[] = [{ id: "o", compteId: "c", mois: "2026-01", designation: "CHEQ 4000111", debit: 0, credit: 200 }];

async function ouvrir() {
  const octets = await classeurCompteStyle(compte, mouvements, releves, enCours);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(octets as never);
  return { wb, octets };
}

describe("export Excel du suivi bancaire aux couleurs de l'application", () => {
  it("une feuille par mois, nommée « 01-2026 », avec le titre dans un bandeau marine", async () => {
    const { wb } = await ouvrir();
    expect(wb.worksheets.map((w) => w.name)).toEqual(["01-2026", "02-2026"]);
    const ws = wb.getWorksheet("01-2026")!;
    expect(ws.getCell("A1").value).toBe("ACCOUNTS BTL (TND)");
    expect((ws.getCell("A1").fill as { fgColor: { argb: string } }).fgColor.argb).toBe("FF0B2545");
    expect(ws.getCell("A1").font?.color?.argb).toBe("FFFFFFFF");
  });

  it("les dates sont de vraies dates, les montants des nombres à trois décimales, le zéro s'affiche en tiret", async () => {
    const ws = (await ouvrir()).wb.getWorksheet("01-2026")!;
    const d = ws.getCell("A6").value as Date;
    expect(d instanceof Date && d.toISOString().slice(0, 10)).toBe("2026-01-05");
    expect(ws.getCell("A6").numFmt).toBe("dd/mm/yyyy");
    expect(ws.getCell("B7").value instanceof Date).toBe(true); // date de valeur
    expect(ws.getCell("B6").value).toBeNull(); // pas de date de valeur : cellule vide
    expect(ws.getCell("I6").value).toBe(100);
    expect(ws.getCell("I6").numFmt).toBe('#,##0.000;-#,##0.000;"—"');
    expect(ws.getCell("L6").numFmt).toBe("#,##0.000;[Red]-#,##0.000");
  });

  it("une ligne « à revoir » est en jaune, les autres en alternance blanc et crème, le type est coloré", async () => {
    const ws = (await ouvrir()).wb.getWorksheet("01-2026")!;
    const fond = (a: string) => (ws.getCell(a).fill as { fgColor: { argb: string } }).fgColor.argb;
    expect(fond("C6")).toBe("FFFFF4C2");
    expect(fond("C7")).toBe("FFFBF9F4");
    expect(fond("C8")).toBe("FFFFFFFF");
    expect(ws.getCell("G7").font?.color?.argb).toBe("FF0D9B6C"); // encaissement : vert
    expect(ws.getCell("G8").font?.color?.argb).toBe("FFC77A06"); // paiement fournisseur : orange
  });

  it("le pied : total, solde calculé, écart en rouge, opérations en cours et solde théorique", async () => {
    const ws = (await ouvrir()).wb.getWorksheet("01-2026")!;
    expect(ws.getCell("A9").value).toBe("TOTAL");
    expect(ws.getCell("L9").value).toBe(1387.5);
    expect(ws.getCell("A11").value).toBe("SOLDE CALCULÉ");
    expect(ws.getCell("B11").value).toBe(1387.5);
    expect(ws.getCell("D11").value).toBe(1387.5);
    expect(ws.getCell("F11").value).toBe(0);
    expect(ws.getCell("F11").font?.color?.argb).toBe("FF0D9B6C"); // écart nul : vert
    expect(ws.getCell("A13").value).toBe("OPÉRATIONS EN COURS");
    expect(ws.getCell("A15").value).toBe("CHEQ 4000111");
    expect(ws.getCell("I15").value).toBe(200);
    expect(ws.getCell("A17").value).toBe("SOLDE THÉORIQUE");
    expect(ws.getCell("B17").value).toBe(1187.5);
  });

  it("un écart non nul s'affiche en rouge", async () => {
    const octets = await classeurCompteStyle(compte, mouvements, [{ compteId: "c", mois: "2026-01", soldeReel: 1380, note: "" }], []);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(octets as never);
    const f = wb.getWorksheet("01-2026")!.getCell("F11");
    expect(f.value).toBe(-7.5);
    expect(f.font?.color?.argb).toBe("FFB42318");
  });

  it("volet figé sous les en-têtes, filtre sur les lignes du mois, impression en paysage avec en-têtes répétés", async () => {
    const ws = (await ouvrir()).wb.getWorksheet("01-2026")!;
    expect(ws.views[0]).toMatchObject({ state: "frozen", ySplit: 5 });
    expect(ws.autoFilter).toBeTruthy();
    // « SOCIÉTÉ » et « BANK » couvrent chacun deux colonnes
    expect(ws.getCell("H4").value).toBe("SOCIÉTÉ");
    expect(ws.getCell("J4").value).toBe("BANK");
    expect(ws.getCell("I4").isMerged).toBe(true);
    expect(ws.getCell("K4").isMerged).toBe(true);
    expect(ws.pageSetup).toMatchObject({ orientation: "landscape", fitToPage: true, fitToWidth: 1, printTitlesRow: "4:5" });
  });

  it("le fichier se relit tel quel à l'import : mêmes lignes, mêmes montants, mêmes dates", async () => {
    const { octets } = await ouvrir();
    const wb = XLSX.read(octets, { type: "array", cellDates: true });
    const feuilles: FeuilleLue[] = wb.SheetNames.map((nom) => {
      const ws = wb.Sheets[nom];
      const ref = XLSX.utils.decode_range(ws["!ref"]!);
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null, range: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: ref.e }) });
      return { nom, rows };
    });
    const lu = lireClasseurBancaire(feuilles);
    expect(lu.mouvements.map((m) => [m.dateOp, m.libelle, m.debit, m.credit])).toEqual([
      ["2026-01-05", "LIBELLE 1", 100, 0],
      ["2026-01-20", "LIBELLE 2", 0, 500],
      ["2026-01-25", "LIBELLE 3", 12.5, 0],
      ["2026-02-03", "LIBELLE 4", 50, 0],
    ]);
    expect(lu.ouverture?.montant).toBe(1000);
  });

  it("sans mouvement : une feuille « Vide »", async () => {
    const octets = await classeurCompteStyle(compte, [], [], []);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(octets as never);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Vide"]);
  });
});

// Export Excel de l'état de souche de chèques — même patron visuel que
// src/lib/collecte/exportStyled.ts (bandeau bleu, bordures grises, montants
// formatés) et mêmes colonnes A→H que le modèle du cabinet, plus « Devise ».
// Les totaux par devise sont de vraies formules (SUMIFS) pour rester justes si
// l'utilisateur retouche le fichier. ExcelJS est chargé à la demande.
import type { Worksheet } from "exceljs";
import type { SoucheCheque } from "@/types";
import { ENTETES, DEVISES, totauxParDevise } from "./model";
import { safeName } from "./pdf";

const BLEU = "FF1F4E79";
const GRIS_BORD = "FFBFBFBF";
const MONTANT = "#,##0.000";

const fill = (argb: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } });
const border = {
  top: { style: "thin" as const, color: { argb: GRIS_BORD } },
  left: { style: "thin" as const, color: { argb: GRIS_BORD } },
  bottom: { style: "thin" as const, color: { argb: GRIS_BORD } },
  right: { style: "thin" as const, color: { argb: GRIS_BORD } },
};

function toDate(v: string | null): Date | null {
  const m = v ? /^(\d{4})-(\d{2})-(\d{2})/.exec(v) : null;
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
}

const HEADER_ROW = 4;
const FIRST = HEADER_ROW + 1;

function remplir(ws: Worksheet, list: SoucheCheque[]) {
  list.forEach((l, i) => {
    const r = ws.getRow(FIRST + i);
    const cells: [number, string | number | Date | null][] = [
      [1, l.banque],
      [2, l.numCheque],
      [3, toDate(l.dateEmission)],
      [4, l.beneficiaire],
      [5, l.motif],
      [6, l.montant],
      [7, l.debite ? "Oui" : "Non"],
      [8, toDate(l.dateDebit)],
      [9, l.devise],
    ];
    for (const [col, v] of cells) {
      const c = r.getCell(col);
      if (v !== null && v !== "") c.value = v;
      c.border = border;
      if (col === 2) c.numFmt = "@"; // N° de chèque : texte, garde les zéros de tête
      if (col === 3 || col === 8) c.numFmt = "dd/mm/yyyy";
      if (col === 6) c.numFmt = MONTANT;
      if (col === 7 || col === 9) c.alignment = { horizontal: "center" };
    }
  });
}

function totaux(ws: Worksheet, list: SoucheCheque[]) {
  const last = FIRST + list.length - 1;
  if (list.length === 0) return;
  const montants = `F${FIRST}:F${last}`;
  const statuts = `G${FIRST}:G${last}`;
  const devises = `I${FIRST}:I${last}`;
  const parDevise = new Map(totauxParDevise(list).map((t) => [t.devise, t]));
  let row = last + 2;
  for (const devise of DEVISES) {
    const t = parDevise.get(devise);
    if (!t) continue;
    const lignes: [string, string, number][] = [
      [`TOTAL ÉMIS (${devise})`, `SUMIFS(${montants},${devises},"${devise}")`, t.emis],
      [`TOTAL DÉBITÉ (${devise})`, `SUMIFS(${montants},${devises},"${devise}",${statuts},"Oui")`, t.debite],
      [`RESTE À DÉBITER (${devise})`, `SUMIFS(${montants},${devises},"${devise}",${statuts},"Non")`, t.restant],
    ];
    for (const [label, formule, valeur] of lignes) {
      const r = ws.getRow(row++);
      r.getCell(5).value = label;
      r.getCell(5).font = { bold: true };
      r.getCell(5).alignment = { horizontal: "right" };
      const c = r.getCell(6);
      c.value = { formula: formule, result: valeur };
      c.numFmt = MONTANT;
      c.font = { bold: true };
      c.border = border;
    }
    row++;
  }
}

export async function exportSoucheChequesStyled(list: SoucheCheque[], societeNom: string) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "CAMCONSULT";
  wb.calcProperties.fullCalcOnLoad = true;
  const ws = wb.addWorksheet("Souche de chèques", { views: [{ state: "frozen", ySplit: HEADER_ROW }] });

  const t = ws.getCell("A1");
  t.value = `État de souche de chèques — ${societeNom}`;
  t.font = { bold: true, size: 16, color: { argb: BLEU } };
  const s = ws.getCell("A2");
  s.value = `Édité le ${new Date().toLocaleDateString("fr-FR")} · ${list.length} chèque(s)`;
  s.font = { italic: true, size: 10, color: { argb: "FF7F7F7F" } };

  const head = ws.getRow(HEADER_ROW);
  ENTETES.forEach((label, i) => {
    const c = head.getCell(i + 1);
    c.value = label;
    c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    c.fill = fill(BLEU);
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = border;
  });
  head.height = 30;
  ws.columns = [18, 16, 16, 28, 34, 22, 20, 16, 10].map((width) => ({ width }));

  remplir(ws, list);
  totaux(ws, list);

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Souche_cheques_${safeName(societeNom)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

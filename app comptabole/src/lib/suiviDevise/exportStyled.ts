// Export Excel de la fiche « Suivi client devise » — même patron visuel que
// src/lib/collecte/exportStyled.ts (bandeau bleu, montants alignés/formatés),
// mais sans le système d'onglets configurables : 3 feuilles fixes (Ventes,
// Lots LC, Mouvements) + un total/solde en pied de chaque feuille. ExcelJS
// est chargé à la demande, uniquement au moment de l'export.
import type { Workbook, Worksheet } from "exceljs";
import type { SuiviDeviseFull } from "@/types";

const BLEU = "FF1F4E79";
const GRIS_BORD = "FFBFBFBF";
const MONTANT = "#,##0.00";

const fill = (argb: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } });
const border = {
  top: { style: "thin" as const, color: { argb: GRIS_BORD } },
  left: { style: "thin" as const, color: { argb: GRIS_BORD } },
  bottom: { style: "thin" as const, color: { argb: GRIS_BORD } },
  right: { style: "thin" as const, color: { argb: GRIS_BORD } },
};

function colLetter(n: number) {
  let s = "";
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
}

function enTetes(ws: Worksheet, row: number, labels: string[]) {
  const r = ws.getRow(row);
  labels.forEach((l, i) => {
    const c = r.getCell(i + 1);
    c.value = l;
    c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    c.fill = fill(BLEU);
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = border;
  });
  r.height = 28;
}

function titre(ws: Worksheet, texte: string, sousTitre: string) {
  const t = ws.getCell("A1");
  t.value = texte;
  t.font = { bold: true, size: 16, color: { argb: BLEU } };
  const s = ws.getCell("A2");
  s.value = sousTitre;
  s.font = { italic: true, size: 10, color: { argb: "FF7F7F7F" } };
}

function toDate(v: string | null): Date | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
}

function ligneTotal(ws: Worksheet, row: number, labelCol: number, label: string, montants: { col: number; formule: string; valeur: number }[]) {
  const r = ws.getRow(row);
  const lab = r.getCell(labelCol);
  lab.value = label;
  lab.font = { bold: true };
  for (const { col, formule, valeur } of montants) {
    const c = r.getCell(col);
    c.value = { formula: formule, result: Math.round(valeur * 100) / 100 };
    c.numFmt = MONTANT;
    c.font = { bold: true };
  }
}

const TYPE_LABELS: Record<string, string> = {
  charge_transport: "Charge transport",
  avoir: "Avoir",
  reglement: "Règlement",
};

const LOT_TYPE_LABELS: Record<string, string> = {
  aucun: "Aucun (EX WORK)",
  charges_trans_av: "Charges trans+av",
  avoir: "Avoir",
};

function feuilleVentes(wb: Workbook, fiche: SuiviDeviseFull, societeNom: string) {
  const ws = wb.addWorksheet("Ventes", { views: [{ state: "frozen", ySplit: 4 }] });
  titre(ws, `${fiche.client} — Ventes export`, `${societeNom} · ${fiche.exercice} · Devise ${fiche.devise}`);
  const labels = ["Date", "N° facture", "N° secondaire", "Mode paiement", "Désignation", "Fournisseur", "Lot", "Qté (T)", "PU", "Montant total", "Avoir", "Date avoir"];
  enTetes(ws, 4, labels);
  ws.columns = [14, 16, 16, 16, 24, 20, 16, 12, 12, 14, 12, 14].map((w) => ({ width: w }));

  const lotLabel = new Map(fiche.lots.map((l) => [l.id, l.libelle || "Lot sans nom"]));
  const first = 5;
  fiche.factures.forEach((f, i) => {
    const r = ws.getRow(first + i);
    const d = toDate(f.dateFacture);
    const vals: [number, unknown, "date" | "text" | "number"][] = [
      [1, d, "date"],
      [2, f.nFacture, "text"],
      [3, f.nSecondaire, "text"],
      [4, f.modePaiement, "text"],
      [5, f.designationProduit, "text"],
      [6, f.fournisseur, "text"],
      [7, f.lotId ? lotLabel.get(f.lotId) : "", "text"],
      [8, f.qteTonnes, "number"],
      [9, f.pu, "number"],
      [10, f.montantTotal, "number"],
      [11, f.avoirMontant, "number"],
      [12, toDate(f.avoirDate), "date"],
    ];
    for (const [col, v, type] of vals) {
      const c = r.getCell(col);
      if (v != null && v !== "") c.value = v as string | number | Date;
      if (type === "number") c.numFmt = MONTANT;
      if (type === "date") c.numFmt = "dd/mm/yyyy";
      c.border = border;
    }
  });
  const last = first + fiche.factures.length - 1;
  if (fiche.factures.length > 0) {
    const lotCol = colLetter(7);
    const montantCol = colLetter(10);
    // Seules les factures sans lot comptent dans le solde (voir
    // suiviDeviseFullDto côté serveur) — une facture rattachée à un lot LC
    // est déjà couverte par l'écart de ce lot, jamais réajoutée ici.
    ligneTotal(ws, last + 2, 6, "TOTAL VENTES (hors lots)", [
      {
        col: 10,
        formule: `SUMIF(${lotCol}${first}:${lotCol}${last},"",${montantCol}${first}:${montantCol}${last})`,
        valeur: fiche.totalVentes,
      },
    ]);
    if (fiche.totalVentesLots !== 0) {
      ligneTotal(ws, last + 3, 6, "dont factures de lots (hors solde)", [
        {
          col: 10,
          formule: `SUMIF(${lotCol}${first}:${lotCol}${last},"<>",${montantCol}${first}:${montantCol}${last})`,
          valeur: fiche.totalVentesLots,
        },
      ]);
    }
  }
}

function feuilleLots(wb: Workbook, fiche: SuiviDeviseFull, societeNom: string) {
  const ws = wb.addWorksheet("Lots LC", { views: [{ state: "frozen", ySplit: 4 }] });
  titre(ws, `${fiche.client} — Lots LC`, `${societeNom} · ${fiche.exercice} · Devise ${fiche.devise}`);
  enTetes(ws, 4, ["Lot", "Incoterm", "Régime", "Quantité (T)", "Prix rendu", "Rabais", "Écart (charges/avoir)"]);
  ws.columns = [24, 14, 18, 14, 14, 12, 18].map((w) => ({ width: w }));

  fiche.lots.forEach((l, i) => {
    const r = ws.getRow(5 + i);
    r.getCell(1).value = l.libelle || "Lot sans nom";
    r.getCell(2).value = l.incoterm;
    r.getCell(3).value = LOT_TYPE_LABELS[l.type] ?? l.type;
    r.getCell(4).value = l.quantiteTonnes;
    r.getCell(5).value = l.prixRendu;
    r.getCell(6).value = l.rabais;
    r.getCell(7).value = l.ecart;
    [4, 5, 6, 7].forEach((c) => (r.getCell(c).numFmt = MONTANT));
    for (let c = 1; c <= 7; c++) r.getCell(c).border = border;
  });
}

function feuilleMouvements(wb: Workbook, fiche: SuiviDeviseFull, societeNom: string) {
  const ws = wb.addWorksheet("Mouvements", { views: [{ state: "frozen", ySplit: 4 }] });
  titre(ws, `${fiche.client} — Mouvements`, `${societeNom} · ${fiche.exercice} · Devise ${fiche.devise}`);
  enTetes(ws, 4, ["Type", "Date", "Libellé", "Lot", "Montant"]);
  ws.columns = [18, 14, 30, 20, 14].map((w) => ({ width: w }));

  const lotLabel = new Map(fiche.lots.map((l) => [l.id, l.libelle || "Lot sans nom"]));
  const first = 5;
  fiche.mouvements.forEach((m, i) => {
    const r = ws.getRow(first + i);
    r.getCell(1).value = TYPE_LABELS[m.type] ?? m.type;
    const d = toDate(m.date);
    if (d) r.getCell(2).value = d;
    r.getCell(3).value = m.libelle;
    r.getCell(4).value = m.lotId ? lotLabel.get(m.lotId) : "";
    r.getCell(5).value = m.montant;
    r.getCell(2).numFmt = "dd/mm/yyyy";
    r.getCell(5).numFmt = MONTANT;
    for (let c = 1; c <= 5; c++) r.getCell(c).border = border;
  });
  const last = first + fiche.mouvements.length - 1;

  const rows = [
    ["TOTAL VENTES (déduit)", -fiche.totalVentes],
    ["ÉCARTS DES LOTS (charges/avoir)", fiche.totalEcartsLots],
    ["CHARGES (mouvements)", fiche.totalCharges],
    ["AVOIRS (mouvements)", fiche.totalAvoir],
    ["RÈGLEMENTS", fiche.totalReglements],
    ...(fiche.soldeOuverture !== 0 ? [["SOLDE D'OUVERTURE", fiche.soldeOuverture] as const] : []),
  ] as const;
  rows.forEach(([label, valeur], i) => {
    const r = ws.getRow(last + 3 + i);
    r.getCell(3).value = label;
    r.getCell(5).value = valeur;
    r.getCell(5).numFmt = MONTANT;
  });
  const rSoldeFinal = ws.getRow(last + 3 + rows.length + 1);
  rSoldeFinal.getCell(3).value = "SOLDE";
  rSoldeFinal.getCell(3).font = { bold: true };
  rSoldeFinal.getCell(5).value = fiche.solde;
  rSoldeFinal.getCell(5).font = { bold: true };
  rSoldeFinal.getCell(5).numFmt = MONTANT;
}

const safe = (s: string) => s.replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "").slice(0, 80);

async function telecharger(wb: Workbook, nomFichier: string) {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomFichier;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function exportSuiviDeviseStyled(fiche: SuiviDeviseFull, societeNom: string) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "CAMCONSULT";
  wb.calcProperties.fullCalcOnLoad = true;
  feuilleVentes(wb, fiche, societeNom);
  if (fiche.lots.length > 0) feuilleLots(wb, fiche, societeNom);
  feuilleMouvements(wb, fiche, societeNom);
  await telecharger(wb, `Suivi_devise_${safe(`${societeNom}-${fiche.client}-${fiche.exercice}`)}.xlsx`);
}

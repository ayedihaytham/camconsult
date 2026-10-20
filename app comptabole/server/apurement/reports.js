import { nomsActeurs } from "../acteurs.js";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { formatTnd } from "./amounts.js";
const columns = [
  "Autorisation",
  "BC",
  "Date BC",
  "Fournisseur",
  "MF vérifié",
  "Facture",
  "Date",
  "HT TND",
  "TVA suspendue TND",
  "Mode TVA",
  "Objet",
];
function values(r) {
  return [
    r.autorisation_numero,
    r.bc_numero,
    r.date_bc,
    r.raison_sociale,
    r.matricule_fiscal_normalise,
    r.numero_facture,
    r.date_facture || r.date_brute,
    formatTnd(r.montant_ht_millimes),
    formatTnd(r.tva_suspendue_millimes),
    r.tva_mode,
    r.objet,
  ];
}
export async function exportExcel(s) {
  const w = new ExcelJS.Workbook();
  w.creator = "CamConsult";
  w.created = new Date(s.approvedAt || s.generatedAt);
  const sheet = w.addWorksheet("Achats en suspension");
  sheet.addRow([
    `${s.approvedAt ? "État interne validé" : "BROUILLON NON VALIDÉ"} — aucune certification BCD officielle`,
  ]);
  sheet.addRow([
    s.profil.raisonSociale,
    s.annee,
    s.trimestre,
    `Version ${s.version}`,
  ]);
  sheet.addRow(columns);
  for (const row of s.lignes) sheet.addRow(values(row));
  sheet.addRow([
    "TOTAL HT",
    formatTnd(s.totals.ht),
    "TVA détails",
    formatTnd(s.totals.tvaLignes),
    "TVA globale",
    formatTnd(s.totals.tvaGlobale),
    "Écart",
    formatTnd(s.totals.ecart),
  ]);
  const review = w.addWorksheet("Contrôles et validation");
  review.addRow([
    "Empreinte / politique",
    s.politique?.reference || "Calcul provisoire",
  ]);
  review.addRow(["Approbateur", s.approvedBy ? (await nomsActeurs([s.approvedBy])).get(String(s.approvedBy)) || String(s.approvedBy) : "Brouillon"]);
  review.addRow(["Justification écart", s.motifEcart || ""]);
  for (const c of s.controls)
    review.addRow([c.factureId, c.code, c.message, c.ack?.motif || ""]);
  const evidence = w.addWorksheet("Justificatifs");
  evidence.addRow(["Dossier", "Nom", "SHA-256"]);
  for (const p of s.pieces)
    evidence.addRow([p.parent_type, p.nom, p.preuve_hash]);
  sheet.views = [{ state: "frozen", ySplit: 3 }];
  sheet.columns.forEach((c) => {
    c.width = 22;
  });
  sheet.getColumn(8).alignment = { horizontal: "right" };
  sheet.getColumn(9).alignment = { horizontal: "right" };
  sheet.getRow(3).font = { bold: true };
  return Buffer.from(await w.xlsx.writeBuffer());
}
export function exportPdf(s) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setFontSize(13);
  doc.text("Apurement des achats en suspension de TVA", 14, 15);
  doc.setFontSize(9);
  doc.text(
    `${s.profil.raisonSociale} - ${s.annee} ${s.trimestre} - Version ${s.version} - ${s.approvedAt ? "Validee en interne" : "BROUILLON NON VALIDE"}`,
    14,
    22,
  );
  doc.text(
    "Rapport interne. Aucune certification du format BCD officiel.",
    14,
    28,
  );
  autoTable(doc, {
    startY: 34,
    head: [columns],
    body: s.lignes.map(values),
    styles: { fontSize: 7, cellPadding: 1.5 },
    theme: "striped",
  });
  doc.addPage();
  doc.text(`Total HT : ${formatTnd(s.totals.ht)} TND`, 14, 18);
  doc.text(
    `TVA details : ${formatTnd(s.totals.tvaLignes)} - TVA globale : ${formatTnd(s.totals.tvaGlobale)} - Ecart : ${formatTnd(s.totals.ecart)}`,
    14,
    25,
  );
  autoTable(doc, {
    startY: 34,
    head: [["Facture", "Contrôle", "Revue"]],
    body: s.controls.map((c) => [c.factureId, c.message, c.ack?.motif || ""]),
    styles: { fontSize: 8 },
  });
  return Buffer.from(doc.output("arraybuffer"));
}

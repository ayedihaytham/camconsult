// Vrai fichier PDF (téléchargé, sans passer par l'impression), même charte
// que les exports Excel : titre bleu, bandeau d'en-têtes bleu foncé, ligne
// de total en gras. Module chargé à la demande (jsPDF est lourd).
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import type { SectionReport } from "./exportXlsx";

const BLEU: [number, number, number] = [31, 78, 121];
const GRIS: [number, number, number] = [110, 110, 110];
const MARGE = 36;

export async function downloadReportPdf(rep: SectionReport): Promise<void> {
  // Tableaux larges (7 colonnes et plus) : paysage, sinon portrait.
  const doc = new jsPDF({
    orientation: rep.header.length >= 7 ? "landscape" : "portrait",
    unit: "pt",
    format: "a4",
  });
  const largeur = doc.internal.pageSize.getWidth();
  const hauteur = doc.internal.pageSize.getHeight();
  const edite = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" })
    .format(new Date())
    .replace(/[  ]/g, " ");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(201, 162, 75);
  doc.text("CAMCONSULT", MARGE, MARGE + 4);
  doc.setFontSize(15);
  doc.setTextColor(...BLEU);
  doc.text(rep.title, MARGE, MARGE + 26, { maxWidth: largeur - 2 * MARGE });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRIS);
  doc.text(rep.subtitle, MARGE, MARGE + 42, { maxWidth: largeur - 2 * MARGE });

  const dernier = rep.rows.length - 1;
  autoTable(doc, {
    startY: MARGE + 56,
    margin: { left: MARGE, right: MARGE, bottom: MARGE + 14 },
    head: [rep.header],
    body: rep.rows.length ? rep.rows : [[{ content: "Aucune ligne saisie.", colSpan: rep.header.length }]],
    styles: { font: "helvetica", fontSize: 8, cellPadding: 4, lineColor: [200, 200, 200], lineWidth: 0.4, textColor: 30 },
    headStyles: { fillColor: BLEU, textColor: 255, fontStyle: "bold", halign: "center", valign: "middle" },
    alternateRowStyles: { fillColor: [247, 248, 250] },
    columnStyles: Object.fromEntries(rep.align.map((a, i) => [i, { halign: a }])),
    didParseCell: (d) => {
      if (rep.totalRow && d.section === "body" && d.row.index === dernier) {
        d.cell.styles.fontStyle = "bold";
        d.cell.styles.fillColor = [232, 238, 245];
      }
    },
  });

  // Pied de page sur chaque page : date d'édition + pagination.
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRIS);
    doc.text(`Édité le ${edite}`, MARGE, hauteur - MARGE / 2);
    doc.text(`Page ${p} / ${pages}`, largeur - MARGE, hauteur - MARGE / 2, { align: "right" });
  }

  doc.save(`${rep.fileBase}.pdf`);
}

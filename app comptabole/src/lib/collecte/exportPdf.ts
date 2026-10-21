// Vrai fichier PDF (téléchargé, sans passer par l'impression), même charte
// que les exports Excel : titre bleu, bandeau d'en-têtes bleu foncé, ligne
// de total en gras. Module chargé à la demande (jsPDF est lourd).
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { identiteCabinetPdf } from "../pdfIdentite";
import { ENTETE_COURANT, MARGE, dessinerEntete, dessinerPages } from "../pdfModele";
import type { SectionReport } from "./exportXlsx";

const BLEU: [number, number, number] = [31, 78, 121];

async function construirePdf(rep: SectionReport) {
  // Tableaux larges (7 colonnes et plus) : paysage, sinon portrait.
  const doc = new jsPDF({
    orientation: rep.header.length >= 7 ? "landscape" : "portrait",
    unit: "pt",
    format: "a4",
  });
  // Modèle du cabinet : logo, coordonnées, en-tête courant et pied de page.
  const { logo, cabinet } = await identiteCabinetPdf();
  const modele = { titre: rep.title, sousTitre: rep.subtitle, logo, cabinet, mention: "Collecte de pièces" };
  const debut = dessinerEntete(doc, modele);

  const dernier = rep.rows.length - 1;
  autoTable(doc, {
    startY: debut,
    margin: { top: ENTETE_COURANT, left: MARGE, right: MARGE, bottom: MARGE + 24 },
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

  dessinerPages(doc, modele);
  return doc;
}

export async function downloadReportPdf(rep: SectionReport): Promise<void> {
  const doc = await construirePdf(rep);
  doc.save(`${rep.fileBase}.pdf`);
}

/** Le même PDF, sous forme d'URL de données, pour l'afficher avant de le télécharger. */
export async function apercuReportPdf(rep: SectionReport): Promise<string> {
  const doc = await construirePdf(rep);
  const brut = doc.output("datauristring");
  return `data:application/pdf;base64,${brut.slice(brut.indexOf("base64,") + 7)}`;
}

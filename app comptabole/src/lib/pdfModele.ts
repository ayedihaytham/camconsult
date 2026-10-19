// Modèle commun des PDF de tableaux du cabinet : logo et coordonnées, en-tête de la première page, en-tête courant des pages suivantes,
// filets dorés, pied de page (coordonnées, date d'édition, pagination). Utilisé par tous les exports PDF de tableaux.
import type { jsPDF as JsPDF } from "jspdf";

export const BLEU: [number, number, number] = [31, 78, 121];
export const GRIS: [number, number, number] = [110, 110, 110];
export const DORE: [number, number, number] = [201, 162, 75];
export const MARGE = 36;
/** Hauteur réservée en haut des pages suivantes pour l'en-tête courant (logo réduit + titre). */
export const ENTETE_COURANT = 78;

/** Espaces normales : les polices PDF standard n'ont pas l'espace fine insécable. */
export const nettoyer = (s: string) => s.replace(/[  ]/g, " ");

export interface CabinetPdf {
  nom?: string;
  adresse?: string;
  matriculeFiscal?: string;
  telephone?: string;
  email?: string;
}

export interface ModelePdf {
  titre: string;
  sousTitre?: string;
  /** Logo en data URL PNG ; sans logo (ou illisible), le nom du cabinet le remplace. */
  logo?: string | null;
  cabinet?: CabinetPdf | null;
  /** Petite mention sous le nom du cabinet, en haut à droite (ex. « Document converti »). */
  mention?: string;
}

const nomDuCabinet = (m: ModelePdf) => nettoyer((m.cabinet?.nom ?? "").trim()) || "CAMCONSULT";

/** Pose le logo à la hauteur voulue ; faux s'il est absent ou illisible. */
function poserLogo(doc: JsPDF, logo: string | null | undefined, hauteur: number): boolean {
  if (!logo) return false;
  try {
    const p = doc.getImageProperties(logo);
    doc.addImage(logo, "PNG", MARGE, MARGE, (p.width / p.height) * hauteur, hauteur);
    return true;
  } catch {
    return false;
  }
}

/** En-tête de la première page ; renvoie l'ordonnée où commence le contenu. */
export function dessinerEntete(doc: JsPDF, m: ModelePdf): number {
  const largeur = doc.internal.pageSize.getWidth();
  const utile = largeur - 2 * MARGE;
  const nom = nomDuCabinet(m);
  if (!poserLogo(doc, m.logo, 34)) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...BLEU);
    doc.text(nom, MARGE, MARGE + 16);
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...BLEU);
  doc.text(nom, largeur - MARGE, MARGE + 10, { align: "right" });
  if (m.mention) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRIS);
    doc.text(nettoyer(m.mention), largeur - MARGE, MARGE + 22, { align: "right" });
  }
  doc.setDrawColor(...DORE);
  doc.setLineWidth(1.2);
  doc.line(MARGE, MARGE + 44, largeur - MARGE, MARGE + 44);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...BLEU);
  doc.text(nettoyer(m.titre), MARGE, MARGE + 66, { maxWidth: utile });
  if (!m.sousTitre) return MARGE + 74;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRIS);
  doc.text(nettoyer(m.sousTitre), MARGE, MARGE + 82, { maxWidth: utile });
  return MARGE + 90;
}

/** Sur chaque page : en-tête courant (pages suivantes), filet, coordonnées du cabinet, date d'édition et « Page x / y ». */
export function dessinerPages(doc: JsPDF, m: ModelePdf): void {
  const largeur = doc.internal.pageSize.getWidth();
  const hauteur = doc.internal.pageSize.getHeight();
  const utile = largeur - 2 * MARGE;
  const nom = nomDuCabinet(m);
  const cab = m.cabinet ?? null;
  const edite = nettoyer(new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(new Date()));
  const coordonnees = nettoyer(
    [cab?.nom, cab?.adresse, cab?.matriculeFiscal && `MF ${cab.matriculeFiscal}`, cab?.telephone && `Tél. ${cab.telephone}`, cab?.email]
      .filter((v) => v && String(v).trim())
      .join("  ·  "),
  );
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    if (p > 1) {
      if (!poserLogo(doc, m.logo, 22)) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(...BLEU);
        doc.text(nom, MARGE, MARGE + 14);
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...GRIS);
      doc.text(nettoyer(m.titre), largeur - MARGE, MARGE + 14, { align: "right", maxWidth: utile - 120 });
      doc.setDrawColor(...DORE);
      doc.setLineWidth(0.8);
      doc.line(MARGE, MARGE + 30, largeur - MARGE, MARGE + 30);
    }
    doc.setDrawColor(...DORE);
    doc.setLineWidth(0.8);
    doc.line(MARGE, hauteur - 38, largeur - MARGE, hauteur - 38);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...GRIS);
    if (coordonnees) doc.text(coordonnees, largeur / 2, hauteur - 27, { align: "center", maxWidth: utile });
    doc.text(`Édité le ${edite}`, MARGE, hauteur - 14);
    doc.text(`Page ${p} / ${pages}`, largeur - MARGE, hauteur - 14, { align: "right" });
  }
}

// Vrai fichier PDF à partir de tableaux « lignes × colonnes » (les mêmes que
// ceux des exports Excel) — téléchargé directement, sans la fenêtre
// d'impression. Charte : CAMCONSULT, titre bleu, bandeaux bleus, montants
// « 1 200,50 ». jsPDF est chargé à la demande.
import type { jsPDF as JsPDF } from "jspdf";

export type PdfCell = string | number;

export interface PdfSheet {
  /** titre de la partie (affiché si le document contient plusieurs parties) */
  name: string;
  rows: PdfCell[][];
  /** la 1re ligne est une ligne d'en-têtes */
  headerRow?: boolean;
  /** Nombre de lignes finales à styler comme totaux (gras, fond gris) même en
   * mode `plain` — pour les tableaux dont la 1re colonne peut être en
   * MAJUSCULES sans être un total (ex. noms de banque). */
  totalRows?: number;
}

const BLEU: [number, number, number] = [31, 78, 121];
const GRIS: [number, number, number] = [110, 110, 110];
const MARGE = 36;

/** Espaces normales : les polices PDF standard n'ont pas l'espace fine insécable. */
const clean = (s: string) => s.replace(/[  ]/g, " ");
const fmt = (n: number) =>
  clean(
    // jamais « -0,00 » (zéro négatif issu des calculs de signe)
    (Math.abs(n) < 0.005 ? 0 : n).toLocaleString("fr-FR", {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }),
  );

const isUpper = (s: string) => /\p{L}/u.test(s) && s === s.toLocaleUpperCase("fr");

interface TablesPdfOpts {
  title: string;
  subtitle?: string;
  sheets: PdfSheet[];
  fileName: string;
  /** Désactive la détection de bandeaux/totaux (déduite des tableaux
   * comptables du cabinet — une cellule seule en MAJUSCULES, "EXERCICE…",
   * etc.) : pour un tableur quelconque (voir la page Conversions), ces
   * heuristiques produisent des faux positifs. Tableau simple à la place. */
  plain?: boolean;
  /** Sens de la page : « auto » passe en paysage dès 6 colonnes (comportement historique). */
  orientation?: "auto" | "portrait" | "landscape";
  format?: "a4" | "a3";
  /** Faux : ni en-tête ni pied de page (titre, logo, coordonnées du cabinet). */
  entete?: boolean;
  /** Logo en data URL PNG (voir chargerLogo dans facturePdf) ; sans logo, le mot CAMCONSULT le remplace. */
  logo?: string | null;
  /** Coordonnées imprimées dans l'en-tête et le pied de page. */
  cabinet?: { nom?: string; adresse?: string; matriculeFiscal?: string; telephone?: string; email?: string } | null;
}

/** Hauteur réservée en haut des pages suivantes pour l'en-tête courant (logo réduit + titre). */
const ENTETE_COURANT = 78;
const DORE: [number, number, number] = [201, 162, 75];

/** Construit le document sans le télécharger — pour un aperçu (iframe,
 * blob URL) avant de laisser l'utilisateur déclencher lui-même le
 * téléchargement (voir ConversionsPage.tsx). `downloadTablesPdf`
 * ci-dessous reste le raccourci "construire + télécharger" pour les
 * appelants qui n'ont pas besoin d'aperçu. */
export async function buildTablesPdf(input: TablesPdfOpts): Promise<JsPDF> {
  // Sans logo ni coordonnées fournis par l'appelant, tous les PDF de tableaux reçoivent le modèle du cabinet.
  const identite = input.logo === undefined && input.cabinet === undefined && input.entete !== false ? (await import("./pdfIdentite")).identiteCabinetPdf() : null;
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const opts = identite ? { ...input, ...(await identite) } : input;
  const maxCols = Math.max(1, ...opts.sheets.flatMap((s) => s.rows.map((r) => r.length)));
  const orientation = opts.orientation ?? "auto";
  const doc = new jsPDF({
    orientation: orientation === "auto" ? (maxCols >= 6 ? "landscape" : "portrait") : orientation,
    unit: "pt",
    format: opts.format ?? "a4",
  });
  const largeur = doc.internal.pageSize.getWidth();
  const hauteur = doc.internal.pageSize.getHeight();
  const utile = largeur - 2 * MARGE;
  const entete = opts.entete !== false;

  // Modèle complet (page Conversions) : logo, coordonnées du cabinet, en-tête courant et pied de page. Les autres exports gardent leur mise en page.
  const complet = entete && (opts.logo !== undefined || opts.cabinet !== undefined);
  const hautPages = complet ? ENTETE_COURANT : MARGE;
  const cab = opts.cabinet ?? null;
  const nomCabinet = clean((cab?.nom ?? "").trim()) || "CAMCONSULT";

  /** Logo à la hauteur voulue ; faux si absent ou illisible (le nom du cabinet le remplace). */
  const poserLogo = (h: number): boolean => {
    if (!opts.logo) return false;
    try {
      const p = doc.getImageProperties(opts.logo);
      doc.addImage(opts.logo, "PNG", MARGE, MARGE, (p.width / p.height) * h, h);
      return true;
    } catch {
      return false;
    }
  };

  let y = MARGE;
  if (complet) {
    const logoPose = poserLogo(34);
    if (!logoPose) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(...BLEU);
      doc.text(nomCabinet, MARGE, MARGE + 16);
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...BLEU);
    doc.text(nomCabinet, largeur - MARGE, MARGE + 10, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRIS);
    doc.text("Document converti", largeur - MARGE, MARGE + 22, { align: "right" });
    doc.setDrawColor(...DORE);
    doc.setLineWidth(1.2);
    doc.line(MARGE, MARGE + 44, largeur - MARGE, MARGE + 44);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...BLEU);
    doc.text(clean(opts.title), MARGE, MARGE + 66, { maxWidth: utile });
    y = MARGE + 74;
    if (opts.subtitle) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...GRIS);
      doc.text(clean(opts.subtitle), MARGE, MARGE + 82, { maxWidth: utile });
      y = MARGE + 90;
    }
  } else if (entete) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...DORE);
    doc.text("CAMCONSULT", MARGE, MARGE + 4);
    doc.setFontSize(15);
    doc.setTextColor(...BLEU);
    doc.text(clean(opts.title), MARGE, MARGE + 26, { maxWidth: utile });
    y = MARGE + 34;
    if (opts.subtitle) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...GRIS);
      doc.text(clean(opts.subtitle), MARGE, MARGE + 42, { maxWidth: utile });
      y = MARGE + 50;
    }
  }

  const multi = opts.sheets.length > 1;
  opts.sheets.forEach((sheet, idx) => {
    if (multi) {
      if (idx > 0) {
        doc.addPage();
        y = hautPages;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(...BLEU);
      doc.text(clean(sheet.name), MARGE, y + 12);
      y += 20;
    }
    const cols = Math.max(1, ...sheet.rows.map((r) => r.length));
    const pad = (r: PdfCell[]) =>
      Array.from({ length: cols }, (_, i) => {
        const v = r[i];
        return typeof v === "number" ? fmt(v) : clean(String(v ?? ""));
      });
    const src = sheet.headerRow ? sheet.rows.slice(1) : sheet.rows;

    // Styles de ligne déduits du contenu (mêmes tableaux que l'Excel) :
    // une seule cellule en MAJUSCULES = bandeau de section ; « EXERCICE … » =
    // bandeau bleu ; une seule cellule en minuscules = libellé pleine largeur ;
    // libellé en MAJUSCULES avec des montants = ligne de total (gras).
    // 3 cellules de texte ou plus, sans aucun montant = sous-en-têtes (ex.
    // « Produits | Montant | Charges | Montant » du SIG) — pas les paires
    // libellé / valeur des Notes (« Forme juridique | SARL »).
    type Kind = "band" | "exercice" | "line" | "total" | "subhead" | "normal";
    const kinds: Kind[] = [];
    const body: unknown[] = [];
    src.forEach((r, i) => {
      const filled = r.filter((v) => v !== "" && v != null);
      if (filled.length === 0) return;
      if (opts.plain) {
        kinds.push(i >= src.length - (sheet.totalRows ?? 0) ? "total" : "normal");
        body.push(pad(r));
        return;
      }
      const first = String(r[0] ?? "");
      if (filled.length === 1 && r[0] !== "" && r[0] != null) {
        const kind: Kind = /^EXERCICE\b/.test(first) ? "exercice" : isUpper(first) ? "band" : "line";
        kinds.push(kind);
        body.push([{ content: clean(first), colSpan: cols }]);
        return;
      }
      kinds.push(
        isUpper(first)
          ? "total"
          : filled.length >= 3 && filled.every((v) => typeof v === "string")
            ? "subhead"
            : "normal",
      );
      body.push(pad(r));
    });
    const numericCol = Array.from({ length: cols }, (_, i) => src.some((r) => typeof r[i] === "number"));

    autoTable(doc, {
      startY: y,
      margin: { ...(complet ? { top: hautPages } : {}), left: MARGE, right: MARGE, bottom: complet ? MARGE + 24 : MARGE + 14 },
      head: sheet.headerRow ? [pad(sheet.rows[0] ?? [])] : undefined,
      body: body.length ? (body as never) : [[{ content: "Aucune donnée.", colSpan: cols }]],
      styles: { font: "helvetica", fontSize: 8, cellPadding: 3.5, lineColor: [210, 210, 210], lineWidth: 0.4, textColor: 30 },
      headStyles: { fillColor: BLEU, textColor: 255, fontStyle: "bold", halign: "center", valign: "middle" },
      columnStyles: Object.fromEntries(numericCol.map((n, i) => [i, { halign: n ? "right" : "left" }])),
      didParseCell: (d) => {
        if (d.section !== "body") return;
        const k = kinds[d.row.index];
        if (k === "band") {
          d.cell.styles.fontStyle = "bold";
          d.cell.styles.fillColor = [232, 238, 245];
          d.cell.styles.textColor = BLEU;
        } else if (k === "exercice") {
          d.cell.styles.fontStyle = "bold";
          d.cell.styles.fillColor = BLEU;
          d.cell.styles.textColor = 255;
        } else if (k === "line") {
          d.cell.styles.fontStyle = String(d.cell.raw ?? "").length <= 80 ? "bold" : "normal";
          d.cell.styles.halign = "left";
        } else if (k === "total") {
          d.cell.styles.fontStyle = "bold";
          d.cell.styles.fillColor = [244, 246, 249];
        } else if (k === "subhead") {
          d.cell.styles.fontStyle = "bold";
          d.cell.styles.textColor = BLEU;
          d.cell.styles.fillColor = [238, 242, 247];
        }
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;
  });

  const edite = clean(
    new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(new Date()),
  );
  const pages = doc.getNumberOfPages();
  const coordonnees = clean(
    [cab?.nom, cab?.adresse, cab?.matriculeFiscal && `MF ${cab.matriculeFiscal}`, cab?.telephone && `Tél. ${cab.telephone}`, cab?.email]
      .filter((v) => v && String(v).trim())
      .join("  ·  "),
  );
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    if (complet) {
      if (p > 1) {
        // en-tête courant des pages suivantes : logo réduit, titre, filet doré
        if (!poserLogo(22)) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(...BLEU);
          doc.text(nomCabinet, MARGE, MARGE + 14);
        }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...GRIS);
        doc.text(clean(opts.title), largeur - MARGE, MARGE + 14, { align: "right", maxWidth: utile - 120 });
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
      continue;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRIS);
    doc.text(`Édité le ${edite}`, MARGE, hauteur - MARGE / 2);
    doc.text(`Page ${p} / ${pages}`, largeur - MARGE, hauteur - MARGE / 2, { align: "right" });
  }
  return doc;
}

export async function downloadTablesPdf(opts: TablesPdfOpts): Promise<void> {
  const doc = await buildTablesPdf(opts);
  doc.save(opts.fileName.endsWith(".pdf") ? opts.fileName : `${opts.fileName}.pdf`);
}

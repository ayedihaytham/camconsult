// Vrai fichier PDF à partir de tableaux « lignes × colonnes » (les mêmes que
// ceux des exports Excel) — téléchargé directement, sans la fenêtre
// d'impression. Charte : CAMCONSULT, titre bleu, bandeaux bleus, montants
// « 1 200,50 ». jsPDF est chargé à la demande.
import type { jsPDF as JsPDF } from "jspdf";
import { BLEU, DORE, ENTETE_COURANT, GRIS, MARGE, dessinerEntete, dessinerPages, type CabinetPdf } from "./pdfModele";

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
  /** Bandeaux de groupes posés au-dessus des en-têtes (ex. VENTE, ACHAT) : colonnes de `de` à `a` (indices à partir de 0, bornes comprises). */
  groupes?: { titre: string; de: number; a: number }[];
}


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
  cabinet?: CabinetPdf | null;
  /** Mention sous le nom du cabinet, en haut à droite (ex. « Document converti ») ; aucune par défaut. */
  mention?: string;
  /** Plusieurs parties à la suite les unes des autres, sans saut de page entre elles (défaut : une partie par page). */
  enchainer?: boolean;
}


/** Ligne de bandeaux de groupes de l'en-tête : une cellule par groupe (sur ses colonnes), des cellules vides ailleurs. */
function ligneGroupes(groupes: NonNullable<PdfSheet["groupes"]>, cols: number): { content: string; colSpan?: number }[] {
  const ligne: { content: string; colSpan?: number }[] = [];
  for (let i = 0; i < cols; i++) {
    const g = groupes.find((x) => x.de === i);
    if (g) {
      ligne.push({ content: g.titre, colSpan: g.a - g.de + 1 });
      i = g.a;
    } else ligne.push({ content: "" });
  }
  return ligne;
}

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

  // Modèle du cabinet (logo, coordonnées, en-tête courant, pied de page) dès que l'identité est connue ; sinon la mise en page historique.
  const complet = entete && (opts.logo !== undefined || opts.cabinet !== undefined);
  const hautPages = complet ? ENTETE_COURANT : MARGE;
  const modele = { titre: opts.title, sousTitre: opts.subtitle, logo: opts.logo, cabinet: opts.cabinet, mention: opts.mention };

  let y = MARGE;
  if (complet) {
    y = dessinerEntete(doc, modele);
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
      // Plusieurs parties : une par page, ou à la suite (`enchainer`) tant qu'il reste de la place pour un titre et quelques lignes.
      if (idx > 0 && (!opts.enchainer || y > hauteur - MARGE - 110)) {
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
      head: sheet.headerRow ? [...(sheet.groupes?.length ? [ligneGroupes(sheet.groupes, cols)] : []), pad(sheet.rows[0] ?? [])] : undefined,
      body: body.length ? (body as never) : [[{ content: "Aucune donnée.", colSpan: cols }]],
      styles: { font: "helvetica", fontSize: 8, cellPadding: 3.5, lineColor: [210, 210, 210], lineWidth: 0.4, textColor: 30 },
      headStyles: { fillColor: BLEU, textColor: 255, fontStyle: "bold", halign: "center", valign: "middle" },
      columnStyles: Object.fromEntries(numericCol.map((n, i) => [i, { halign: n ? "right" : "left" }])),
      didParseCell: (d) => {
        if (d.section === "head" && sheet.groupes?.length && d.row.index === 0) {
          const g = sheet.groupes.findIndex((x) => x.de === d.column.index);
          d.cell.styles.fillColor = g < 0 ? [255, 255, 255] : g % 2 === 0 ? BLEU : [46, 117, 182];
          d.cell.styles.lineWidth = g < 0 ? 0 : 0.4;
          return;
        }
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

  if (complet) {
    dessinerPages(doc, modele);
    return doc;
  }
  const edite = clean(new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(new Date()));
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
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

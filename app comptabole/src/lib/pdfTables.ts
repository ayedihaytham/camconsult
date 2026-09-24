// Vrai fichier PDF à partir de tableaux « lignes × colonnes » (les mêmes que
// ceux des exports Excel) — téléchargé directement, sans la fenêtre
// d'impression. Charte : CAMCONSULT, titre bleu, bandeaux bleus, montants
// « 1 200,50 ». jsPDF est chargé à la demande.

export type PdfCell = string | number;

export interface PdfSheet {
  /** titre de la partie (affiché si le document contient plusieurs parties) */
  name: string;
  rows: PdfCell[][];
  /** la 1re ligne est une ligne d'en-têtes */
  headerRow?: boolean;
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
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
  );

const isUpper = (s: string) => /\p{L}/u.test(s) && s === s.toLocaleUpperCase("fr");

export async function downloadTablesPdf(opts: {
  title: string;
  subtitle?: string;
  sheets: PdfSheet[];
  fileName: string;
}): Promise<void> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const maxCols = Math.max(1, ...opts.sheets.flatMap((s) => s.rows.map((r) => r.length)));
  const doc = new jsPDF({ orientation: maxCols >= 6 ? "landscape" : "portrait", unit: "pt", format: "a4" });
  const largeur = doc.internal.pageSize.getWidth();
  const hauteur = doc.internal.pageSize.getHeight();
  const utile = largeur - 2 * MARGE;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(201, 162, 75);
  doc.text("CAMCONSULT", MARGE, MARGE + 4);
  doc.setFontSize(15);
  doc.setTextColor(...BLEU);
  doc.text(clean(opts.title), MARGE, MARGE + 26, { maxWidth: utile });
  let y = MARGE + 34;
  if (opts.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...GRIS);
    doc.text(clean(opts.subtitle), MARGE, MARGE + 42, { maxWidth: utile });
    y = MARGE + 50;
  }

  const multi = opts.sheets.length > 1;
  opts.sheets.forEach((sheet, idx) => {
    if (multi) {
      if (idx > 0) {
        doc.addPage();
        y = MARGE;
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
    for (const r of src) {
      const filled = r.filter((v) => v !== "" && v != null);
      if (filled.length === 0) continue;
      const first = String(r[0] ?? "");
      if (filled.length === 1 && r[0] !== "" && r[0] != null) {
        const kind: Kind = /^EXERCICE\b/.test(first) ? "exercice" : isUpper(first) ? "band" : "line";
        kinds.push(kind);
        body.push([{ content: clean(first), colSpan: cols }]);
        continue;
      }
      kinds.push(
        isUpper(first)
          ? "total"
          : filled.length >= 3 && filled.every((v) => typeof v === "string")
            ? "subhead"
            : "normal",
      );
      body.push(pad(r));
    }
    const numericCol = Array.from({ length: cols }, (_, i) => src.some((r) => typeof r[i] === "number"));

    autoTable(doc, {
      startY: y,
      margin: { left: MARGE, right: MARGE, bottom: MARGE + 14 },
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
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRIS);
    doc.text(`Édité le ${edite}`, MARGE, hauteur - MARGE / 2);
    doc.text(`Page ${p} / ${pages}`, largeur - MARGE, hauteur - MARGE / 2, { align: "right" });
  }
  doc.save(opts.fileName.endsWith(".pdf") ? opts.fileName : `${opts.fileName}.pdf`);
}

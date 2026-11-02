// Classeur Excel du suivi bancaire aux couleurs de l'application (marine et or), avec la même mise en forme soignée que les exports de la Collecte :
// bandeau de titre, en-têtes en bandeau, lignes en alternance, bordures fines, montants à trois décimales, dates en jj/mm/aaaa, volet figé, filtre,
// impression en paysage. Les cellules et leur disposition sont celles de `feuilleMois` (le classeur du cabinet) : le fichier se relit tel quel à l'import.
// ExcelJS est chargé à la demande (lourd), au moment du téléchargement seulement.
import type { Cell, Workbook, Worksheet } from "exceljs";
import { TYPE_LABELS } from "@/lib/banque";
import { feuilleMois } from "@/lib/banqueExport";
import { synthesePeriodes, type RapprochementMois } from "@/lib/banqueMois";
import { dateDepuisTexte } from "@/lib/modeleExcelCabinet";
import type { CompteBancaire, MouvementBancaire, OperationEnCoursBancaire, ReleveMensuel } from "@/types";

// Palette de l'application : marine (--primary) et or (--accent), gris chauds.
const MARINE = "FF0B2545";
const MARINE_DOUX = "FF24476F";
const OR = "FFC9A96A";
const OR_FONCE = "FF8A6D2F";
const OR_PALE = "FFF7F2E9";
const ZEBRE = "FFFBF9F4";
const BORD = "FFE4DDCC";
const GRIS = "FF6B7280";
const VERT = "FF0D9B6C";
const ORANGE = "FFC77A06";
const ROUGE = "FFB42318";
const A_REVOIR = "FFFFF4C2";
const BLANC = "FFFFFFFF";

const MONTANT = '#,##0.000;-#,##0.000;"—"';
const SOLDE = "#,##0.000;[Red]-#,##0.000";
const DATE = "dd/mm/yyyy";
/** Dernière colonne de la disposition du cabinet (BANK BALANCE). */
const COLONNES = 12;
const LARGEURS = [17, 13, 44, 24, 14, 22, 24, 14, 14, 14, 14, 16];

const fill = (argb: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } });
const trait = (argb = BORD, style: "thin" | "medium" = "thin") => ({ style, color: { argb } });
const cadre = { top: trait(), left: trait(), bottom: trait(), right: trait() };

/** Couleur du texte de la colonne TYPE : frais en gris, encaissement en vert, paiement en orange, change en or foncé, crédit en marine. */
const COULEUR_TYPE: Record<string, string> = {
  [TYPE_LABELS.frais]: GRIS,
  [TYPE_LABELS.encaissement_client]: VERT,
  [TYPE_LABELS.paiement_fournisseur]: ORANGE,
  [TYPE_LABELS.change]: OR_FONCE,
  [TYPE_LABELS.credit]: MARINE,
  [TYPE_LABELS.autre]: GRIS,
};

function bande(ws: Worksheet, ligne: number, de: number, a: number, couleur: string) {
  for (let c = de; c <= a; c++) ws.getCell(ligne, c).fill = fill(couleur);
}

function etiquette(c: Cell, texte: string, droite = false) {
  c.value = texte;
  c.font = { bold: true, size: 9, color: { argb: GRIS } };
  c.alignment = { horizontal: droite ? "right" : "left", vertical: "middle" };
}

function valeur(c: Cell, v: number | string | Date | null, options: { format?: string; couleur?: string; taille?: number } = {}) {
  c.value = v === "" ? null : v;
  c.font = { bold: true, size: options.taille ?? 11, color: { argb: options.couleur ?? MARINE } };
  c.alignment = { horizontal: v instanceof Date ? "center" : typeof v === "number" ? "right" : "left", vertical: "middle" };
  if (options.format) c.numFmt = options.format;
}

/** Habille une feuille mensuelle : `lignes` est exactement `feuilleMois(...)`, écrit cellule par cellule puis mis en forme par zones. */
export function habillerFeuilleMois(ws: Worksheet, compte: CompteBancaire, p: RapprochementMois, lignes: (string | number)[][], cabinet = "CamConsult") {
  // Valeurs : dates en vraies dates Excel, le reste tel quel.
  lignes.forEach((l, i) => {
    l.forEach((v, j) => {
      if (v === "" || v == null) return;
      const date = typeof v === "string" && (j <= 1 || (i === 1 && j === 1)) ? dateDepuisTexte(v) : null;
      ws.getCell(i + 1, j + 1).value = date ?? v;
    });
  });
  LARGEURS.forEach((w, i) => (ws.getColumn(i + 1).width = w));

  const iTotal = lignes.findIndex((l) => l[0] === "TOTAL") + 1; // ligne (1-based) du TOTAL
  const premiere = 6;
  const derniere = iTotal - 1;
  const nbCorps = derniere - premiere + 1;
  const iSolde = iTotal + 2;
  const iEnCours = iSolde + 2;
  const iEnteteOps = iEnCours + 1;
  const nbOps = p.enCours.length;
  const iTotalOps = iEnteteOps + nbOps + 1;
  const iTheorique = iTotalOps + 1;

  // 1 · Bandeau de titre.
  ws.mergeCells(1, 1, 1, COLONNES);
  const titre = ws.getCell("A1");
  titre.font = { bold: true, size: 15, name: "Georgia", color: { argb: BLANC } };
  titre.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  bande(ws, 1, 1, COLONNES, MARINE);
  for (let c = 1; c <= COLONNES; c++) ws.getCell(1, c).border = { bottom: trait(OR, "medium") };
  ws.getRow(1).height = 32;

  // 2 · Solde de départ du mois.
  bande(ws, 2, 1, COLONNES, OR_PALE);
  etiquette(ws.getCell("A2"), "START DATE");
  valeur(ws.getCell("B2"), ws.getCell("B2").value as Date, { format: DATE });
  etiquette(ws.getCell("C2"), "BANK BALANCE", true);
  valeur(ws.getCell("D2"), p.ouverture, { format: SOLDE });
  ws.getRow(2).height = 22;
  ws.getRow(3).height = 8;

  // 3 · En-têtes sur deux lignes : colonnes d'identification (marine), bloc société (marine doux), bloc banque (or), solde (marine).
  const entete = (c: number, ligne: number, fond: string, texte: string, couleur = BLANC) => {
    const cell = ws.getCell(ligne, c);
    cell.fill = fill(fond);
    cell.font = { bold: true, size: 10, color: { argb: couleur } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    if (texte) cell.value = texte;
    return cell;
  };
  for (let c = 1; c <= 7; c++) {
    entete(c, 4, MARINE, String(lignes[3][c - 1] ?? ""));
    entete(c, 5, MARINE, "");
    ws.getCell(4, c).border = { top: trait(MARINE), left: trait(MARINE_DOUX), right: trait(MARINE_DOUX) };
    ws.getCell(5, c).border = { bottom: trait(OR, "medium"), left: trait(MARINE_DOUX), right: trait(MARINE_DOUX) };
  }
  entete(8, 4, MARINE_DOUX, "SOCIÉTÉ");
  entete(9, 4, MARINE_DOUX, "");
  entete(10, 4, OR, "BANK", MARINE);
  entete(11, 4, OR, "");
  entete(12, 4, MARINE, "BANK BALANCE");
  entete(8, 5, MARINE_DOUX, "DEBIT");
  entete(9, 5, MARINE_DOUX, "CREDIT");
  entete(10, 5, OR_PALE, "DEBIT", MARINE);
  entete(11, 5, OR_PALE, "CREDIT", MARINE);
  entete(12, 5, MARINE, "");
  for (let c = 8; c <= 12; c++) {
    ws.getCell(5, c).border = { bottom: trait(OR, "medium"), left: trait(BORD), right: trait(BORD) };
    ws.getCell(4, c).border = { top: trait(MARINE), left: trait(BORD), right: trait(BORD) };
  }
  // « SOCIÉTÉ » couvre débit et crédit de la société, « BANK » ceux de la banque (comme dans le classeur du cabinet).
  ws.mergeCells(4, 8, 4, 9);
  ws.mergeCells(4, 10, 4, 11);
  ws.getRow(4).height = 22;
  ws.getRow(5).height = 20;

  // 4 · Corps : lignes en alternance, « à revoir » en jaune du cabinet, montants à trois décimales, solde courant en gras (rouge si négatif).
  for (let i = 0; i < nbCorps; i++) {
    const ligne = premiere + i;
    const source = lignes[ligne - 1];
    const aRevoir = String(source[6]).includes("À REVOIR");
    const fond = aRevoir ? A_REVOIR : i % 2 === 1 ? ZEBRE : BLANC;
    const r = ws.getRow(ligne);
    for (let c = 1; c <= COLONNES; c++) {
      const cell = r.getCell(c);
      cell.fill = fill(fond);
      cell.border = { ...cadre, ...(c === 8 || c === 10 || c === 12 ? { left: trait(OR) } : {}) };
      cell.font = { size: 10, color: { argb: "FF1A1A1A" } };
      if (c <= 2) {
        cell.numFmt = DATE;
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else if (c === 3 || c === 4) {
        cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
      } else if (c <= 6) {
        cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
      } else if (c === 7) {
        const type = String(source[6]).replace(" · À REVOIR", "");
        cell.font = { size: 10, bold: aRevoir, color: { argb: COULEUR_TYPE[type] ?? GRIS } };
        cell.alignment = { horizontal: "left", vertical: "middle" };
      } else {
        cell.numFmt = c === 12 ? SOLDE : MONTANT;
        cell.alignment = { horizontal: "right", vertical: "middle" };
        if (c === 12) cell.font = { size: 10, bold: true, color: { argb: MARINE } };
      }
    }
  }

  // 5 · TOTAL du mois.
  const total = ws.getRow(iTotal);
  for (let c = 1; c <= COLONNES; c++) {
    const cell = total.getCell(c);
    cell.fill = fill(OR_PALE);
    cell.font = { bold: true, size: 10.5, color: { argb: MARINE } };
    cell.border = { top: trait(OR, "medium"), bottom: trait(OR, "medium"), left: c === 8 || c === 10 || c === 12 ? trait(OR) : undefined };
    if (c >= 8) {
      cell.numFmt = c === 12 ? SOLDE : MONTANT;
      cell.alignment = { horizontal: "right", vertical: "middle" };
    }
  }
  total.height = 22;

  // 6 · Pied de rapprochement : solde calculé, solde réel du relevé, écart (rouge s'il y en a, vert sinon).
  bande(ws, iSolde, 1, COLONNES, OR_PALE);
  etiquette(ws.getCell(iSolde, 1), "SOLDE CALCULÉ");
  valeur(ws.getCell(iSolde, 2), p.calcule, { format: SOLDE });
  etiquette(ws.getCell(iSolde, 3), "SOLDE RÉEL (RELEVÉ)", true);
  valeur(ws.getCell(iSolde, 4), p.soldeReel, { format: SOLDE });
  etiquette(ws.getCell(iSolde, 5), "ÉCART", true);
  const ecart = p.ecart;
  valeur(ws.getCell(iSolde, 6), ecart, { format: '#,##0.000;-#,##0.000;0.000', couleur: ecart === null ? MARINE : Math.abs(ecart) > 0.0005 ? ROUGE : VERT });
  ws.getRow(iSolde).height = 24;

  // 7 · Opérations en cours : titre doré, en-têtes, lignes (désignation sur A:G), total.
  ws.mergeCells(iEnCours, 1, iEnCours, 9);
  const titreOps = ws.getCell(iEnCours, 1);
  titreOps.font = { bold: true, size: 12, name: "Georgia", color: { argb: MARINE } };
  titreOps.alignment = { horizontal: "left", vertical: "middle" };
  for (let c = 1; c <= 9; c++) ws.getCell(iEnCours, c).border = { bottom: trait(OR, "medium") };
  ws.getRow(iEnCours).height = 24;
  ws.mergeCells(iEnteteOps, 1, iEnteteOps, 7);
  for (let c = 1; c <= 9; c++) {
    const cell = ws.getCell(iEnteteOps, c);
    cell.fill = fill(MARINE_DOUX);
    cell.font = { bold: true, size: 10, color: { argb: BLANC } };
    cell.alignment = { horizontal: c >= 8 ? "center" : "left", vertical: "middle", indent: c === 1 ? 1 : 0 };
    cell.border = cadre;
  }
  for (let i = 0; i < nbOps; i++) {
    const ligne = iEnteteOps + 1 + i;
    ws.mergeCells(ligne, 1, ligne, 7);
    for (let c = 1; c <= 9; c++) {
      const cell = ws.getCell(ligne, c);
      cell.fill = fill(i % 2 === 1 ? ZEBRE : BLANC);
      cell.border = cadre;
      cell.font = { size: 10 };
      cell.alignment = { horizontal: c >= 8 ? "right" : "left", vertical: "middle", indent: c === 1 ? 1 : 0 };
      if (c >= 8) cell.numFmt = MONTANT;
    }
  }
  ws.mergeCells(iTotalOps, 1, iTotalOps, 7);
  for (let c = 1; c <= 9; c++) {
    const cell = ws.getCell(iTotalOps, c);
    cell.fill = fill(OR_PALE);
    cell.font = { bold: true, size: 10.5, color: { argb: MARINE } };
    cell.border = { top: trait(OR, "medium"), bottom: trait(OR, "medium") };
    cell.alignment = { horizontal: c >= 8 ? "right" : "left", vertical: "middle", indent: c === 1 ? 1 : 0 };
    if (c >= 8) cell.numFmt = MONTANT;
  }

  // 8 · Solde théorique : le chiffre à retenir.
  const th = ws.getRow(iTheorique);
  th.height = 28;
  for (let c = 1; c <= 2; c++) {
    const cell = th.getCell(c);
    cell.border = { bottom: trait(OR, "medium"), top: trait(MARINE, "medium") };
    cell.fill = fill(BLANC);
  }
  th.getCell(1).font = { bold: true, size: 11, color: { argb: MARINE } };
  th.getCell(1).alignment = { vertical: "middle" };
  th.getCell(2).font = { bold: true, size: 13, color: { argb: MARINE } };
  th.getCell(2).numFmt = SOLDE;
  th.getCell(2).alignment = { horizontal: "right", vertical: "middle" };

  // Volet figé sous les en-têtes, filtre sur les lignes du mois, onglet marine, impression en paysage ajustée à la largeur.
  ws.views = [{ state: "frozen", ySplit: 5, showGridLines: false }];
  if (nbCorps > 0) ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: derniere, column: COLONNES } };
  ws.properties.tabColor = { argb: MARINE };
  ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "4:5", margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 } };
  ws.headerFooter = { oddFooter: `&L${cabinet} — Suivi bancaire ${compte.banque} ${compte.devise}&C&D&RPage &P / &N` };
}

/** Classeur .xlsx (octets) d'un compte : une feuille par mois (« 01-2026 »), même disposition que le classeur du cabinet, aux couleurs de l'application. */
export async function classeurCompteStyle(
  compte: CompteBancaire,
  mouvements: MouvementBancaire[],
  releves: ReleveMensuel[] = [],
  enCours: OperationEnCoursBancaire[] = [],
  cabinet = "CamConsult",
): Promise<Uint8Array<ArrayBuffer>> {
  const ExcelJS = (await import("exceljs")).default;
  const wb: Workbook = new ExcelJS.Workbook();
  wb.creator = cabinet;
  wb.title = `Suivi bancaire — ${compte.banque} ${compte.devise}`;
  wb.created = new Date();
  const periodes = synthesePeriodes(compte, mouvements, releves, enCours);
  for (const p of periodes) {
    const ws = wb.addWorksheet(`${p.mois.slice(5, 7)}-${p.mois.slice(0, 4)}`);
    habillerFeuilleMois(ws, compte, p, feuilleMois(compte, mouvements, p), cabinet);
  }
  if (periodes.length === 0) {
    const ws = wb.addWorksheet("Vide");
    ws.getCell("A1").value = "Aucun mouvement";
    ws.getCell("A1").font = { italic: true, size: 12, color: { argb: GRIS } };
  }
  const tampon = await wb.xlsx.writeBuffer();
  return new Uint8Array(tampon as ArrayBuffer);
}


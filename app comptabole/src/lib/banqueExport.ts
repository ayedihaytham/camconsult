import { download } from "@/lib/export";
import { formatDate } from "@/lib/utils";
import { TYPE_LABELS } from "@/lib/banque";
import { synthesePeriodes, type RapprochementMois } from "@/lib/banqueMois";
import { arrondi3 as r3 } from "../../shared/arrondi.js";
import type { CompteBancaire, MouvementBancaire, OperationEnCoursBancaire, ReleveMensuel } from "@/types";

const jour = (d: string | null) => (d ? formatDate(d) : "");

type Cellule = string | number;

/** Une feuille par mois dans la disposition du cabinet : en-tête (départ), lignes en blocs société puis banque (débit et crédit inversés) avec solde courant,
 * TOTAL, solde calculé, solde réel de la banque et écart, tableau des opérations en cours et solde théorique. */
export function feuilleMois(compte: CompteBancaire, mouvements: MouvementBancaire[], p: RapprochementMois): Cellule[][] {
  const lignes = mouvements.filter((m) => m.compteId === compte.id && m.dateOp.startsWith(p.mois));
  let solde = p.ouverture;
  const corps: Cellule[][] = lignes.map((m) => {
    solde = r3(solde + m.credit - m.debit);
    return [jour(m.dateOp), jour(m.dateValeur), m.libelle, m.details, m.reference, m.numPiece, TYPE_LABELS[m.type] + (m.aRevoir ? " · À REVOIR" : ""), m.credit, m.debit, m.debit, m.credit, solde];
  });
  return [
    [`ACCOUNTS ${compte.banque.toUpperCase()} (${compte.devise})`],
    ["START DATE", `01/${p.mois.slice(5, 7)}/${p.mois.slice(0, 4)}`, "BANK BALANCE", p.ouverture],
    [],
    ["DATE OP", "VALUE DATE", "DESCRIPTION", "DETAILS", "REF", "N° PIECE", "TYPE", "SOCIÉTÉ", "", "BANK", "", "BANK BALANCE"],
    ["", "", "", "", "", "", "", "DEBIT", "CREDIT", "DEBIT", "CREDIT", ""],
    ...corps,
    ["TOTAL", "", "", "", "", "", "", p.totalCredit, p.totalDebit, p.totalDebit, p.totalCredit, p.calcule],
    [],
    ["SOLDE CALCULÉ", p.calcule, "SOLDE RÉEL (RELEVÉ)", p.soldeReel ?? "", "ÉCART", p.ecart ?? ""],
    [],
    ["OPÉRATIONS EN COURS"],
    ["DÉSIGNATION", "", "", "", "", "", "", "DEBIT", "CREDIT"],
    ...p.enCours.map((o): Cellule[] => [o.designation, "", "", "", "", "", "", o.debit, o.credit]),
    ["TOTAL", "", "", "", "", "", "", p.enCoursDebit, p.enCoursCredit],
    ["SOLDE THÉORIQUE", p.theorique],
  ];
}

/** Exporte un compte en .xlsx : une feuille par mois (« 01-2026 ») dans la disposition du cabinet. */
export async function exporterCompte(compte: CompteBancaire, mouvements: MouvementBancaire[], releves: ReleveMensuel[] = [], enCours: OperationEnCoursBancaire[] = []) {
  const XLSX = await import("xlsx");
  const periodes = synthesePeriodes(compte, mouvements, releves, enCours);
  const wb = XLSX.utils.book_new();
  for (const p of periodes) {
    const ws = XLSX.utils.aoa_to_sheet(feuilleMois(compte, mouvements, p));
    ws["!cols"] = [11, 11, 44, 22, 14, 22, 24, 13, 13, 13, 13, 14].map((wch) => ({ wch }));
    ws["!merges"] = [{ s: { r: 3, c: 7 }, e: { r: 3, c: 8 } }, { s: { r: 3, c: 9 }, e: { r: 3, c: 10 } }];
    XLSX.utils.book_append_sheet(wb, ws, `${p.mois.slice(5, 7)}-${p.mois.slice(0, 4)}`);
  }
  if (periodes.length === 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Aucun mouvement"]]), "Vide");
  const octets = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  download(
    new Blob([octets], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `Suivi bancaire - ${compte.banque} ${compte.devise}.xlsx`,
  );
}

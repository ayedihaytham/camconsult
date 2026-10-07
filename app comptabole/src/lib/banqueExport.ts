import { download } from "@/lib/export";
import { formatDate } from "@/lib/utils";
import { controleSolde, soldesCourants, totaux, TYPE_LABELS } from "@/lib/banque";
import type { CompteBancaire, MouvementBancaire } from "@/types";

const jour = (d: string | null) => (d ? formatDate(d) : "");

/** Exporte un compte en .xlsx dans la disposition du cabinet : blocs société puis banque (débit et crédit
 * inversés), solde courant, ligne TOTAL et solde réel. */
export async function exporterCompte(compte: CompteBancaire, mouvements: MouvementBancaire[]) {
  const XLSX = await import("xlsx");
  const soldes = soldesCourants(compte, mouvements);
  const t = totaux(mouvements);
  const { calcule, ecart } = controleSolde(compte, mouvements);
  const aoa: (string | number)[][] = [
    [`ACCOUNTS ${compte.banque.toUpperCase()} (${compte.devise})`],
    ["START DATE", jour(compte.dateDepart), "BANK BALANCE", compte.soldeDepart],
    [],
    ["DATE OP", "VALUE DATE", "DESCRIPTION", "DETAILS", "REF", "N° PIECE", "TYPE", "SOCIÉTÉ", "", "BANK", "", "BANK BALANCE"],
    ["", "", "", "", "", "", "", "DEBIT", "CREDIT", "DEBIT", "CREDIT", ""],
    ...mouvements.map((m) => [
      jour(m.dateOp), jour(m.dateValeur), m.libelle, m.details, m.reference, m.numPiece, TYPE_LABELS[m.type],
      m.credit, m.debit, m.debit, m.credit, soldes.get(m.id) ?? 0,
    ]),
    ["TOTAL", "", "", "", "", "", "", t.credit, t.debit, t.debit, t.credit, calcule],
    [],
    ["SOLDE CALCULÉ", calcule, ...(compte.soldeReel == null ? [] : ["SOLDE RÉEL", compte.soldeReel, "ÉCART", ecart ?? 0])],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [11, 11, 44, 22, 14, 22, 20, 13, 13, 13, 13, 14].map((wch) => ({ wch }));
  ws["!merges"] = [{ s: { r: 3, c: 7 }, e: { r: 3, c: 8 } }, { s: { r: 3, c: 9 }, e: { r: 3, c: 10 } }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${compte.banque} ${compte.devise}`.replace(/[\\/?*[\]:]/g, " ").slice(0, 31));
  const octets = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  download(
    new Blob([octets], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `Suivi bancaire - ${compte.banque} ${compte.devise}.xlsx`,
  );
}

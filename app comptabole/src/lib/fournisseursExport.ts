import { download } from "@/lib/export";
import { formatDate } from "@/lib/utils";
import { MODE_LABELS, type LigneEtat } from "@/lib/fournisseurs";

const ENTETES = [
  "N° facture", "Date facture", "Qté", "Désignation", "P.U", "Montant facture", "Devise", "Réglé / solde",
  "Date règlement", "Mode de règlement", "Référence", "N° RS", "RS", "Montant viré", "Banque",
  "Fact. vente n°", "N° déclaration", "N° proforma", "État proforma", "État de chargement", "Vu passé", "N° titre",
];
/** Colonnes du règlement (date → banque) : fusionnées sur les factures qu'un même règlement couvre. */
const REGLEMENT = [8, 14];

/** Lignes du classeur : le tableau du cabinet, une ligne par facture et par règlement. */
export function ligneExcel(l: LigneEtat): (string | number)[] {
  const f = l.facture;
  const r = l.reglement;
  const partie = r && l.debutGroupe;
  return [
    f.numFacture, f.date ? formatDate(f.date) : "", f.quantite, f.designation, f.prixUnitaire, f.montant, f.devise, r ? l.montant : `Solde ${l.montant}`,
    partie ? (r.date ? formatDate(r.date) : "") : "", partie ? MODE_LABELS[r.mode] : "", partie ? r.reference : "",
    partie ? r.rsNumero : "", partie ? r.rsMontant : "", partie ? r.vire : "", partie ? r.banque : "",
    f.venteNumFacture, f.douaneNumDeclaration, f.suivi.numProforma, f.suivi.etatProforma, f.suivi.etatChargement, f.suivi.vuPasse, f.suivi.numTitre,
  ];
}

/** Exporte l'état d'un fournisseur en .xlsx, avec les cellules de règlement fusionnées comme sur la feuille d'origine. */
export async function exporterEtatFournisseur(nom: string, lignes: LigneEtat[]) {
  const XLSX = await import("xlsx");
  const aoa: (string | number)[][] = [[nom], [], ENTETES, ...lignes.map(ligneExcel)];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const debut = 3;
  const merges: import("xlsx").Range[] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: ENTETES.length - 1 } }];
  lignes.forEach((l, i) => {
    if (l.reglement && l.debutGroupe && l.rang > 1) {
      for (let c = REGLEMENT[0]; c <= REGLEMENT[1]; c++) merges.push({ s: { r: debut + i, c }, e: { r: debut + i + l.rang - 1, c } });
    }
  });
  ws["!merges"] = merges;
  ws["!cols"] = ENTETES.map((e, c) => ({ wch: c === 3 ? 28 : Math.max(11, e.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, nom.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Fournisseur");
  const octets = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  download(
    new Blob([octets], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `Suivi fournisseur - ${nom}.xlsx`,
  );
}

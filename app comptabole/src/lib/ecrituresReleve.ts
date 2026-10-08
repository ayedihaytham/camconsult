import { convertirNombre } from "./pdfToTables";
import type { PdfCell } from "./pdfTables";

/** Une ligne du fichier d'écritures : date, journal, n° d'écriture, trois zéros, compte, débit, crédit. */
export interface LigneEcriture {
  date: string;
  journal: string;
  numero: number;
  compte: string;
  debit: number;
  credit: number;
}

export const COMPTE_BANQUE = "53200001";
export const JOURNAL_BANQUE = "BQ";

const nombre = (c: PdfCell | undefined): number => {
  if (typeof c === "number") return c;
  return convertirNombre(String(c ?? "")) ?? 0;
};

/** « 02-01-2026 » ou « 02/01/2026 » -> « 02/01/2026 » ; null si ce n'est pas une date complète. */
function jourMoisAnnee(c: PdfCell | undefined): string | null {
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(String(c ?? "").trim());
  if (!m) return null;
  return `${m[1].padStart(2, "0")}/${m[2].padStart(2, "0")}/${m[3].length === 2 ? `20${m[3]}` : m[3]}`;
}

/** Écritures d'un relevé converti (Date, Libellé, Débit, Crédit) : deux lignes par mouvement, comme pour un import en comptabilité.
 * La première porte le compte de banque, la seconde le compte de contrepartie (0, à renseigner). Un débit du relevé (sortie)
 * est au crédit du compte de banque, un crédit du relevé (entrée) à son débit. La ligne « Solde au… » n'est pas un mouvement. */
export function ecrituresDepuisReleve(rows: PdfCell[][], compte = COMPTE_BANQUE, journal = JOURNAL_BANQUE): LigneEcriture[] | null {
  const [entete, ...lignes] = rows;
  if (!entete) return null;
  const col = (re: RegExp) => entete.findIndex((c) => re.test(String(c)));
  const iDate = col(/^date$/i);
  const iDebit = col(/d[ée]bit/i);
  const iCredit = col(/cr[ée]dit/i);
  const iLibelle = col(/libell/i);
  if (iDate < 0 || iDebit < 0 || iCredit < 0) return null;

  const ecritures: LigneEcriture[] = [];
  let numero = 0;
  for (const l of lignes) {
    const date = jourMoisAnnee(l[iDate]);
    if (!date || /^solde\b/i.test(String(l[iLibelle] ?? "").trim())) continue;
    const sortie = nombre(l[iDebit]);
    const entree = nombre(l[iCredit]);
    if (sortie === 0 && entree === 0) continue;
    numero += 1;
    const montant = sortie > 0 ? sortie : entree;
    const enSortie = sortie > 0;
    ecritures.push(
      { date, journal, numero, compte, debit: enSortie ? 0 : montant, credit: enSortie ? montant : 0 },
      { date, journal, numero, compte: "0", debit: enSortie ? montant : 0, credit: enSortie ? 0 : montant },
    );
  }
  return ecritures.length > 0 ? ecritures : null;
}

/** « 3 000,000 » : espace pour les milliers, trois décimales ; rien pour un montant nul. */
export function montantEcriture(n: number): string {
  if (!n) return "";
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).replace(/[  ]/g, " ");
}

/** Fichier texte des écritures : une ligne par écriture, champs séparés par des tabulations (date, journal, n°, 0, 0, 0, compte,
 * débit, crédit), la case du sens sans montant restant vide. Fins de ligne Windows pour s'ouvrir tel quel dans le Bloc-notes. */
export function texteEcritures(ecritures: LigneEcriture[]): string {
  return (
    ecritures
      .map((e) => [e.date, e.journal, String(e.numero), "0", "0", "0", e.compte, montantEcriture(e.debit), montantEcriture(e.credit)].join("\t"))
      .join("\r\n") + "\r\n"
  );
}

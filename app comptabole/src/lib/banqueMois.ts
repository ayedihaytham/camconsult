import type { CompteBancaire, MouvementBancaire, OperationEnCoursBancaire, ReleveMensuel } from "@/types";
import { arrondi3 as r3 } from "../../shared/arrondi.js";

/** Rapprochement d'un mois d'un compte : le pied de feuille du classeur du cabinet (solde réel, opérations en cours, solde théorique). */
export interface RapprochementMois {
  /** « AAAA-MM » */
  mois: string;
  /** Solde de départ du mois : celui du compte pour le premier mois, sinon la fin du mois précédent (solde réel de la banque s'il est saisi, sinon solde calculé). */
  ouverture: number;
  totalDebit: number;
  totalCredit: number;
  /** Ouverture + crédits − débits des lignes du mois. */
  calcule: number;
  /** Solde réel de la banque en fin de mois (celui du relevé), saisi ou lu dans le classeur. */
  soldeReel: number | null;
  /** Solde réel − solde calculé : ce qu'il reste à expliquer (null tant que le solde réel n'est pas saisi). */
  ecart: number | null;
  /** Écart ÷ 1,19 : si l'écart est une commission soumise à la TVA de 19 %, son montant hors taxe (null sans écart). */
  ecartHorsTva: number | null;
  enCours: OperationEnCoursBancaire[];
  /** Débits des opérations en cours : entrées attendues sur le compte (point de vue de la société). */
  enCoursDebit: number;
  /** Crédits des opérations en cours : sorties à venir. */
  enCoursCredit: number;
  /** Solde réel (sinon calculé) + débits − crédits des opérations en cours. */
  theorique: number;
  nbLignes: number;
  /** Lignes marquées « à revoir ». */
  aRevoir: number;
}

const TOLERANCE = 0.0005;
export const TVA_COMMISSION = 1.19;

/** Mois (« AAAA-MM ») d'un compte : ceux de ses lignes, de ses soldes réels et de ses opérations en cours, du plus ancien au plus récent. */
export function moisDuCompte(compteId: string, mouvements: MouvementBancaire[], releves: ReleveMensuel[], enCours: OperationEnCoursBancaire[]): string[] {
  const mois = new Set<string>();
  for (const m of mouvements) if (m.compteId === compteId) mois.add(m.dateOp.slice(0, 7));
  for (const r of releves) if (r.compteId === compteId) mois.add(r.mois);
  for (const o of enCours) if (o.compteId === compteId) mois.add(o.mois);
  return [...mois].sort();
}

/** Rapprochement de chaque mois du compte, du plus ancien au plus récent : l'ouverture d'un mois est la fin du précédent. */
export function synthesePeriodes(compte: CompteBancaire, mouvements: MouvementBancaire[], releves: ReleveMensuel[], enCours: OperationEnCoursBancaire[]): RapprochementMois[] {
  const siens = mouvements.filter((m) => m.compteId === compte.id);
  let ouverture = compte.soldeDepart;
  return moisDuCompte(compte.id, siens, releves, enCours).map((mois) => {
    const lignes = siens.filter((m) => m.dateOp.startsWith(mois));
    const totalDebit = r3(lignes.reduce((s, m) => s + m.debit, 0));
    const totalCredit = r3(lignes.reduce((s, m) => s + m.credit, 0));
    const calcule = r3(ouverture + totalCredit - totalDebit);
    const soldeReel = releves.find((r) => r.compteId === compte.id && r.mois === mois)?.soldeReel ?? null;
    const ecart = soldeReel === null ? null : r3(soldeReel - calcule);
    const ops = enCours.filter((o) => o.compteId === compte.id && o.mois === mois);
    const enCoursDebit = r3(ops.reduce((s, o) => s + o.debit, 0));
    const enCoursCredit = r3(ops.reduce((s, o) => s + o.credit, 0));
    const ligne: RapprochementMois = {
      mois,
      ouverture: r3(ouverture),
      totalDebit,
      totalCredit,
      calcule,
      soldeReel,
      ecart,
      ecartHorsTva: ecart !== null && Math.abs(ecart) > TOLERANCE ? r3(Math.abs(ecart) / TVA_COMMISSION) : null,
      enCours: ops,
      enCoursDebit,
      enCoursCredit,
      theorique: r3((soldeReel ?? calcule) + enCoursDebit - enCoursCredit),
      nbLignes: lignes.length,
      aRevoir: lignes.filter((m) => m.aRevoir).length,
    };
    ouverture = soldeReel ?? calcule;
    return ligne;
  });
}

/** Rapprochement d'un mois précis (null si le compte n'a rien ce mois-là). */
export const rapprochementMois = (compte: CompteBancaire, mouvements: MouvementBancaire[], releves: ReleveMensuel[], enCours: OperationEnCoursBancaire[], mois: string): RapprochementMois | null =>
  synthesePeriodes(compte, mouvements, releves, enCours).find((p) => p.mois === mois) ?? null;

/** Le mois a-t-il un écart à expliquer ? */
export const aUnEcart = (p: RapprochementMois) => p.ecart !== null && Math.abs(p.ecart) > TOLERANCE;

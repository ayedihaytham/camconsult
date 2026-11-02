import type { MouvementImport } from "@/lib/banque";

/**
 * Solde réel d'un mois lu dans un relevé PDF : le solde final que le relevé imprime est celui de la banque à la fin du mois, à condition que
 * toutes les opérations du relevé soient du même mois. Un relevé qui chevauche deux mois n'est pas rattaché à un mois (rien n'est inventé).
 */
export interface SoldeMensuelPdf {
  /** « AAAA-MM ». */
  mois: string;
  soldeReel: number;
  /** Date de la dernière opération du relevé. */
  date: string;
}

export function soldeMensuelDePdf(mouvements: Pick<MouvementImport, "dateOp">[], soldeFinal: number | null): SoldeMensuelPdf | null {
  if (soldeFinal === null || mouvements.length === 0) return null;
  const mois = new Set(mouvements.map((m) => m.dateOp.slice(0, 7)));
  if (mois.size !== 1) return null;
  const date = mouvements.reduce((max, m) => (m.dateOp > max ? m.dateOp : max), mouvements[0].dateOp);
  return { mois: [...mois][0], soldeReel: Math.round(soldeFinal * 1000) / 1000, date };
}

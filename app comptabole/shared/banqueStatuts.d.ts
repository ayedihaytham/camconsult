export const TOLERANCE_ECART: number;

export type StatutMois = "ok" | "ecart" | "saisir";

export interface MoisCompte {
  mois: string;
  calcule: number;
  soldeReel: number | null;
  ecart: number | null;
  statut: StatutMois;
}

export function statutsMoisCompte(
  compte: { soldeDepart: number },
  totauxParMois: { mois: string; debit: number; credit: number }[],
  releves?: { mois: string; soldeReel: number | null }[],
  autresMois?: string[],
): MoisCompte[];

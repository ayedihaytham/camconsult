export function arrondi3(n: number): number;
export function calculerTotaux(
  lignes: { quantite: number; montantHt: number }[],
  tvaTaux: number,
  timbre: number,
): { totalHt: number; tva: number; netAPayer: number };

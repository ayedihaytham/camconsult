/**
 * Totaux d'une facture du cabinet : règle UNIQUE utilisée par le serveur et par l'écran.
 * - ligne = quantité × montant HT unitaire (non arrondie) ;
 * - total HT = somme des lignes, arrondie une seule fois au millime ;
 * - TVA = total HT × taux / 100, arrondie au millime (TVA calculée sur le total, pas ligne par ligne) ;
 * - net à payer = total HT + TVA + timbre fiscal (ajouté après TVA), arrondi au millime.
 * Arrondi au millime, moitié vers le haut. Les avoirs (montants négatifs) ne sont pas gérés : voir le rapport d'audit (FIN-03).
 */
import { arrondi3 } from "./arrondi.js";
export { arrondi3 };

export function calculerTotaux(lignes, tvaTaux, timbre) {
  const totalHt = arrondi3(lignes.reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.montantHt) || 0), 0));
  const tva = arrondi3((totalHt * (Number(tvaTaux) || 0)) / 100);
  return { totalHt, tva, netAPayer: arrondi3(totalHt + tva + (Number(timbre) || 0)) };
}

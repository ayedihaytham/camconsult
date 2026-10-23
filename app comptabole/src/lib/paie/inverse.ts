import type { Bareme } from "./baremes";
import { calculerSimulation, type EntreeSimulation, type ResultatSimulation } from "./calcul";

/** Plus grand salaire de base cherché : 10 millions de DT, en millimes. */
export const BASE_MAX = 10_000_000_000;
/** Combien de millimes au-dessus du premier salaire convenable on cherche un montant « rond » donnant exactement le même net (palier d'arrondi). */
const FENETRE_PALIER = 50;

export interface ResultatInverse {
  /** Salaire de base trouvé, en millimes. */
  base: number;
  resultat: ResultatSimulation;
  /** Net à payer obtenu moins le net demandé (0 si exact). */
  ecart: number;
}

/** Plus « rond » = multiple de 1 000, sinon de 100, sinon de 10 millimes ; 0 si aucun des trois. */
const rondeur = (n: number) => (n % 1000 === 0 ? 3 : n % 100 === 0 ? 2 : n % 10 === 0 ? 1 : 0);

/**
 * Du net au brut : il n'existe pas de formule inverse directe (impôt progressif, arrondis). On cherche, par dichotomie sur des millimes
 * entiers (de 0 à 10 millions de DT), le plus petit salaire de base dont le net à payer est au moins le net demandé, puis, parmi les
 * montants voisins qui donnent exactement le même net, le plus « rond ». null : net négatif ou impossible à atteindre.
 *
 * Remarque : l'exonération de la CSS est tout ou rien, donc le net n'est pas strictement croissant au seuil ; à cet endroit la dichotomie peut
 * renvoyer un salaire plus élevé que nécessaire (le résultat reste exact, mais pas toujours le plus petit).
 */
export function salaireDepuisNet(netDemande: number, autres: Omit<EntreeSimulation, "base">, bareme: Bareme): ResultatInverse | null {
  if (netDemande < 0) return null;
  const net = (base: number) => calculerSimulation({ ...autres, base }, bareme).netAPayer;
  if (net(BASE_MAX) < netDemande) return null;
  let bas = 0;
  let haut = BASE_MAX;
  while (bas < haut) {
    const milieu = Math.floor((bas + haut) / 2);
    if (net(milieu) >= netDemande) haut = milieu;
    else bas = milieu + 1;
  }
  const netTrouve = net(bas);
  let choisi = bas;
  for (let b = bas + 1; b <= bas + FENETRE_PALIER; b++) {
    if (net(b) === netTrouve && rondeur(b) > rondeur(choisi)) choisi = b;
  }
  const resultat = calculerSimulation({ ...autres, base: choisi }, bareme);
  return { base: choisi, resultat, ecart: resultat.netAPayer - netDemande };
}

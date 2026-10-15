/**
 * Arrondi au millime (3 décimales), moitié vers le haut, sans l'erreur de représentation des flottants.
 * L'ancien calcul Math.round((n + EPSILON) * 1000) / 1000 arrondissait à tort environ 0,6 % des cas « exactement
 * au demi-millime » (ex. 2,0035 donnait 2,003 au lieu de 2,004), parce que 2,0035 * 1000 vaut 2003,4999999999998.
 * toPrecision(15) retire ce bruit avant l'arrondi.
 */
export const arrondi3 = (n) => Math.round(Number((Number(n) * 1000).toPrecision(15))) / 1000;

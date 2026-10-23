/** Montant saisi en dinars (« 1 077,847 », « 1077.847 », « 0,5 ») converti en millimes entiers ; une saisie illisible ou négative vaut 0. */
export function versMillimes(saisie: string): number {
  const texte = String(saisie ?? "").replace(/[\s  ]/g, "").replace(",", ".");
  if (!/^\d*\.?\d*$/.test(texte) || texte === "" || texte === ".") return 0;
  const dinars = Number(texte);
  return Number.isFinite(dinars) ? Math.round(dinars * 1000) : 0;
}

/** Millimes en dinars à trois décimales, à la française : « 1 077,847 ». */
export const enDinars = (millimes: number) => (millimes / 1000).toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

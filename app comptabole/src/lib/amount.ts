/** Montants du cabinet : jusqu'à 3 décimales (millimes du dinar), la virgule
 * et le point sont acceptés comme séparateur décimal. */
export const AMOUNT_DECIMALS = 3;

/** Normalise une saisie : « , » → « . », caractères non numériques retirés,
 * un seul séparateur, au plus `decimals` décimales, « - » seulement en tête. */
export function sanitizeAmountInput(
  raw: string,
  { decimals = AMOUNT_DECIMALS, allowNegative = true } = {},
): string {
  let s = raw.replace(/,/g, ".").replace(/[^\d.-]/g, "");
  const negative = allowNegative && s.startsWith("-");
  s = s.replace(/-/g, "");
  const dot = s.indexOf(".");
  if (dot !== -1) {
    s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, "").slice(0, decimals);
  }
  return negative ? `-${s}` : s;
}

/** Saisie → nombre (0 si vide ou intermédiaire comme « - » ou « 12. »). */
export function parseAmount(text: string): number {
  const n = parseFloat(text);
  return Number.isFinite(n) ? n : 0;
}

/** Arrondi au millime — même précision que le serveur (server/mappers.js). */
export const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Nombre → texte de saisie avec virgule décimale, sans zéros inutiles. */
export function formatAmountInput(n: number): string {
  return String(round3(n)).replace(".", ",");
}

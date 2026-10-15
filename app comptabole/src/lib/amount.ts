import { arrondi3 } from "../../shared/arrondi.js";

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
export const round3 = arrondi3;

/** Cellule Excel/CSV → nombre : accepte « 1 234,567 », « 1234.567 » et les
 * nombres déjà typés (0 si illisible). */
export function toNumber(cell: unknown): number {
  if (typeof cell === "number") return Number.isFinite(cell) ? round3(cell) : 0;
  const s = String(cell ?? "").trim().replace(/[\s  ]/g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? round3(n) : 0;
}

/** Nombre → texte de saisie avec virgule décimale : toujours 3 décimales au moins (« 0,400 », « 12,000 »),
 * davantage seulement si le nombre en a (jusqu'à `decimals`, 4 pour un cours). */
export function formatAmountInput(n: number, decimals = AMOUNT_DECIMALS): string {
  const k = 10 ** decimals;
  return montantFixe(Math.round(n * k) / k).replace(".", ",");
}

/** Texte d'un montant avec au moins 3 décimales, point décimal : 0.4 → « 0.400 », 3.3167 → « 3.3167 ». */
export function montantFixe(n: number): string {
  const s = String(n);
  if (s.includes("e")) return n.toFixed(AMOUNT_DECIMALS);
  const decimales = s.includes(".") ? s.split(".")[1].length : 0;
  return decimales >= AMOUNT_DECIMALS ? s : n.toFixed(AMOUNT_DECIMALS);
}

/** Saisie d'une cellule de montant mise à 3 décimales (« 0,4 » → « 0,400 », « .5 » → « 0,500 ») ; texte vide ou illisible inchangé. */
export function montantAffiche(saisie: unknown): string {
  const brut = String(saisie ?? "");
  if (brut.trim() === "" || !/^-?\d*[.,]?\d*$/.test(brut.trim()) || !/\d/.test(brut)) return brut;
  const virgule = brut.includes(",");
  const fixe = montantFixe(parseFloat(brut.replace(",", ".")));
  return virgule ? fixe.replace(".", ",") : fixe;
}

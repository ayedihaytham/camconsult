/**
 * Montant en toutes lettres (dinars et millimes), règle partagée par l'écran (impression de la facture) et le serveur (message TEIF).
 * Déplacé depuis src/lib/facturation.ts sans changement de comportement.
 */

const UNITES = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze",
  "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf",
];
const DIZAINES = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"];

/** 1 à 99. `accord` : « quatre-vingts » prend son s seulement en fin de nombre. */
function moinsDeCent(n, accord) {
  if (n < 20) return UNITES[n];
  const d = Math.floor(n / 10);
  const u = n % 10;
  if (d <= 6) return DIZAINES[d] + (u === 1 ? " et un" : u > 0 ? `-${UNITES[u]}` : "");
  if (d === 7) return `soixante${u === 1 ? " et onze" : `-${UNITES[10 + u]}`}`;
  if (d === 8) return `quatre-vingt${u === 0 ? (accord ? "s" : "") : `-${UNITES[u]}`}`;
  return `quatre-vingt-${UNITES[10 + u]}`;
}

/** 1 à 999. */
function moinsDeMille(n, accord) {
  const c = Math.floor(n / 100);
  const r = n % 100;
  let s = "";
  if (c > 0) s = (c === 1 ? "cent" : `${UNITES[c]} cent`) + (c > 1 && r === 0 && accord ? "s" : "");
  if (r > 0) s += (s ? " " : "") + moinsDeCent(r, accord);
  return s;
}

/** Entier de 0 à 999 999 999 en lettres (français).
 * @param {number} n */
export function nombreEnLettres(n) {
  if (n === 0) return "zéro";
  const millions = Math.floor(n / 1_000_000);
  const milliers = Math.floor((n % 1_000_000) / 1000);
  const reste = n % 1000;
  const parts = [];
  if (millions > 0) parts.push(millions === 1 ? "un million" : `${moinsDeMille(millions, true)} millions`);
  if (milliers > 0) parts.push(milliers === 1 ? "mille" : `${moinsDeMille(milliers, false)} mille`);
  if (reste > 0) parts.push(moinsDeMille(reste, true));
  return parts.join(" ");
}

/** « Deux mille six cent dix-neuf dinars et cinq cent quatre-vingt-quinze millimes ».
 * @param {number} montant */
export function montantEnLettres(montant) {
  const dinars = Math.floor(montant + 1e-9);
  const millimes = Math.round((montant - dinars) * 1000);
  const dinarsTxt = `${nombreEnLettres(dinars)} dinar${dinars > 1 ? "s" : ""}`;
  const texte = millimes > 0 ? `${dinarsTxt} et ${nombreEnLettres(millimes)} millime${millimes > 1 ? "s" : ""}` : dinarsTxt;
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

/** Format d'identifiant accepté par le serveur (voir server/routes/employes.js) :
 * minuscules, chiffres, points ou tirets, doit commencer par une lettre. */
export const IDENTIFIANT_RE = /^[a-z][a-z0-9._-]*$/;

function normalizeNamePart(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Identifiant proposé à partir du prénom/nom (ex. « Ahmed Ben Salah » →
 * « a.bensalah ») — accents retirés, minuscules, un seul point. */
export function suggestIdentifiant(prenom: string, nom: string) {
  const p = normalizeNamePart(prenom);
  const n = normalizeNamePart(nom);
  if (!p || !n) return "";
  return `${p[0]}.${n}`;
}

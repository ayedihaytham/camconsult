/**
 * Petit constructeur XML : un nœud est { nom, attrs, texte } (feuille) ou { nom, attrs, enfants } (conteneur). La sortie est déterministe
 * (retraits de deux espaces, fins de ligne « \n », attributs dans l'ordre donné) : c'est cet octet-pour-octet qui sera signé plus tard.
 */

// Caractères interdits en XML 1.0 (contrôles sauf tabulation, retour chariot et saut de ligne) : retirés, jamais transmis.
// eslint-disable-next-line no-control-regex
const CARACTERES_INTERDITS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

export function echapper(valeur) {
  return String(valeur ?? "")
    .replace(CARACTERES_INTERDITS, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Feuille : <nom attrs>texte</nom>, ou <nom attrs/> si le texte est vide. */
export const feuille = (nom, texte = "", attrs = {}) => ({ nom, attrs, texte: String(texte ?? "") });
/** Conteneur : les enfants `null`/`undefined`/`false` sont ignorés (éléments facultatifs). */
export const noeud = (nom, enfants = [], attrs = {}) => ({ nom, attrs, enfants: enfants.filter(Boolean) });

const attributs = (attrs) =>
  Object.entries(attrs ?? {})
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => ` ${k}="${echapper(v)}"`)
    .join("");

export function serialiser(n, niveau = 0) {
  const retrait = "  ".repeat(niveau);
  if (n.enfants) {
    if (n.enfants.length === 0) return `${retrait}<${n.nom}${attributs(n.attrs)}/>`;
    return `${retrait}<${n.nom}${attributs(n.attrs)}>\n${n.enfants.map((e) => serialiser(e, niveau + 1)).join("\n")}\n${retrait}</${n.nom}>`;
  }
  if (n.texte === "") return `${retrait}<${n.nom}${attributs(n.attrs)}/>`;
  return `${retrait}<${n.nom}${attributs(n.attrs)}>${echapper(n.texte)}</${n.nom}>`;
}

export const DECLARATION_XML = '<?xml version="1.0" encoding="UTF-8"?>';

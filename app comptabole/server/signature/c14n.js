import { nettoyer } from "../teif/xml.js";

/**
 * Canonicalisation XML exclusive (http://www.w3.org/2001/10/xml-exc-c14n#, sans commentaires) d'un ARBRE de nœuds du constructeur
 * server/teif/xml.js. L'application produit elle-même le document : on canonise l'arbre (ce que verra un analyseur XML) plutôt que
 * de réanalyser du texte. La conformité est vérifiée par comparaison avec l'implémentation indépendante de la bibliothèque
 * xml-crypto (voir c14n.test.js).
 *
 * Ce qu'un analyseur XML change avant la canonicalisation, reproduit ici pour que l'empreinte soit celle du document relu :
 *  - fins de ligne : « \r\n » et « \r » deviennent « \n » dans le texte ;
 *  - valeurs d'attribut : tabulation, saut de ligne et retour chariot deviennent une espace ;
 *  - les références « &quot; » « &apos; » redeviennent « " » « ' » (non échappés dans la forme canonique).
 */

export const NS = {
  ds: "http://www.w3.org/2000/09/xmldsig#",
  xades: "http://uri.etsi.org/01903/v1.3.2#",
};

const prefixe = (nom) => (nom.includes(":") ? nom.slice(0, nom.indexOf(":")) : "");
const local = (nom) => (nom.includes(":") ? nom.slice(nom.indexOf(":") + 1) : nom);

function texteCanonique(valeur) {
  return nettoyer(valeur).replace(/\r\n?/g, "\n").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function valeurAttributCanonique(valeur) {
  return nettoyer(valeur)
    .replace(/\r\n/g, "\n")
    .replace(/[\t\n\r]/g, " ")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

/**
 * Canonise un nœud.
 * @param n       nœud { nom, attrs, enfants | texte }
 * @param options.portee  espaces de noms visibles autour du nœud (préfixe → URI), hérités des ancêtres NON canonisés
 * @param options.retrait true : même mise en page que `serialiser` (retraits de deux espaces, « \n ») ; false : compact
 * @param options.niveau  niveau de retrait du nœud
 */
export function canoniser(n, { portee = {}, retrait = false, niveau = 0 } = {}) {
  return rendre(n, portee, {}, retrait, niveau);
}

function rendre(n, porteeParent, rendu, retrait, niveau) {
  const declarations = {};
  const attributsOrdinaires = [];
  for (const [k, v] of Object.entries(n.attrs ?? {})) {
    if (v === undefined || v === null) continue;
    if (k === "xmlns") declarations[""] = String(v);
    else if (k.startsWith("xmlns:")) declarations[k.slice(6)] = String(v);
    else attributsOrdinaires.push([k, String(v)]);
  }
  const portee = { ...porteeParent, ...declarations };

  // Exclusive : seuls les préfixes réellement utilisés par l'élément ou ses attributs sont écrits, et seulement s'ils ne l'ont pas déjà été par un ancêtre.
  const utilises = new Set([prefixe(n.nom)]);
  for (const [k] of attributsOrdinaires) if (prefixe(k)) utilises.add(prefixe(k));
  const aEcrire = [];
  for (const p of utilises) {
    const uri = portee[p];
    if (p === "" && (uri === undefined || uri === "")) continue;
    if (uri === undefined) throw new Error(`Préfixe d'espace de noms non déclaré : ${p}`);
    if (rendu[p] !== uri) aEcrire.push([p, uri]);
  }
  aEcrire.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const nouveauRendu = { ...rendu };
  for (const [p, uri] of aEcrire) nouveauRendu[p] = uri;

  // Attributs triés par URI d'espace de noms puis nom local (sans préfixe : URI vide, donc en premier).
  const cle = ([k]) => [prefixe(k) ? (portee[prefixe(k)] ?? "") : "", local(k)];
  attributsOrdinaires.sort((a, b) => {
    const [ua, la] = cle(a);
    const [ub, lb] = cle(b);
    return ua < ub ? -1 : ua > ub ? 1 : la < lb ? -1 : la > lb ? 1 : 0;
  });

  const ouverture =
    `<${n.nom}` +
    aEcrire.map(([p, uri]) => ` ${p ? `xmlns:${p}` : "xmlns"}="${valeurAttributCanonique(uri)}"`).join("") +
    attributsOrdinaires.map(([k, v]) => ` ${k}="${valeurAttributCanonique(v)}"`).join("") +
    ">";
  const marge = retrait ? "  ".repeat(niveau) : "";

  if (n.enfants) {
    if (n.enfants.length === 0) return `${ouverture}</${n.nom}>`;
    const interieur = n.enfants.map((e) => (retrait ? `\n${"  ".repeat(niveau + 1)}` : "") + rendre(e, portee, nouveauRendu, retrait, niveau + 1)).join("");
    return `${ouverture}${interieur}${retrait ? `\n${marge}` : ""}</${n.nom}>`;
  }
  return `${ouverture}${texteCanonique(n.texte)}</${n.nom}>`;
}

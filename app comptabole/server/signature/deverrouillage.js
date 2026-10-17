import { ErreurSignature } from "./erreur.js";
import { lirePkcs12 } from "./pkcs12.js";

/**
 * Déverrouillage de la signature : le mot de passe du certificat est saisi par l'administrateur, sert une seule fois à ouvrir le .p12,
 * puis la clé privée (objet KeyObject, non extractible depuis l'API) reste EN MÉMOIRE du processus pendant DUREE_MS, puis est oubliée.
 * Rien n'est écrit sur disque, en base ni dans les journaux. Le serveur de production n'a qu'un processus : un redémarrage re-verrouille.
 * Les essais de mot de passe ratés sont limités (ESSAIS_MAX par FENETRE_MS) pour ne pas servir à deviner le mot de passe.
 */

export const DUREE_MS = 15 * 60 * 1000;
export const ESSAIS_MAX = 5;
export const FENETRE_MS = 15 * 60 * 1000;

let materiel = null; // { cle, certificat, chaine, infos, expireLe, parNom }
let echecs = []; // horodatages (ms) des échecs récents

const maintenant = () => Date.now();

function purgerEchecs() {
  const limite = maintenant() - FENETRE_MS;
  echecs = echecs.filter((t) => t > limite);
}

export function verrouiller() {
  materiel = null;
}

/** Matériel de signature si la signature est déverrouillée et non expirée ; sinon null (et l'état est effacé). */
export function obtenir() {
  if (materiel && materiel.expireLe <= maintenant()) materiel = null;
  return materiel;
}

export function etat() {
  const m = obtenir();
  return { deverrouille: Boolean(m), expireLe: m ? new Date(m.expireLe).toISOString() : null };
}

/** Ouvre le .p12 (déjà déchiffré par le coffre) avec le mot de passe saisi et garde la clé en mémoire. */
export function deverrouiller(fichierP12, motDePasse) {
  purgerEchecs();
  if (echecs.length >= ESSAIS_MAX) {
    const attente = Math.max(1, Math.ceil((echecs[0] + FENETRE_MS - maintenant()) / 60000));
    throw new ErreurSignature("TROP_ESSAIS", `Trop de mots de passe incorrects. Réessayez dans ${attente} minute(s).`, 429);
  }
  try {
    const lu = lirePkcs12(fichierP12, motDePasse, new Date());
    echecs = [];
    materiel = { ...lu, expireLe: maintenant() + DUREE_MS };
    return etat();
  } catch (e) {
    if (e instanceof ErreurSignature && e.code === "MOT_DE_PASSE") echecs.push(maintenant());
    throw e;
  }
}

/** Mémorise un matériel déjà lu (juste après le chargement du fichier, où le mot de passe vient d'être saisi). */
export function memoriser(lu) {
  materiel = { ...lu, expireLe: maintenant() + DUREE_MS };
  return etat();
}

/** Pour les tests : remet le module à zéro. */
export function _reinitialiser() {
  materiel = null;
  echecs = [];
}

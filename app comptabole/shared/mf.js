/**
 * Matricule fiscal tunisien (identifiant `I-01` du format TEIF), règle partagée par le serveur et l'écran.
 *
 * Forme complète (13 caractères) : 7 chiffres + lettre clé + code TVA + code catégorie + n° d'établissement (3 chiffres).
 * - clé : toute lettre sauf I, O, U ;
 * - code TVA : A, B, D, N ou P (les classes acceptées par le schéma TTN 1.8.9 ; « F » du guide n'y figure pas) ;
 * - code catégorie : C, M, N, P ou E (E pour un établissement secondaire) ;
 * - établissement : 3 chiffres (000 pour l'établissement principal).
 * Aucune clé de contrôle n'est vérifiée (le schéma TTN ne le fait pas non plus). Rien n'est « corrigé » à la place de l'utilisateur :
 * la normalisation se limite aux majuscules et à la suppression des espaces.
 */

export const MF_COMPLET = /^[0-9]{7}[ABCDEFGHJKLMNPQRSTVWXYZ][ABDNP][CMNPE][0-9]{3}$/;

/** Majuscules, sans espace ni tiret ni point. Chaîne vide si la valeur est absente. */
export function normaliserMatriculeFiscal(valeur) {
  return String(valeur ?? "").toUpperCase().replace(/[\s.\-/]/g, "");
}

/**
 * @param {unknown} valeur
 * @returns {{ ok: boolean, normalise: string, erreur: string }}
 */
export function validerMatriculeFiscal(valeur) {
  const normalise = normaliserMatriculeFiscal(valeur);
  const refus = (erreur) => ({ ok: false, normalise, erreur });
  if (!normalise) return refus("Matricule fiscal absent.");
  if (MF_COMPLET.test(normalise)) return { ok: true, normalise, erreur: "" };
  if (normalise.length !== 13) {
    const chiffres = /^[0-9]+/.exec(normalise)?.[0].length ?? 0;
    const piste = chiffres === 6 ? " Il manque peut-être un zéro au début (7 chiffres attendus)." : "";
    return refus(`Le matricule fiscal doit avoir 13 caractères (7 chiffres, lettre clé, code TVA, catégorie, établissement) : ${normalise.length} trouvés.${piste}`);
  }
  if (!/^[0-9]{7}/.test(normalise)) return refus("Les 7 premiers caractères du matricule fiscal doivent être des chiffres.");
  if (!/^[0-9]{7}[ABCDEFGHJKLMNPQRSTVWXYZ]/.test(normalise)) return refus("La lettre clé (8e caractère) est invalide (les lettres I, O et U sont exclues).");
  if (!/^[0-9]{7}[A-Z][ABDNP]/.test(normalise)) return refus("Le code TVA (9e caractère) doit être A, B, D, N ou P.");
  if (!/^[0-9]{7}[A-Z][ABDNP][CMNPE]/.test(normalise)) return refus("Le code catégorie (10e caractère) doit être C, M, N, P ou E.");
  return refus("Le numéro d'établissement (3 derniers caractères) doit être composé de 3 chiffres.");
}

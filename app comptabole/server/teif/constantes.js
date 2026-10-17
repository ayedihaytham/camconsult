/**
 * Constantes du message TEIF (facture électronique El Fatoora / TTN). Source : pack « Specifications techniques El Fatoora »
 * (XSD 1.8.8 / 1.8.9, guide d'implémentation TEIF v2.0, exemple signé). Les valeurs marquées « à confirmer » sont à valider auprès de TTN.
 */

/** Version du message envoyée dans `TEIF/@version` (le XSD 1.8.9 accepte 1.8.8 et 1.8.9). À confirmer auprès de TTN. */
export const TEIF_VERSION = "1.8.9";
export const TEIF_AGENCE = "TTN";

export const CODES = {
  identifiantMf: "I-01",
  facture: "I-11",
  dateEmission: "I-31",
  dateEcheance: "I-32",
  fournisseur: "I-62",
  client: "I-64",
  referenceRc: "I-815",
  conditionVirement: "I-114",
  observation: "I-48",
  tva: "I-1602",
  timbre: "I-1601",
  montantUnitaireHt: "I-183",
  montantLigneHt: "I-171",
  totalHt: "I-176",
  baseTaxable: "I-182",
  totalTaxes: "I-181",
  totalTtc: "I-180",
  baseTaxe: "I-177",
  montantTaxe: "I-178",
};

/** Unité de quantité des lignes. À confirmer : la liste des unités n'est pas dans le pack (l'exemple TTN utilise UNIT). */
export const UNITE_PAR_DEFAUT = "UNIT";

/** Longueurs maximales du schéma 1.8.9. */
export const LONGUEURS = {
  nomPartenaire: 200,
  adresseDescription: 500,
  rue: 35,
  ville: 35,
  codePostal: 17,
  pays: 6,
  referenceRc: 200,
  codeArticle: 35,
  descriptionArticle: 500,
  quantite: 35,
  tauxTva: 5,
  texteLibre: 500,
  conditionPaiement: 500,
  montantEnLettres: 500,
};

/** `DocumentIdentifier` (1.8.9) : 30 caractères au plus, lettres, chiffres, point, tiret bas, tiret ; sans espace, accent ni « / ». */
export const DOCUMENT_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._-]{0,29}$/;

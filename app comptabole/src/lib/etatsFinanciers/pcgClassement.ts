/**
 * Suggestion automatique du code AFFECTAT à partir d'un numéro de compte du
 * Système Comptable des Entreprises tunisien (classes 1 à 7 — la même
 * numérotation que dans Sage 100, vérifiée sur le plan comptable réel de
 * RUSPINA). Sert de filet lors de l'import d'une balance (ImportBalanceDialog)
 * pour les comptes qu'aucune balance précédente n'a encore "appris"
 * (grille_comptes) : plutôt que de laisser la ligne sans code, on propose le
 * code AFFECTAT le plus probable selon la classe du compte — l'utilisateur
 * reste libre de le corriger avant de confirmer l'import.
 *
 * Portée volontairement prudente : les comptes dont la nature (actif/passif)
 * dépend du sous-compte précis plutôt que de la classe (42 personnel, 43 État,
 * 44 groupe/associés, 45 débiteurs/créditeurs divers, 46 comptes d'attente,
 * 49 provisions sur tiers hors clients...) ne sont PAS devinés — mieux vaut
 * "non affecté" (visible, à corriger) qu'un mauvais classement silencieux.
 */

const RULES_3: Record<string, string | null> = {
  "111": "CP02", // Réserve légale
  "421": "AC12", // Personnel — avances et acomptes (débiteur)
  "422": "AC12", // Personnel — comités d'entreprise (débiteur)
  "423": "P05", // Personnel — œuvres sociales (créditeur)
  "425": "P05", // Personnel — rémunérations dues
  "426": "P05", // Personnel — dépôts
  "427": "P05", // Personnel — oppositions
  "428": "P05", // Personnel — charges à payer
  "431": "AC12", // État — subventions à recevoir (débiteur)
  "432": "P05", // État — retenues à la source opérées (toujours dues à l'État, créditeur)
  "471": "AC12", // Charges constatées d'avance (actif)
  "472": "P05", // Produits constatés d'avance (passif)
  "603": "CHPR1", // Variation des stocks
  "607": "CH01", // Achats de marchandises
  "681": "CH04", // Dotations aux amortissements
  "686": "CH44", // Dotations aux provisions
  "701": "PR02",
  "702": "PR02",
  "703": "PR02",
  "704": "PR02",
  "705": "PR02",
  "706": "PR02",
  "707": "PR01", // Ventes de marchandises
  "708": "PR02",
  "709": "PR02",
  "281": null, // Amort. immo incorporelles — pas de code dédié (rare)
};

const RULES_2: Record<string, string | null> = {
  "10": "CP01", // Capital
  "11": "CP03", // Réserves et primes (hors 111)
  "12": "CP04", // Résultats reportés
  "13": null, // Résultat de l'exercice — calculé par l'appli, ne jamais affecter
  "14": null, // Autres capitaux propres (subventions d'investissement…) — pas de code dédié
  "15": "P03", // Provisions pour risques et charges (non courantes)
  "16": "P06", // Emprunts et dettes assimilées
  "17": null, // Comptes de liaison des établissements — rare
  "18": null, // Autres passifs non courants — pas de code dédié
  "21": "AC01", // Immobilisations incorporelles
  "22": "AC03", // Immobilisations corporelles
  "23": "AC03", // Immobilisations en cours
  "24": "AC03", // Immobilisations à statut juridique particulier
  "25": "AC02", // Titres et créances liées à des participations
  "26": "AC02", // Autres immobilisations financières
  "27": null, // Autres actifs non courants — pas de code dédié
  "28": "AC04", // Amortissements des immobilisations corporelles
  "29": null, // Provisions pour dépréciation des immobilisations — pas de code dédié
  "31": "AC08", // Matières premières et fournitures liées
  "32": "AC08", // Autres approvisionnements
  "33": "AC08", // En-cours de production de biens
  "34": "AC08", // En-cours de production de services
  "35": "AC08", // Stocks de produits
  "37": "AC08", // Stocks de marchandises
  "39": null, // Provisions pour dépréciation des stocks — pas de code dédié
  "40": "P04", // Fournisseurs et comptes rattachés
  "41": "AC10", // Clients et comptes rattachés
  "42": null, // Personnel — nature mixte au-delà des sous-comptes ci-dessus
  "43": null, // État et collectivités publiques — nature mixte (TVA déductible/collectée, acomptes vs impôts à payer…) hors 431/432 ci-dessus
  "44": null, // Sociétés du groupe et associés — nature mixte
  "45": null, // Débiteurs divers et créditeurs divers — mixte par définition
  "46": null, // Comptes transitoires ou d'attente — à solder, jamais deviné
  "47": null, // Comptes de régularisation (hors 471/472 ci-dessus)
  "48": "P05", // Provisions courantes pour risques et charges
  "49": null, // Provisions pour dépréciation des comptes de tiers (hors clients) — pas de code dédié
  "50": "P06", // Emprunts et autres dettes financières courantes
  "51": "AC12", // Prêts et autres créances financières courantes
  "52": "AC12", // Placements courants
  "53": "AC15", // Banques
  "54": "AC15", // Caisse
  "55": "AC15", // Régies d'avances et accréditifs
  "58": null, // Virements internes — se solde à ~0, jamais deviné
  "59": null, // Provisions pour dépréciation des comptes financiers — pas de code dédié
  "60": "CH02", // Achats consommés — approvisionnements (hors 607, marchandises)
  "61": "CH05", // Services extérieurs
  "62": "CH05", // Autres services extérieurs
  "63": "CH05", // Charges diverses ordinaires
  "64": "CH03", // Charges de personnel
  "65": "CH07", // Charges financières
  "66": "CH12", // Impôts, taxes et versements assimilés sur rémunérations
  "67": null, // Pertes extraordinaires — pas de code dédié (rare)
  "68": "CH44", // Dotations aux amortissements et provisions (hors 681, amortissements)
  "69": "CH10", // Impôts sur les bénéfices
  "70": "PR02", // Ventes (hors 707, marchandises)
  "71": null, // Production stockée — pas de code dédié
  "72": null, // Production immobilisée — pas de code dédié
  "73": "CH08", // Produits divers ordinaires (pas "d'exploitation" — voir cpc.autres_produits_ordinaires)
  "74": "PR02", // Subventions d'exploitation
  "75": "CH07", // Produits financiers — nettés dans « Charges financières nettes »
  "77": null, // Gains extraordinaires — pas de code dédié (rare)
  "78": null, // Reprises sur amortissements et provisions — pas de code dédié
  "79": null, // Transferts de charges — pas de code dédié
};

/** Suggère un code AFFECTAT à partir du numéro de compte (classe SCE
 * tunisien), ou null si la classe n'a pas de correspondance sûre (nature
 * mixte ou trop rare pour être devinée sans risque). */
export function suggestAffectatFromCompte(compte: string): string | null {
  const c = compte.trim();
  if (!c) return null;
  const p3 = c.slice(0, 3);
  if (p3 in RULES_3) return RULES_3[p3];
  const p2 = c.slice(0, 2);
  if (p2 in RULES_2) return RULES_2[p2];
  return null;
}

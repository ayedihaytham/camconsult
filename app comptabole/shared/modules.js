// Modules de l'application et environnement de publication.
//
// L'environnement de test (test.camconsult.com.tn) montre tout ; la production (cabinet.camconsult.com.tn) n'ouvre que les modules
// validés, listés dans la variable MODULES_ACTIFS (clés séparées par des virgules). Vide, absente ou « * » = tous les modules.
// Un module inactif est masqué du menu, ses pages renvoient à l'accueil et son API répond 403 : le serveur applique la règle,
// le navigateur ne fait que la refléter.
//
// `chemins` : routes du navigateur ; `api` : préfixes de l'API ; `dependants` : modules actifs qui ont encore besoin de l'API de ce
// module (ses pages restent masquées, mais le Stock lit les fournisseurs et la banque, les Collectes écrivent dans l'État SWIFT).

export const MODULES = [
  { cle: "tableau-de-bord", libelle: "Tableau de bord", chemins: ["/"], exact: true, api: [] },
  { cle: "taches", libelle: "Mes tâches", chemins: ["/taches"], api: ["/api/taches"] },
  { cle: "messagerie", libelle: "Messagerie", chemins: ["/messagerie"], api: ["/api/messages", "/api/conversations"] },
  { cle: "societes", libelle: "Sociétés", chemins: ["/societes"], api: ["/api/societes"] },
  { cle: "collectes", libelle: "Collectes de pièces", chemins: ["/collectes"], api: ["/api/collectes"] },
  { cle: "structuration", libelle: "Structuration", chemins: ["/structuration"], api: ["/api/noeuds"] },
  { cle: "stock", libelle: "Stock", chemins: ["/stock"], api: ["/api/stock"] },
  { cle: "journal", libelle: "Journal", chemins: ["/journal"], api: ["/api/journal"] },
  { cle: "cours-change", libelle: "Cours de change", chemins: ["/cours-change"], api: ["/api/cours-change"] },
  { cle: "suivi-devise", libelle: "Suivi client devise", chemins: ["/suivi-devise"], api: ["/api/suivi-devise"] },
  { cle: "equipe", libelle: "Équipe", chemins: ["/employes"], api: ["/api/employes"] },
  { cle: "conversions", libelle: "Conversions", chemins: ["/conversions"], api: [] },
  { cle: "parametres", libelle: "Paramètres", chemins: ["/parametres"], api: ["/api/administrateurs"] },
  // Modules pas encore validés pour la production.
  { cle: "apurement", libelle: "Apurement TVA", chemins: ["/apurement"], api: ["/api/apurement"] },
  { cle: "facturation", libelle: "Facturation", chemins: ["/facturation"], api: ["/api/facturation", "/api/ttn", "/api/signature"] },
  { cle: "honoraires", libelle: "Honoraires", chemins: ["/honoraires"], api: ["/api/honoraires"] },
  { cle: "fournisseurs", libelle: "Fournisseurs", chemins: ["/fournisseurs"], api: ["/api/fournisseurs"], dependants: ["stock"] },
  { cle: "banque", libelle: "Suivi bancaire", chemins: ["/banque"], api: ["/api/banque"], dependants: ["stock", "suivi-devise"] },
  { cle: "etat-swift", libelle: "État SWIFT", chemins: ["/etat-swift"], api: ["/api/etat-swift"], dependants: ["collectes"] },
  { cle: "etats-financiers", libelle: "États financiers", chemins: ["/etats-financiers"], api: ["/api/balances", "/api/notes", "/api/immobilisations"] },
  { cle: "affectat", libelle: "Paramétrage AFFECTAT", chemins: ["/grille-affectat"], api: ["/api/grille-affectat"] },
  { cle: "bordereaux", libelle: "Bordereaux", chemins: ["/bordereaux"], api: ["/api/bordereaux"] },
  { cle: "souche-cheques", libelle: "Souche de chèques", chemins: ["/souche-cheques", "/ma-souche"], api: ["/api/souche-cheques"] },
  { cle: "simulation-paie", libelle: "Simulation de paie", chemins: ["/simulation-paie"], api: [] },
];

/** Modules ouverts en production (validés en test) : c'est la valeur par défaut du fichier docker-compose de production. */
export const MODULES_PRODUCTION = MODULES.slice(0, 13).map((m) => m.cle);

/** « a,b,c » → Set des clés connues ; null = tous les modules (variable vide ou « * »). */
export function lireModulesActifs(valeur) {
  const texte = String(valeur ?? "").trim();
  if (!texte || texte === "*") return null;
  const connues = new Set(MODULES.map((m) => m.cle));
  return new Set(texte.split(",").map((s) => s.trim()).filter((s) => connues.has(s)));
}

const sousChemin = (chemin, base) => chemin === base || chemin.startsWith(`${base}/`) || chemin.startsWith(`${base}?`);

/** Module d'une route du navigateur ; null pour une route qui n'appartient à aucun module (connexion, profil…). */
export function moduleDuChemin(chemin) {
  for (const m of MODULES) {
    if (m.exact ? chemin === "/" : m.chemins.some((base) => sousChemin(chemin, base))) return m.cle;
  }
  return null;
}

/** Module d'une adresse de l'API ; null si elle n'est liée à aucun module (authentification, santé, notifications…). */
export function moduleDeApi(url) {
  return MODULES.find((m) => m.api.some((base) => sousChemin(url, base))) ?? null;
}

/** La page est-elle ouverte ? `actifs` = null : tout est ouvert. */
export function cheminOuvert(actifs, chemin) {
  if (!actifs) return true;
  const cle = moduleDuChemin(chemin);
  return cle === null || actifs.has(cle);
}

/** L'API est-elle ouverte ? Un module inactif reste joignable tant qu'un module actif en dépend. */
export function apiOuverte(actifs, url) {
  if (!actifs) return true;
  const m = moduleDeApi(url);
  if (!m) return true;
  return actifs.has(m.cle) || (m.dependants ?? []).some((d) => actifs.has(d));
}

import { apiOuverte, lireModulesActifs, MODULES_PRODUCTION } from "../shared/modules.js";

/** Environnement de publication : « production », « test » ou « developpement » (ENVIRONNEMENT, sinon déduit de NODE_ENV). */
export const ENVIRONNEMENT = process.env.ENVIRONNEMENT || (process.env.NODE_ENV === "production" ? "production" : "developpement");

/**
 * Modules ouverts (Set de clés) ; null = tous. Lue une fois au démarrage : changer MODULES_ACTIFS demande de relancer le conteneur.
 * Sécurité : en production, une variable ABSENTE ouvre seulement les modules validés (jamais « tout ») ; « * » ouvre tout explicitement.
 */
export const MODULES_ACTIFS =
  process.env.MODULES_ACTIFS === undefined && ENVIRONNEMENT === "production"
    ? lireModulesActifs(MODULES_PRODUCTION.join(","))
    : lireModulesActifs(process.env.MODULES_ACTIFS);

/** Refuse (403) l'API d'un module fermé dans cet environnement. */
export function garderModules(req, res, next) {
  if (apiOuverte(MODULES_ACTIFS, req.originalUrl.split("?")[0])) return next();
  res.status(403).json({ error: "Ce module n'est pas encore disponible dans cet environnement." });
}

/** GET /api/config : de quoi adapter l'interface (menu, pages, bandeau « test »). Aucune donnée sensible. */
export function configPublique(_req, res) {
  res.json({ environnement: ENVIRONNEMENT, modulesActifs: MODULES_ACTIFS ? [...MODULES_ACTIFS] : null });
}

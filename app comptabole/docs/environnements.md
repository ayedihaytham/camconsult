# Environnements : test et production

| | Test | Production |
| --- | --- | --- |
| Adresse | https://test.camconsult.com.tn | https://cabinet.camconsult.com.tn |
| Branche Git | `main` | `production` |
| Image Docker | `merba7/app-comptable:test` | `merba7/app-comptable:latest` |
| Données | fictives, base séparée | réelles |
| Modules | tous | ceux de `MODULES_ACTIFS` |

## Modules ouverts en production

Tableau de bord, Mes tâches, Messagerie, Sociétés, Collectes de pièces, Structuration, Stock, Journal, Cours de change,
Suivi client devise, Équipe, Conversions, Paramètres. La liste fait foi dans [`shared/modules.js`](../shared/modules.js)
(`MODULES_PRODUCTION`) ; l'environnement la surcharge avec la variable `MODULES_ACTIFS`.

Un module fermé est masqué du menu, ses pages renvoient à l'accueil et son API répond 403. Fournisseurs, Suivi bancaire et
État SWIFT n'ont pas de page en production mais leur API reste ouverte : le Stock et les Collectes s'en servent.

## Règles pour le code

- Tout nouveau module ou toute nouvelle route doit être déclaré dans `shared/modules.js` (chemins du navigateur et préfixes
  de l'API), sinon il reste ouvert en production sans que personne l'ait décidé.
- Le navigateur reflète la règle (menu, redirection) ; le serveur l'applique (`server/modules.js`).
- Ne jamais compter sur le masquage du menu seul.

## Publier

- `git push origin main` : construit l'image de test.
- `git push origin origin/main:production` : construit l'image de production, appliquée par Watchtower (≈ 1 minute).
  Si le push ne contient aucun fichier modifié, lancer le workflow à la main (Actions, Run workflow, branche `production`).
- Procédure complète et création de l'environnement de test : [`deploy/README.md`](../../deploy/README.md).

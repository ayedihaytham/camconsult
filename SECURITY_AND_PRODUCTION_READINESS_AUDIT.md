# Audit de sécurité et préparation à la mise en production

Date : 15 octobre 2026. Périmètre : `app comptabole/` (outil de gestion de cabinet, pas une comptabilité en partie double).
État du dépôt au moment du rapport : branche `main`, **rien n'est poussé ni déployé** ; les corrections sont dans des commits locaux (voir §3).

## 1. Décision

**CONDITIONNELLEMENT PRÊT** (aucun défaut critique connu n'est resté ouvert dans le code, mais des conditions de mise en ligne restent à remplir).

Ce n'est pas un « prêt pour la production » : les mots de passe en clair déjà présents en base ne disparaissent qu'à la reconnexion de chaque compte (ou par le script de migration), aucun test n'a tourné contre une base de test dédiée dans la chaîne d'intégration, et 13 vulnérabilités de dépendances restent documentées (§5). Conditions de sortie : §9.

## 2. Suivi des 19 constats

| ID | Gravité | Disposition | Preuve et reste à faire |
| --- | --- | --- | --- |
| SEC-01 mots de passe en clair | Critique | **Corrigé dans le code, mise en ligne conditionnelle** | Empreinte scrypt (`server/passwords.js`), plus aucun mot de passe ni empreinte dans les réponses, liens d'activation à usage unique, conversion progressive des comptes hérités. 24 tests dédiés. Reste : conversion des comptes qui ne se reconnectent pas (script `migrate-passwords.js`), anciennes sauvegardes encore en clair, décision « forcer le changement » (§4). |
| SEC-02 pas de limite de connexion | Haute | **Corrigé** | `server/loginGuard.js` : 8 échecs par compte et adresse, 100 par adresse, 15 min, 429 + Retry-After. Limites : mémoire d'un seul processus (pas de partage entre instances), verrouillage ciblé possible d'un compte par un attaquant (compromis assumé). |
| SEC-03 secret JWT par défaut | Haute | **Corrigé** | Le serveur refuse de démarrer en production sans secret de 24 caractères au moins et différent de la valeur de développement (vérifié à la main et par `check-config.js`). |
| DATA-01 réinitialisation destructrice | Haute | **Corrigé en partie** | Confirmation exigée par le serveur, désactivée en production sans `ALLOW_DATA_RESET=true`, textes d'écran alignés sur la portée réelle (2 tests). Reste : sauvegarde automatique avant l'opération. |
| SEC-04 dépendances vulnérables | Haute | **Corrigé en partie** | Production : 17 → 13 vulnérabilités, critique 1 → 0 (§5). |
| QA-01 CI sans tests | Haute | **Corrigé (non exécuté sur GitHub)** | Job `tests` (types + tests) requis par le job `docker` ; contrôlé par des tests statiques du fichier. Ce poste n'exécute pas GitHub Actions : le premier passage réel reste à observer. |
| SEC-05 extraction IA ouverte | Moyenne | **Corrigé** | 403 pour un compte société, avec ou sans société précisée (3 appels testés). |
| SEC-06 journal effaçable | Moyenne | **Corrigé en partie** | Route de suppression et bouton retirés ; déclencheur PostgreSQL qui refuse UPDATE et DELETE (vérifié dans une transaction annulée). Un administrateur de base peut retirer le déclencheur : pas d'infalsifiabilité. Reste : stockage externe pour une vraie piste d'audit, journal encore écrit « au mieux » hors transaction. |
| SEC-07 identifiants société exposés | Moyenne | **Corrigé** | `societeDto` ne renvoie plus identifiant ni mot de passe ; écriture et restauration ne les traitent plus. Les colonnes restent en base (valeurs héritées éventuelles à purger : décision §4). |
| SEC-08 en-têtes / jeton | Moyenne | **Corrigé en partie** | En-têtes de base, HSTS en HTTPS, CSP en rapport seul (`server/securityHeaders.js`). Constat en production (requête HEAD du 15/10, version déployée du 13/10) : aucun de ces en-têtes présent, `X-Powered-By: Express` présent. Reste : passer la CSP en blocage après observation, jeton toujours dans le navigateur (localStorage, 12 h, sans révocation). |
| SEC-09 fichiers en base64 | Moyenne | **Ouvert** | Pas de limite par route ni de contrôle du type réel. |
| SEC-10 fichiers clients dans git | Moyenne | **Corrigé en partie** | 19 classeurs `samples/Balance_*.xlsx` retirés de l'index (restent sur le disque), `samples/`, `ocr-transfer/`, archives et journaux locaux ignorés. L'historique git contient toujours ces fichiers (un seul commit) : purge non faite, voir §4. |
| SEC-11 mot de passe admin par défaut | Faible | **Corrigé** | Refus en production à l'initialisation, signalé par `check-config.js`. |
| FIN-01 sur-règlement concurrent | Moyenne | **Corrigé** | Verrou consultatif par société et fournisseur avant le contrôle du solde ; ordre vérifié par test, instruction vérifiée sur PostgreSQL. Un test de concurrence réel sur base n'a pas été exécuté. |
| FIN-02 suppression en cascade | Moyenne | **Corrigé en partie** | Refus (409) d'une société portant des factures, honoraires, règlements, banque, SWIFT, stock, balances, souches ou suivis en devise, sauf `confirmationDefinitive` (2 tests, requête vérifiée sur PostgreSQL). Pas de suppression logique ni d'écran d'archivage dédié (le statut « Inactif » existe). |
| FIN-03 TVA et avoirs | Moyenne | **Défaut mathématique corrigé ; avoirs bloqués** | Voir §6. Les notes de crédit ne sont pas implémentées : décision de politique comptable. |
| FIN-04 précision et contraintes SQL | Faible | **Ouvert** | Migration à planifier (numeric(18,3), CHECK sur les statuts). |
| QA-02 tests d'intégration | Moyenne | **Corrigé en partie** | 54 tests serveur ajoutés avec vraies requêtes HTTP et base simulée, plus une validation SQL réelle dans une transaction annulée (§7). Pas de base de test dans la CI, pas de test de bout en bout. |
| PERF-01 filtrage en mémoire | Faible | **Ouvert** | Non traité. |

## 3. Modifications réalisées

Commits locaux (non poussés) : `8db7ba2` (première série) puis un second commit pour cette phase.

- **Mots de passe et accès** : `server/passwords.js` (nouveau), `routes/auth.js`, `routes/employes.js`, `routes/data.js`, `mailer.js`, `mappers.js`, `schema.sql`, `server/scripts/migrate-passwords.js` (nouveau). Écrans : `ActivationPage`, `LienAccesDialog`, `EmployeFormSheet`, `EmployesListPage`, `SocieteEmployesSection`, `store/auth.ts`, `store/data.ts`, `types`.
- **Sociétés** : `routes/societes.js` (plus d'identifiant/mot de passe ; protection de suppression).
- **Journal** : `routes/journal.js`, `JournalPage.tsx`, `store/journal.ts`, `schema.sql` (déclencheur).
- **Réinitialisation** : `routes/data.js`, `ParametresPage.tsx`, `store/data.ts`.
- **Connexion** : `loginGuard.js`, `routes/auth.js`.
- **En-têtes** : `securityHeaders.js`, `index.js`.
- **Calculs** : `shared/arrondi.js`, `shared/factureTotaux.js` (nouveaux) ; 15 copies locales de l'arrondi remplacées (serveur et écran) ; `lib/amount.ts`, `lib/facturation.ts`, `mappers.js`.
- **Règlements fournisseurs** : `routes/fournisseurs.js`.
- **Configuration** : `configCheck.js`, `scripts/check-config.js` (nouveaux).
- **Dépôt et CI** : `.gitignore`, 19 fichiers retirés de l'index, `.github/workflows/app-comptable.yml`.
- **Dépendances** : `package-lock.json` (express 4.22.3, body-parser 1.20.8, qs 6.16.1, proxy-addr 2.0.8).
- **Documentation** : `ARCHITECTURE.md`, `docs/permissions.md`, ce rapport.

## 4. Stratégie de migration des mots de passe et décisions à prendre

Conception : aucun traitement en bloc. Chaque compte hérité garde son accès : à la **première connexion réussie**, le mot de passe saisi est transformé en empreinte, enregistré, et la valeur en clair est effacée. Un mauvais mot de passe ne convertit rien. Les comptes créés après la mise à jour n'ont jamais de mot de passe : ils passent par un lien d'activation.

Limites et risques à connaître :
- **Retour en arrière** : une fois un compte converti, l'ancienne version du code ne peut plus le connecter (la colonne en clair est vide). En cas de retour arrière, il faut émettre un lien ou rétablir la base d'avant la mise en ligne.
- **Comptes dormants** : tant qu'ils ne se reconnectent pas, leur mot de passe reste en clair. `node server/scripts/migrate-passwords.js` (simulation par défaut, `--apply` pour convertir, `--forcer-changement` pour imposer un nouveau mot de passe) traite le reste ; il n'a **pas** été exécuté.
- **Sauvegardes** : toute sauvegarde antérieure contient les mots de passe en clair et doit être traitée comme sensible (accès limité, chiffrée, supprimée à terme).
- **Exposition passée** : ces mots de passe étaient visibles de l'administrateur, présents dans des emails et dans les sauvegardes. Un changement de mot de passe forcé pour tous (`--forcer-changement`) est recommandé ; je ne l'ai pas décidé à votre place.
- **Emails** : l'envoi d'emails n'est pas configuré en production d'après vos journaux précédents ; dans ce cas l'administrateur transmet lui-même le lien affiché une seule fois (la fenêtre le dit).
- **Décisions pour vous** : forcer ou non le changement pour tous ; purger les valeurs `identifiant`/`mot_de_passe` héritées de la table `societes` ; purger l'historique git des classeurs clients (réécriture d'historique : tout clone et toute copie partagent l'ancien historique, une réécriture exige une coordination avec Wassim et un push forcé, je ne l'ai pas fait) ; confidentialité du dépôt GitHub (je n'ai pas pu la vérifier : l'outil `gh` est absent de ce poste).

## 5. Dépendances (production : 13 vulnérabilités restantes, aucune critique)

Corrigées par mise à jour dans les limites de version : `express` 4.22.2 → 4.22.3, `body-parser` → 1.20.8, `qs` → 6.16.1, `proxy-addr` (critique, usurpation d'IP) → 2.0.8. Tests, types et construction relancés après la mise à jour (1027 tests réussis).

| Paquet | Gravité | Usage | Décision |
| --- | --- | --- | --- |
| `tailwindcss`, `braces`, `micromatch`, `chokidar`, `fast-glob`, `source-map-js`, `postcss-nested`, `postcss-selector-parser` | 7 hautes, 2 moyennes | Construction du CSS (outil de build, ne tourne pas dans l'image d'exécution) | Risque accepté à court terme ; correction = Tailwind 4 (changement majeur à planifier). |
| `react-router(-dom)` 6.30.6 | Moyenne | Navigation du navigateur (redirection ouverte via `Link`/`useNavigate` avec une URL non fiable) | Le code ne navigue pas vers des adresses saisies par l'utilisateur ; correction = version 7 (majeure). |
| `exceljs` / `uuid` | Moyenne | Export Excel dans le navigateur | Correction proposée par npm = retour à `exceljs@3.4.0` : refusée (régression). Non exploitable tel qu'utilisé. |
| `xlsx` (SheetJS) 0.18.5 | Haute (pollution de prototype, ReDoS) | Lecture et écriture de classeurs dans le navigateur | **Aucun correctif sur le registre npm.** Mitigation : fichiers choisis par l'utilisateur sur son propre poste. Correction possible : version officielle 0.20.x distribuée par SheetJS (hors registre npm, décision de confiance de la chaîne d'approvisionnement) ou lecture via `exceljs`. |

## 6. Calculs de facture (FIN-03)

- Règle documentée dans `shared/factureTotaux.js` et utilisée par le serveur et l'écran : lignes non arrondies, total HT arrondi au millime, TVA sur le total (pas ligne par ligne), timbre ajouté après TVA, moitié vers le haut.
- **Défaut mathématique trouvé et corrigé** : l'ancien arrondi `Math.round((n + EPSILON) * 1000) / 1000` (copié 15 fois) arrondissait mal environ 0,6 % des cas exactement au demi-millime (par exemple 2,0035 donnait 2,003 au lieu de 2,004). Mesuré sur 2 000 000 de cas : 11 778 erreurs avant, 0 après. Exemple concret : TVA 19 % sur un HT de 100,050 (19,0095) donne désormais 19,010 ; net 120,060. `lib/amount.ts` utilisait un arrondi encore plus brut, également remplacé.
- Tests : 9 tests de calcul (exemples documentés, flottants, champs invalides, demi-millimes).
- **Décisions de politique comptable, non inventées** : arrondi de TVA par ligne ou sur le total, traitement des avoirs et corrections partielles, règle fiscale tunisienne applicable. À confirmer par un professionnel local.

## 7. Tests

Exécutés (poste de développement, résultats réels) :
- Vérification des types : réussie.
- Suite complète : **1027 tests réussis sur 126 fichiers, 0 échec** (avant la phase : 973). Nouveaux : mots de passe et jetons (11), connexion et activation (8), exposition des données, suppression de société, accès réservés et réinitialisation (12), chaîne de déploiement, en-têtes et calculs (14), configuration (8), verrou des règlements (1).
- Construction de production : réussie.
- `git diff --check` : seuls des avertissements de fin de ligne.
- Validation SQL sur PostgreSQL réel (base de développement locale, **dans une transaction annulée**, aucune donnée conservée, vérification faite après l'annulation) : application complète de `schema.sql`, jeton à usage unique, jeton expiré, contrainte de but, déclencheur du journal (UPDATE et DELETE refusés), requête de protection des sociétés, verrou consultatif. 10 contrôles réussis.
- Requête HEAD sur le site public (lecture seule) pour relever les en-têtes de la version actuellement déployée.
- Contrôle de configuration sur ce poste (sans base) : conforme à ce que fait un poste de développement (secret présent ; mot de passe administrateur par défaut et mot de passe de base faible, ce qui est le cas du développement local).

**Non exécutés, et pourquoi** :
- Tests d'intégration automatisés contre une base jetable dans la CI : pas d'environnement dédié ; je n'ai pas lancé de conteneur Docker (action jugée hors périmètre sans votre accord).
- Test de concurrence réel (deux règlements simultanés) : nécessite une base de test.
- Tests de bout en bout dans le navigateur, tests de charge, mesure de couverture (aucun outil de couverture n'est configuré, aucun pourcentage n'est donné).
- Restauration d'une sauvegarde dans un environnement isolé : non faite, donc la récupérabilité n'est pas démontrée.
- Première exécution du nouveau pipeline sur GitHub Actions.
- Envoi réel d'emails avec liens d'accès (SMTP non disponible ici).

## 8. Risques restants

SEC-09 (stockage des fichiers), FIN-04 (précision des montants), PERF-01, jeton en localStorage, CSP non bloquante, journal modifiable par un administrateur de base, limite de connexion non partagée entre instances, dépendances du §5, avoirs absents, sauvegardes anciennes en clair, recouvrement jamais testé.

## 9. Liste de contrôle avant mise en ligne

À faire par la personne responsable, sans jamais coller de secret dans une conversation ni dans git :
1. Sur le serveur : `docker exec <conteneur> node server/scripts/check-config.js` (lecture seule, n'affiche aucun secret). Aucun `[ECHEC]` ne doit rester. Le constat du 15/10 montre déjà que le site répond derrière nginx avec un `CORS_ORIGIN` défini.
2. `JWT_SECRET` d'au moins 24 caractères aléatoires, `ADMIN_PASSWORD` défini, `ALLOW_DATA_RESET` absent, `APP_URL` défini (liens d'accès), SMTP configuré ou procédure manuelle acceptée.
3. nginx : transmettre `X-Forwarded-Proto` (HSTS) et `X-Forwarded-For` (adresses réelles) ; vérifier par une connexion échouée répétée depuis deux postes que seules les adresses concernées sont limitées ; sinon définir `CLIENT_IP_HEADER`.
4. Faire une sauvegarde complète de la base, la chiffrer, et **tester sa restauration** dans un environnement isolé.
5. Décider : changement de mot de passe forcé pour tous, purge des colonnes héritées de `societes`, purge de l'historique git.
6. Vérifier que le job `tests` passe sur GitHub avant que l'image soit publiée.
7. Après déploiement : `curl -sI https://cabinet.camconsult.com.tn/` doit montrer les nouveaux en-têtes et ne plus montrer `X-Powered-By`.

## 10. Déploiement et retour arrière recommandés

1. Sauvegarde et test de restauration (§9.4).
2. Pousser la branche : l'intégration continue exécute les contrôles, puis publie l'image ; Watchtower la déploie en 3 à 6 minutes. **Je n'ai rien poussé.**
3. Au démarrage, le serveur applique le schéma (idempotent) : colonne `mdp_hash`, table `password_tokens`, déclencheur du journal. Aucune suppression de données.
4. Vérifier `check-config.js`, une connexion administrateur, une connexion d'un compte hérité (puis de nouveau, pour confirmer la conversion), la création d'un compte avec lien d'activation et un flux d'activation complet.
5. Retour arrière : redéployer l'image précédente. Les comptes déjà convertis ne pourront plus se connecter avec l'ancienne version : émettre des liens d'accès avec la nouvelle version, ou restaurer la sauvegarde d'avant la mise en ligne. Les colonnes et tables ajoutées sont ignorées par l'ancienne version.

## 11. Étapes restantes recommandées, par priorité

1. Valider les décisions du §4 et exécuter la liste du §9.
2. Base de test jetable dans la CI et premiers scénarios de bout en bout (connexion, activation, règlements concurrents).
3. Stockage des fichiers hors base et limites par route (SEC-09) ; CSP en blocage.
4. Mise à jour majeure de Tailwind, de React Router et remplacement de `xlsx`.
5. Archivage des sociétés (suppression logique), précision des montants et contraintes SQL (FIN-04), avoirs après décision comptable.

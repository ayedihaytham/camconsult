# Audit de sécurité et préparation à la mise en production

Dernière mise à jour : 15 octobre 2026 (phase 11 : voir §20). Périmètre : `app comptabole/` (outil de gestion de cabinet, pas une comptabilité en partie double). Documents liés : `RELEASE_CHECKLIST.md`, `docs/sauvegarde-restauration.md`, `docs/plan-nettoyage-donnees-heritees.md`.

## 1. Décision

**CONDITIONNELLEMENT PRÊT** — aucun défaut critique connu n'est ouvert dans le code, mais la mise en ligne reste soumise à des conditions non remplies (§12) : restauration d'une sauvegarde jamais testée, contrôle de configuration jamais exécuté sur le serveur réel, pipeline jamais exécuté sur GitHub, décisions métier en attente, vulnérabilités de dépendances restantes documentées.

Ce n'est pas « prêt pour la production » : des tests qui réussissent ne remplacent pas ces vérifications.

## 2. État du dépôt

- Branche `main`, en avance de 3 commits sur `origin/main` au début de la phase 4 (`8db7ba2`, `414d59c`, `8c21d6a`, **tous intacts**) ; les changements de la phase 4 sont dans un quatrième commit local (non poussé).
- Rien n'est poussé, fusionné, publié ni déployé. Aucune histoire git n'a été réécrite. Aucune donnée de production n'a été lue ni modifiée.
- Un `git push` sur `main` publie `latest` et déclenche le déploiement automatique (Watchtower, 60 s) : voir le §10 de `RELEASE_CHECKLIST.md` avant tout push.

## 3. Suivi de tous les constats

Légende : **Corrigé** = corrigé dans le code et testé ; **En partie** = reste une action ; **Ouvert** ; **Décision** = décision métier requise.

| ID | Gravité | Statut | Preuve | Reste à faire | Décision métier |
| --- | --- | --- | --- | --- | --- |
| SEC-01 mots de passe en clair | Critique | **Corrigé dans le code ; mise en ligne conditionnelle** | Empreinte scrypt ; aucune réponse de l'API ne contient mot de passe ni empreinte ; liens d'activation à usage unique ; 21 tests d'intégration PostgreSQL + tests unitaires dédiés (empreintes, jetons, connexion, exposition) ; **défaut de concurrence trouvé et corrigé en phase 3** (§4) ; retour arrière évalué expérimentalement (§5). | Fenêtre de validation puis conversion/forçage (§8) ; sauvegardes anciennes en clair. | Oui (D1) |
| SEC-02 connexion sans limite | Haute | **Corrigé** | 8 échecs par compte et adresse, **30 par identifiant toutes adresses confondues (nouveau)**, 100 par adresse ; temps de réponse identique pour compte inconnu, inactif ou sans accès (test) ; activation par lien avec limite plus large. Blocage réel testé (429 + `Retry-After`). | Mémoire d'un seul processus : remise à zéro à chaque redémarrage, non partagée entre instances. Un attaquant peut verrouiller un compte précis 15 min (compromis assumé). | Non |
| SEC-03 secret JWT par défaut | Haute | **Corrigé** | Le serveur refuse de démarrer en production sans secret de 24 caractères ou avec la valeur de développement (vérifié à la main, par test unitaire de configuration et en démarrage réel en mode production). | Exécuter `check-config.js` sur le serveur réel. | Non |
| DATA-01 réinitialisation et restauration JSON | Haute | **Corrigé (restauration : défaut trouvé en phase 4)** | **Phase 4 : `POST /api/data/restore` contournait toutes les protections (aucune confirmation, active en production, détruisait factures, règlements, SWIFT… absents de la sauvegarde JSON).** Maintenant : refusée en production sans `ALLOW_DATA_RESET=true`, confirmation « RESTAURER » exigée, refus (409) si des données hors sauvegarde existent sauf confirmation définitive, anciens mots de passe de la sauvegarde convertis en empreinte ; 3 tests unitaires + 5 d'intégration. Réinitialisation : confirmation exigée, **désactivée en production sans `ALLOW_DATA_RESET=true`** (testé en conditions réelles), textes d'écran alignés. | Sauvegarde automatique avant l'opération (non faite). | Non |
| SEC-04 dépendances | Haute | **En partie** | Production : 17 → 13, critique 1 → 0 (§9). | Voir §9 (`xlsx` sans correctif npm, build Tailwind, react-router 7). | Oui (D7) |
| QA-01 CI sans tests | Haute | **Corrigé (non observé sur GitHub)** | Jobs `tests` + `integration` requis ; **la publication est impossible depuis une pull request ou une autre branche** (contournement par lancement manuel supprimé) ; 5 tests statiques du fichier ; YAML validé. | Observer une première exécution (pull request) ; protection de branche ; épinglage des actions par empreinte. | Non |
| SEC-05 extraction IA ouverte | Moyenne | **Corrigé** | 403 pour un compte société avec ou sans société, **vérifié sur le vrai serveur** (extract et extract-pages). | — | Non |
| SEC-06 journal effaçable | Moyenne | **En partie** | Route et bouton supprimés ; déclencheur PostgreSQL : **UPDATE et DELETE refusés, vérifiés sur la vraie base** ; l'API répond 404 à `DELETE /api/journal`. | Un administrateur de base peut retirer le déclencheur : pas d'infalsifiabilité (stockage externe nécessaire) ; écriture du journal « au mieux » hors transaction. | Oui (politique de conservation) |
| SEC-07 identifiants société exposés | Moyenne | **Corrigé (exposition) ; colonnes à traiter** | **Vérifié sur la vraie base** : une valeur placée en base n'apparaît dans aucune réponse. | Neutraliser puis supprimer les colonnes (`docs/plan-nettoyage-donnees-heritees.md` §B). | Oui (D2) |
| SEC-08 en-têtes, CSP, jeton | Moyenne | **En partie** | En-têtes posés par Express (vérifiés sur le vrai serveur : pas de `X-Powered-By`, `nosniff`, CSP en rapport seul, HSTS seulement en HTTPS). Production actuelle (version du 13/10) : aucun de ces en-têtes. | CSP en blocage (§11) ; jeton en `localStorage` (§11). | Non |
| SEC-09 fichiers en base64 | Moyenne | **Ouvert (analysé)** | §9. | Plan de sortie des fichiers de la base. | Oui (D5) |
| SEC-10 classeurs clients dans git | Moyenne | **En partie** | 19 fichiers retirés de l'index, `.gitignore` et `.dockerignore` mis à jour ; historique analysé (§8) : aucun autre fichier sensible, aucun secret réel trouvé. | Purge de l'historique **non faite** (plan prêt). | Oui (D3) |
| SEC-11 mot de passe admin par défaut | Faible | **Corrigé** | Refus en production à l'initialisation ; signalé par `check-config.js`. | — | Non |
| FIN-01 sur-règlement concurrent | Moyenne | **Corrigé, défaut confirmé** | **Test réel sur PostgreSQL** : huit règlements simultanés de 300 sur une facture de 1000. Avec le verrou : 3 acceptés, total 900. **Sans le verrou (expérience) : total 2400, soit 2,4 fois la facture.** | Idempotence des requêtes dupliquées (un double clic crée deux règlements) non traitée. | Non |
| FIN-02 suppression en cascade | Moyenne | **En partie** | Refus (409) d'une société portant des écritures à conserver ; même avec confirmation, une société qui porte une facture ne peut pas être supprimée (clé étrangère protectrice, **défaut trouvé en phase 3 : l'API répondait 500, elle répond maintenant 409**) ; société sans écriture supprimée normalement (réel). | Archivage dédié (suppression logique, écran) non fait ; le statut « Inactif » existe. | Oui |
| FIN-03 TVA et avoirs | Moyenne | **Défaut mathématique corrigé ; avoirs bloqués** | Arrondi exact (2 000 000 de demi-millimes : 0 erreur) ; règle unique serveur et écran ; 9 cas documentés. | Avoirs et règle d'arrondi de TVA : politique comptable à faire valider (§9). | Oui (D4) |
| FIN-04 précision monétaire | Faible | **Ouvert (analysé)** | §9 : 83 colonnes `numeric` sans précision ; 0 ligne à plus de 3 décimales sur la base de développement. | Migration contrôlée après réconciliation sur la production. | Oui (D6) |
| QA-02 tests d'intégration | Moyenne | **Corrigé en grande partie** | **21 tests contre un PostgreSQL 16 réel et le vrai serveur** : migration, activation, concurrence, isolation, journal, réinitialisation, suppression, redémarrage, proxy. Intégrés à la CI (service PostgreSQL jetable). | Navigateur (bout en bout), charge, couverture : non faits. | Non |
| PERF-01 filtrage en mémoire | Faible | **En partie** | 6 endpoints filtrent maintenant en SQL (`societes`, `noeuds`, `collectes`, `bootstrap`, `etat-swift/resume`) avec test d'isolation réel (§9). | Pagination ; autres routes (`taches`, `conversations`…). | Non |
| xlsx (dépendance) | Haute | **Ouvert, bloqué** | Aucun correctif sur npm (§9, sources). | Version officielle SheetJS après essai complet, ou remplacement. | Oui (D7) |
| CSP / stockage du jeton | Moyenne | **Analysé, plan prêt** | §11. | Mise en œuvre progressive. | Non |

## 4. Migration des mots de passe : revue et défauts trouvés

Relecture complète de `passwords.js`, `routes/auth.js`, `routes/employes.js`, `mailer.js`, `routes/data.js`. Vérifié **sur le vrai serveur et la vraie base** (tests d'intégration) :

| Exigence | Résultat |
| --- | --- |
| Compte hérité : connexion puis conversion, ensuite utilisable | PASSED |
| Huit premières connexions simultanées d'un compte hérité | PASSED (une seule empreinte cohérente, valeur en clair effacée) |
| Échec d'authentification ne modifie pas le compte | PASSED |
| Lien : expiré, réutilisé, inconnu, ancien lien après un nouveau | PASSED (400) |
| Dix activations simultanées du même lien | PASSED (une seule réussit, une seule empreinte) |
| Jeton stocké en empreinte seulement, jamais dans une réponse de liste | PASSED |
| Mot de passe ou empreinte absents des réponses, des journaux d'activité et des emails | PASSED pour les réponses ; emails : le gabarit ne contient que l'identifiant et le lien (relu) ; journaux du serveur : relu, aucune valeur sensible (seule la première ligne de la requête SQL est journalisée, sans paramètres) |
| Fonctionnement sans SMTP | PASSED (compte créé, lien renvoyé, état « SMTP non configuré ») |
| Comparaison et paramètres | scrypt N=2^16, r=8, p=2 ; empreinte aux paramètres plus faibles reconnue et relevée à la connexion ; comparaison à temps constant ; travail factice pour un compte inconnu |

**Défauts trouvés par cette revue et corrigés dans ce commit :**
1. *Écrasement possible d'un mot de passe tout juste défini* : la conversion d'un compte hérité (et le relèvement des paramètres) faisaient un `UPDATE` sans condition ; une connexion avec l'ancien mot de passe terminée juste après une activation aurait pu remplacer le nouveau mot de passe par l'ancien. Les deux mises à jour sont maintenant conditionnelles (`mdp_hash is null and mot_de_passe = <valeur lue>`, `mdp_hash = <empreinte lue>`).
2. *Lien consommé même si l'enregistrement échoue* : l'activation consomme le lien et écrit le mot de passe dans **une transaction**.
3. *Force brute répartie* : compteur global par identifiant ajouté.

Limites réelles : une panne entre la création d'un compte et l'émission du lien laisse un compte sans accès (un nouveau lien le règle) ; les sauvegardes antérieures contiennent des mots de passe en clair.

## 5. Retour arrière : preuve expérimentale

Ancienne version (commit `577fd81`) démarrée sur une base déjà migrée par la nouvelle, sur base jetable : l'ancienne version **démarre**, l'administrateur et les comptes hérités **non convertis** se connectent, la création d'un compte avec mot de passe fonctionne, **les comptes déjà convertis et ceux créés après la mise en ligne ne peuvent plus se connecter**, et l'ancienne version ne détruit aucune empreinte (retour à la nouvelle version : tout refonctionne). Conséquence : **correction en avançant** plutôt que retour arrière, et **fenêtre de validation** (`MIGRATE_LEGACY_PASSWORDS=false`, nouveau réglage testé en réel) pendant laquelle aucun compte hérité n'est converti, donc le retour arrière ne touche que les comptes créés pendant cette fenêtre. Détail dans `RELEASE_CHECKLIST.md` §6. Si une procédure de récupération testée n'existe pas, **la mise en ligne reste bloquée** (porte de sortie du §6.6 de la liste de contrôle).

## 6. Sauvegarde et restauration

`docs/sauvegarde-restauration.md` : inventaire réel (tout est dans PostgreSQL, **les documents sont dans la base**, secrets dans `/opt/camconsult/.env`, aucune clé de chiffrement des données, schéma rejoué au démarrage), commandes de sauvegarde chiffrée, restauration dans un conteneur jetable, requêtes de vérification, démarrage de l'application sur la base restaurée, procédure de mise en ligne avec Watchtower en pause. **Restauration réelle (`pg_dump -Fc` puis `pg_restore`) : BLOCKED** — les outils clients PostgreSQL ne sont pas installés sur le poste et aucune action Docker n'a été lancée ; aucune sauvegarde de production n'a été créée, copiée ni restaurée. Ressources requises : un hôte jetable avec `pg_dump`/`pg_restore` 16, une sauvegarde chiffrée **de test** (jamais de production sans décision du propriétaire), et la procédure de `docs/sauvegarde-restauration.md` suivie de `docs/verification-restauration.sql`. **Restauration LOGIQUE : PASSED (nouveau, §13)** — ce n'est pas un test des outils.

## 7. Tests (résultats réels du 15 octobre)

| Contrôle | Résultat |
| --- | --- |
| Types (`tsc`) | **PASSED** |
| Suite complète sans base | **PASSED** : 1031 tests réussis, 0 échec, 21 ignorés (ce sont les tests d'intégration, avec avertissement explicite) |
| Tests d'intégration PostgreSQL 16 réel (`TEST_DATABASE_URL`) | **PASSED** : 21 sur 21 (base jetable créée puis supprimée par le test, hors de la base de développement) |
| Construction de production | **PASSED** |
| Validation du YAML de la CI et du compose | **PASSED** (analyse syntaxique ; aucune exécution) |
| Expérience de retour arrière (ancienne version sur base migrée) | **PASSED** (11 constats, §5) |
| Contrôle de configuration avec valeurs synthétiques | **PASSED** (8 tests) ; exécution locale `--no-db` : signale correctement les défauts de développement |
| Validation SQL dans une transaction annulée (phase précédente) | **PASSED** (10 contrôles) |
| Audit des dépendances | **EXECUTED** : 13 vulnérabilités de production restantes |
| En-têtes du site public actuel (requête HEAD) | **EXECUTED** : version du 13/10 sans en-têtes de sécurité, `X-Powered-By: Express` |
| Mutation de contrôle : suppression du verrou des règlements | **PASSED** (le test échoue sans le verrou : 2400 pour 1000, puis la correction est rétablie) |
| Restauration réelle `pg_dump`/`pg_restore` | **BLOCKED** (outils clients absents, aucune base isolée équipée) |
| Restauration logique sur deux bases jetables (phase 4) | **PASSED** (3 tests, §13) |
| Phase 4 — tsc, 130 fichiers / 1086 tests (intégration inclus, base jetable locale), build | **PASSED** (nouveaux résultats ; ceux du tableau ci-dessus sont ceux de la phase 3) |
| Contrôle de configuration sur le serveur de production | **NOT EXECUTED** |
| Exécution du pipeline sur GitHub Actions | **NOT EXECUTED** (un push déclencherait la CI, et sur `main` un déploiement) |
| Envoi réel d'un email de lien d'accès | **NOT EXECUTED** (aucun SMTP : les serveurs de test sont lancés avec les variables d'email vidées explicitement) |
| Tests de bout en bout dans le navigateur, charge, couverture | **NOT EXECUTED** (aucun outil installé ; aucun pourcentage de couverture n'est donné) |
| Observation de la CSP en conditions réelles | **NOT EXECUTED** (pas de navigateur piloté) |

Note : les tests d'intégration ont utilisé le serveur PostgreSQL de **développement** local (création et suppression d'une base jetable au nom aléatoire, sans toucher aux bases existantes). Ce n'est pas de la production.

## 8. Nettoyage des données héritées (décisions)

Détail et commandes dans `docs/plan-nettoyage-donnees-heritees.md`.
- **A. Mots de passe** : recommandation **changement forcé pour tous**, après une fenêtre de validation, sans blocage (le compte se connecte avec son mot de passe actuel puis en choisit un nouveau).
- **B. Identifiants de société** : plus aucun chemin du code ne les lit ni ne les écrit ; 1 société sur 3 en porte sur la base de développement, donc la production peut contenir de vrais accès : mesurer, transférer vers un gestionnaire de mots de passe si besoin, neutraliser, puis supprimer les colonnes dans une version ultérieure. Aucune colonne supprimée dans cette phase.
- **C. Historique git** : 19 classeurs `Balance_*` (balances d'un client) dans 2 commits ; aucun autre fichier sensible, aucun secret réel trouvé (seuls des exemples factices dans les `.env.example`) ; visibilité du dépôt GitHub non vérifiable ; plan de purge prêt (coordination avec les contributeurs, nettoyage du cache de la CI, demande à GitHub) mais **non exécuté**.

## 9. Intégrité financière, fichiers, performance, dépendances

**FIN-04 — précision monétaire.** 83 colonnes `numeric` sans précision ni échelle. Sur la base de développement (presque vide, donc peu représentative), aucune ligne n'a plus de 3 décimales. Le calcul en JavaScript utilise des nombres flottants : l'arrondi est exact depuis la correction (`shared/arrondi.js`), et les sommes de quelques centaines de lignes restent à 1e-9 près, très en dessous du millime ; PostgreSQL somme en exact. Écarts possibles à surveiller : totaux calculés en SQL (états fournisseurs) comparés à ceux calculés en JavaScript, avec une tolérance de 0,0015 dans certains contrôles. Recommandation : **ne pas ajouter de bibliothèque décimale maintenant** ; réconcilier sur la production (le script `server/scripts/audit-donnees.js`, en lecture seule, compte les lignes à plus de 3 décimales par colonne sans afficher aucune valeur), puis migrer les colonnes de montants en TND vers `numeric(18,3)` (taux de change vers `numeric(18,6)`) par une migration réversible après sauvegarde testée. Aucune conversion en bloc n'a été faite.

**FIN-03 — exemples pour validation par un professionnel local** (règle de calcul actuelle, pas une règle fiscale) :
| Cas | Lignes | TVA | Timbre | HT | TVA | Net |
| --- | --- | --- | --- | --- | --- | --- |
| simple | 1 × 100,000 | 19 % | 1,000 | 100,000 | 19,000 | 120,000 |
| demi-millime de TVA | 3 × 100,005 + 2 × 49,995 | 19 % | 1,000 | 400,005 | 76,001 | 477,006 |
| HT en « 50 » | 1 × 100,050 | 19 % | 1,000 | 100,050 | 19,010 | 120,060 |
| TVA sur le total, pas par ligne | 2 × 0,005 | 19 % | 0 | 0,010 | 0,002 | 0,012 |
Questions de politique à trancher : arrondi de TVA par ligne ou sur le total, factures de montants négatifs (avoirs), corrections partielles, mentions et taux applicables.

**SEC-09 — fichiers en base.** Où : `noeuds.data_url`, `collecte_fichiers.data_url`, `honoraires_lignes.piece_data_url`, `swift_factures.piece_data_url`, `messages.piece_jointe` (jsonb), pièces dans `collecte_lignes.data`. Limites : 2 Mo conservés côté écran, 15 Mo côté nginx, 24 Mo côté Express. Accès : par route, avec contrôle de société ; contenu chargé à la demande pour les listes principales. Coût : chaque sauvegarde, restauration et réplication embarque les documents ; pas de contrôle du type réel. Mesure sur la base de développement : 3,0 Mo dans `noeuds` pour 2 fichiers, base de 13 Mo (non représentatif de la production). Recommandation : stockage de fichiers dédié (volume ou objet) avec le contenu adressé par empreinte et les métadonnées en base, migration en double lecture, **à planifier avec un environnement de test dédié** ; non réalisé.

**PERF-01.** Corrigé pour 6 requêtes (SQL filtré par la portée de la session, `porteeSocietes`, avec la barrière par ligne conservée) et couvert par un test d'isolation réel : un collaborateur affecté à une société ne voit aucune donnée de l'autre sur `societes`, `noeuds`, `collectes`, `bootstrap`, `etat-swift/resume`, et reçoit 403 sur l'accès direct. Index existants suffisants pour ces filtres (`noeuds_societe_idx`, `collectes_societe_idx`, `swift_virements_societe`). Reste : `taches`, `conversations`, pagination.

**Dépendances de production : 13 vulnérabilités, 0 critique** (17 avant).
| Paquet | Gravité | Usage | Décision |
| --- | --- | --- | --- |
| `express`, `body-parser`, `qs`, `proxy-addr` | modérée, critique | serveur | **Corrigé** (mise à jour dans les limites de version, tests relancés) |
| `tailwindcss`, `braces`, `micromatch`, `chokidar`, `fast-glob`, `source-map-js`, `postcss-nested`, `postcss-selector-parser` | 7 hautes, 2 moyennes | outils de construction du CSS, absents de l'image d'exécution | Risque accepté à court terme ; correction = Tailwind 4 (majeur) |
| `react-router(-dom)` 6.30.6 | moyenne | navigateur, redirection ouverte via `Link`/`useNavigate` | Pas de navigation vers une adresse saisie par l'utilisateur dans le code ; correction = v7 (majeur) |
| `exceljs`, `uuid` | moyenne | export Excel côté navigateur | La « correction » proposée par npm est un retour à `exceljs@3.4.0` : refusée |
| `xlsx` | haute | lecture et écriture de classeurs dans le navigateur | **Non résolu.** La copie npm n'est plus maintenue : [la base d'avis GitLab](https://advisories.gitlab.com/npm/xlsx/CVE-2024-22363/) indique qu'aucune version corrigée n'existe sur npm et que la 0.20.2 est distribuée par `cdn.sheetjs.com` ; [SheetJS le confirme](https://github.com/SheetJS/sheetjs/issues/2822) (le paquet npm ne recevra plus de mises à jour). La 0.20.2 corrige la ReDoS (GHSA-5pgg-2g8v-p4x9) ; je n'ai **pas pu confirmer auprès d'une source officielle** quelle version corrige la pollution de prototype (GHSA-4r6h-8v6p-xvw6). Mitigation actuelle : fichiers choisis par l'utilisateur sur son propre poste. Action : installer la version officielle la plus récente depuis `cdn.sheetjs.com` avec somme de contrôle fixée, relancer tous les tests d'import et d'export, ou remplacer la lecture par `exceljs`. Aucune dépendance n'a été remplacée sans essai. |

## 10. Proxy, nginx et CI (résumé ; détail dans `RELEASE_CHECKLIST.md` §4 et §5)

nginx (hôte) → `127.0.0.1:5181` → conteneur : `X-Forwarded-Proto $scheme` et `X-Forwarded-For $proxy_add_x_forwarded_for` présents ; Express fait confiance à **un** saut (`trust proxy 1`) et lit l'adresse la plus à droite, celle qu'ajoute nginx ; une usurpation à gauche du `X-Forwarded-For` est inefficace (test réel) tant que le port 5181 n'est joignable que par nginx (c'est le cas dans le compose du dépôt). Les en-têtes de sécurité sont posés uniquement par Express (aucun doublon avec nginx) ; la version actuellement en ligne n'en envoie aucun. La CI : jobs `tests` et `integration` avant `docker` ; publication limitée à `main` et jamais pour une pull request ; aucun secret dans les contrôles. Aucune modification de la configuration nginx réelle.

## 11. CSP et stockage du jeton

**CSP (rapport seul, non bloquante).** Analyse du paquet de production : une page `index.html` avec un seul script de même origine, aucun script ni style en ligne ; polices Google (feuille `fonts.googleapis.com` + `fonts.gstatic.com`) ; `style-src 'unsafe-inline'` nécessaire (composants Radix) ; images en `data:`/`blob:` ; aperçus PDF dans des `iframe` en `data:`/`blob:` ; travailleurs PDF de même origine ; connexions de même origine uniquement. **Points à valider avant de passer en blocage** : `new Function(` présent une fois dans le paquet de `pdf.js` et une fois dans celui d'`exceljs` (ils échouent proprement sans `unsafe-eval` s'ils sont protégés par un essai, à confirmer au navigateur) ; toute violation apparaît dans la console grâce au mode « rapport seul ». Étapes : observer une semaine d'usage réel, corriger, puis `Content-Security-Policy` bloquante.

**Jeton dans le navigateur.** Stocké dans `localStorage` (clé `cabinet-token`), 12 h, sans rafraîchissement ni révocation côté serveur ; un script injecté pourrait le lire (aucun `innerHTML` côté application). Plan proportionné : (1) CSP bloquante ; (2) durée plus courte avec renouvellement ; (3) à terme, cookie `HttpOnly; Secure; SameSite=Strict` avec contrôle d'origine/jeton anti-CSRF pour les requêtes qui modifient des données et adaptation du flux temps réel (`/api/events`, qui s'authentifie aujourd'hui par en-tête `Authorization`). Ce changement touche le client, le serveur et le temps réel : non fait dans cette phase.

## 12. Conditions restantes avant une revue de mise en ligne

1. Restaurer une vraie sauvegarde (`pg_dump`/`pg_restore`) de test dans un environnement isolé, noter la durée et exécuter `docs/verification-restauration.sql` (**BLOCKED** localement).
2. Exécuter `check-config.js` sur le serveur réel : aucun `[ECHEC]`.
3. Observer le pipeline sur une pull request ; activer la protection de branche.
4. Décisions D1 à D3 (mots de passe hérités, colonnes de sociétés, historique git) ; D4 à D7 consignées.
5. nginx : bloc HTTPS avec `X-Forwarded-Proto`, port 5181 non exposé, `server_tokens off`.
6. Mettre en ligne avec Watchtower en pause et `MIGRATE_LEGACY_PASSWORDS=false`, valider, puis lever le réglage.

## 13. Phase 4 — préparation de la revue finale (15 octobre 2026)

**Garde-fou de production.** Aucune connexion, requête, migration, restauration ni écriture sur la base de production ; aucun script lancé sans cible identifiée. Divulgation : les phases 2 à 4 ont utilisé le PostgreSQL de **développement** local (`localhost:5439`, identifiants triviaux du `.env` local, jamais ceux de la production) pour des transactions annulées, des bases jetables créées puis supprimées et des comptages en lecture seule. `TEST_DATABASE_URL` n'accepte plus qu'un serveur local (« n'est pas local » sinon).

**État du dépôt.** `main` = `origin/main` + 3 commits locaux intacts (`8db7ba2`, `414d59c`, `8c21d6a`) + le commit de la phase 4. Rien n'est poussé, fusionné, publié ni déployé. `.vscode/` (non suivi) est laissé hors commit.

**Défauts trouvés et corrigés (avec tests de non-régression ; rien de poussé).**
| # | Défaut | Correction | Preuve |
| --- | --- | --- | --- |
| P4-1 | `/api/data/restore` : sans confirmation, active en production, détruisait des tables absentes de la sauvegarde JSON, rangeait les anciens mots de passe en clair | voir DATA-01 | `exposition.sec.test.js` (15) + intégration |
| P4-2 | `check-config.js` se connectait à la base par défaut sans afficher la cible | variables seules par défaut, `--db` explicite, cible affichée (sans identifiants), aucun repli | `configuration.test.js`, intégration |
| P4-3 | `migrate-passwords.js --apply` écrivait sans que la cible soit retapée | `--confirmer-cible=<hôte:port/base>` exigé (code 2 sinon) ; simulation par défaut | intégration |
| P4-4 | `audit-donnees.js` sans cible affichée | cible affichée avant le chargement de la base ; comptages seulement | intégration (aucune valeur dans la sortie) |
| P4-5 | `seed.js` stockait les comptes de démonstration en clair | empreintes (développement seulement, refuse la production) | relu |
| P4-6 | workflow du site vitrine (même Watchtower) publiait depuis toute branche | `if: github.ref == 'refs/heads/main'`, `permissions: contents: read` | `pipeline.test.js` |
| P4-7 | nginx : version affichée, `X-Powered-By` transmis | `server_tokens off;`, `proxy_hide_header X-Powered-By;` dans le fichier du dépôt (**nginx réel non modifié**) | test statique |
| P4-8 | assistant de test : arrêt non idempotent (blocage de 120 s) | `signalCode` vérifié | tests d'intégration |

**Revue des trois commits.** Contournements recherchés : restauration (P4-1), scripts d'exploitation (P4-2 à P4-4), second chemin de publication (P4-6), exposition d'identifiants (réponses, sauvegarde exportée : aucun mot de passe ni empreinte, testé), réinitialisation (confirmation serveur + `ALLOW_DATA_RESET`). Aucun autre contournement trouvé ; les limites du §3 demeurent.

**Configuration (valeurs synthétiques uniquement).** 12 tests : secrets faibles refusés, aucune valeur secrète dans la sortie, le serveur refuse de démarrer avant tout accès à la base. Procédure opérateur : `RELEASE_CHECKLIST.md` §3 (**non exécutée**).

**Restauration logique (PASSED).** Deux bases jetables locales, données synthétiques (sociétés, compte activé, facture à 3 lignes, stock et règlement, virement SWIFT, fichier de 0,4 Mo, collecte) : sauvegarde table par table en JSON, restauration dans l'ordre des clés étrangères, empreintes MD5 identiques (66 lignes), les 10 requêtes de `docs/verification-restauration.sql` donnent les résultats attendus, le serveur démarre en production sur la base restaurée, connexion de l'administrateur et du compte restauré, fichier relu octet pour octet, total de facture inchangé. Durées (66 lignes, 0,4 Mo) : sauvegarde ≈ 0,14 s, restauration ≈ 0,17 s, **non extrapolables à la production**. **Ce n'est pas un test de `pg_dump`/`pg_restore`** ni de sauvegardes chiffrées.

**CI (validation locale).** YAML des deux workflows, dépendances (`docker` après `tests` et `integration`), conditions de publication et permissions testés statiquement (23 tests). Exécution sur GitHub : **NOT EXECUTED**. Étapes du propriétaire : `RELEASE_CHECKLIST.md` §5.

**nginx.** Changement minimal préparé (aucun en-tête de sécurité ajouté par nginx : pas de doublon). `nginx -t` : **BLOCKED** (nginx absent, Docker non lancé). Pour l'opérateur, sur l'hôte : `sudo nginx -t` avant rechargement. Vérification HTTPS : `RELEASE_CHECKLIST.md` §4.

**Recommandations (rien n'est exécuté).**
- **A. Mot de passe forcé** : par étapes — fenêtre de validation (`MIGRATE_LEGACY_PASSWORDS=false`), conversion (`--apply --confirmer-cible`), forçage par lots (administrateurs en dernier), récupération testée (lien de réinitialisation émis par un administrateur ; compte administrateur de secours hors du lot).
- **B. Colonnes `societes.identifiant`/`mot_de_passe`** : aucune lecture de valeurs ; comptage, transfert vers un gestionnaire de mots de passe, neutralisation, puis suppression dans une version ultérieure après sauvegarde testée.
- **C. 19 classeurs dans l'historique** : tableau de décision dans `docs/plan-nettoyage-donnees-heritees.md` (visibilité du dépôt non vérifiée).
- **D. Dépendances** : 13 vulnérabilités de production (7 hautes, 6 moyennes), 0 critique (`npm audit` du 15 octobre). **Vérifié par recherche** ([GitLab CVE-2023-30533](https://advisories.gitlab.com/npm/xlsx/CVE-2023-30533/), [CVE-2024-22363](https://advisories.gitlab.com/npm/xlsx/CVE-2024-22363/)) : pollution de prototype corrigée en 0.19.3, ReDoS en 0.20.2, versions distribuées par `cdn.sheetjs.com` et non par npm. **Non vérifié** : une copie tierce évoque un correctif 0.20.4, à confirmer dans le journal officiel. Le paquet npm `xlsx` n'est plus maintenu.
- **E.** SEC-09 ouvert (planifié) ; FIN-03 arrondi corrigé, politique d'avoirs/TVA à faire valider par un professionnel local (aucune règle fiscale inventée) ; FIN-04 ouvert (migration après réconciliation) ; PERF-01 : 6 endpoints corrigés ; CSP en rapport seul ; jeton en `localStorage` (§11).

**Décision de la phase 4 : CONDITIONNELLEMENT PRÊT POUR UNE REVUE DE MISE EN LIGNE** — ce n'est pas une autorisation de déployer. Bloquants : restauration réelle, `nginx -t`, contrôle de configuration sur le serveur réel, première exécution de la CI sur pull request, protection de `main`, décisions D1 à D3.

## 14. Phase 5 — pull request sûre, portes de publication, décisions (15 octobre 2026)

**Garde-fou.** Aucune connexion à la production. Rien n'est poussé, fusionné, publié ni déployé ; aucune histoire réécrite ; aucun workflow lancé. Les tests n'ont utilisé que le PostgreSQL de développement local, par bases jetables.

**État du dépôt (vérifié).** `main` = `origin/main` (`577fd81`) + 4 commits locaux : `8db7ba2`, `414d59c`, `8c21d6a`, `8865f4c`. Seul `.vscode/` est non suivi. Les modifications de cette phase (workflow, test, documents) sont **non commitées** (aucun commit demandé). Aucune étiquette, aucune autre branche.

### Sûreté d'un push de branche de travail (analyse des deux workflows)
| Déclencheur | `app-comptable.yml` | `camconsult-site.yml` |
| --- | --- | --- |
| `push` | uniquement `branches: [main]` (+ filtre de chemins) : **une branche de travail poussée seule ne lance rien** ; les étiquettes ne déclenchent rien | idem |
| `pull_request` | lance `tests` et `integration` ; `docker` ignoré (`github.event_name != 'pull_request' && github.ref == 'refs/heads/main'`) | aucun déclencheur |
| `workflow_dispatch` | possible ; `docker` ne publie que si la référence est `main`, et après `tests` + `integration` | publie seulement sur `main` (sans contrôles préalables : risque noté, hors périmètre applicatif) |
| `workflow_call`, `workflow_run`, `pull_request_target`, `release`, `schedule` | absents (test statique) | absents |

Les secrets (`DOCKERHUB_*`) ne sont référencés que dans le job `docker`. Les contrôles n'en utilisent aucun ; la base de test est un conteneur de service au mot de passe jetable ; `permissions: contents: read`. **Conclusion : pousser une branche de travail puis ouvrir une pull request ne peut pas publier d'image ni déclencher Watchtower** (Watchtower surveille `latest`, écrite uniquement par `docker` sur `main`). Réserves : quiconque peut pousser sur `main` ou lancer le workflow sur `main` publie (d'où la protection de branche) ; une pull request peut modifier le workflow lui-même, mais sans accès aux secrets.

**Défaut trouvé et corrigé localement (P5-1).** `pull_request` avait un filtre de chemins : une pull request ne touchant que la documentation n'aurait pas lancé `tests`/`integration`, et des contrôles requis restent « en attente » indéfiniment, ce qui bloque la fusion. Filtre retiré pour `pull_request` (les `push` sur `main` gardent le leur). Test statique ajouté. Non commité.

**Contrôles à exiger sur `main`** : `tests` et `integration` (identifiants de jobs de `app-comptable.yml`) ; confirmer l'affichage exact après la première exécution. Ne **pas** exiger `docker` (ignoré sur les pull requests).

### Quatre portes distinctes
1. **Validation locale** : types, tests, construction, intégration sur base jetable (faite).
2. **CI de pull request** : `tests` + `integration` observés au vert sur GitHub (**NOT EXECUTED**).
3. **Approbation de mise en ligne** : revue du propriétaire, D1 à D3 décidées, `check-config` exécuté sur le serveur, restauration native réussie (**non remplie**).
4. **Autorisation de déploiement** : décision séparée et datée, fenêtre prévue, Watchtower en pause, `MIGRATE_LEGACY_PASSWORDS=false`. Fusionner sur `main` équivaut à déployer sous 60 s.

### D1 — changement de mot de passe forcé : recommandation
Constats : la conversion supprime le clair de la base, mais les mots de passe ont existé en clair (base, anciennes sauvegardes). Un compte jamais reconnecté est converti par le script ou à sa première connexion. Les comptes activés par lien ont choisi un secret neuf, sans exposition antérieure. L'ancienne version ne peut pas authentifier un compte converti (§5). Le mécanisme existe : `doit_changer_mdp` (exposé à l'écran) et `--forcer-changement`.

Politique par étapes : (1) mise en ligne avec `MIGRATE_LEGACY_PASSWORDS=false`, validation 1 à 3 jours ; (2) conversion + forçage des **comptes hérités** seulement ; (3) comptes activés par lien après la mise en ligne : pas forcés ; (4) administrateurs : changement immédiat, administrateur de secours conservé hors lot ; (5) lots de quelques comptes, pas de réinitialisation de masse par jetons (SMTP non confirmé, liens valables 24 h/72 h) ; (6) récupération : un administrateur émet un lien de réinitialisation à usage unique, aucun mot de passe n'est jamais affiché ni envoyé. **Décision requise (D1)** : oui/non, calendrier, responsable du support. Rien n'a été exécuté.

### D2 — colonnes `societes.identifiant` et `societes.mot_de_passe`
Recherche sur le serveur et l'écran (valeurs jamais lues) : **aucune lecture ni écriture dans le code actuel** — `COLS` de `societes.js` les exclut, `data.js`, `seed.js` et `mappers.js` n'y touchent pas, l'API ne les expose pas (testé). Seule référence : `server/scripts/audit-donnees.js`, qui **compte** les lignes non vides. Aucune intégration externe connue : elles sont redondantes pour l'application.

Plan : (1) comptage sur la production par l'opérateur (`audit-donnees.js`, cible vérifiée) ; (2) si non nul, transférer les accès vers un gestionnaire de mots de passe et décider de la rotation avec chaque propriétaire de compte ; (3) sauvegarde testée ; (4) neutraliser les valeurs ; (5) période d'observation, puis suppression des colonnes dans une version ultérieure, essayée d'abord sur base jetable ; (6) traiter les anciennes sauvegardes comme sensibles. Aucune colonne supprimée, aucune donnée lue. **Décision requise (D2).**

### D3 — classeurs clients dans l'historique git
Faits établis (métadonnées seulement, contenu non lu) : 19 fichiers `app comptabole/samples/Balance_*.xlsx`, ajoutés par `af461c7`, **retirés de l'index par `414d59c` (commit local non poussé)**. Ils sont donc **encore atteignables depuis `origin/main`**, c'est-à-dire déjà sur GitHub. Aucune étiquette ni autre branche. `.dockerignore` exclut `samples/` (les images n'en contiennent pas). Copies dans des artefacts de CI ou paquets : non vérifiables ici. Dépôt `github.com/ayedihaytham/camconsult` : **visibilité INCONNUE** (aucune requête faite). Données réelles ou factices : inconnu.

| Situation | Évaluation | Action recommandée |
| --- | --- | --- |
| Données réelles, dépôt public | exposition publique avérée | incident : dépôt privé immédiatement, purge de l'historique, demande de purge des caches à GitHub, information des clients selon contrat et droit tunisien (avis juridique) |
| Données réelles, dépôt privé | accès par collaborateurs, intégrations, clones | revoir les accès, purge recommandée, consigner |
| Données anonymisées ou factices | risque faible | pas de purge, index propre conservé |
| Contenu inconnu | traiter comme réel | le propriétaire ouvre un fichier lui-même et tranche |

Une purge change les hachages des commits (aussi ceux de l'audit) : après la revue seulement, avec accord explicite. Rien réécrit ni poussé.

### D4 à D7
- **D4 TVA et avoirs.** L'arithmétique (arrondi au millime, TVA sur le total) est testée (cas du §9). Avoirs, arrondi par ligne ou global, taux et mentions sont des règles tunisiennes **non vérifiées ici** : à faire valider par un expert-comptable avant tout développement des avoirs ; aucune règle n'est inventée.
- **D5 fichiers en base64.** Voir §9 : croissance de la base et des sauvegardes, limites 15 Mo (nginx) et 24 Mo (Express), accès contrôlé par société. Migration (stockage objet ou volume, adressage par empreinte, double lecture, colonne conservée pour le retour arrière) à concevoir et tester sur base jetable ; rien migré. Après la mise en ligne.
- **D6 précision.** 83 colonnes `numeric` sans précision. Les nombres JavaScript (15 chiffres significatifs) suffisent pour des montants à 3 décimales. Conversions de devise, soldes fournisseurs et valorisation du stock sont à réconcilier sur la production avant `numeric(18,3)`. La migration peut modifier des valeurs ayant plus de 3 décimales : les mesurer d'abord (`audit-donnees.js`), arrondir explicitement et journaliser, jamais en silence. Rien modifié.
- **D7 `xlsx`.** Source officielle consultée ([documentation SheetJS](https://docs.sheetjs.com/docs/getting-started/installation/nodejs)) : dernière version **0.20.3**, installable depuis `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` ; la copie npm est périmée (0.18.5) ; le CDN est la source de référence ; **aucune somme de contrôle publiée** — copier l'archive dans le dépôt et enregistrer son empreinte après vérification. Le « 0.20.4 » d'une copie tierce n'est **pas** confirmé : écarté. Correctifs annoncés : pollution de prototype en 0.19.3, ReDoS en 0.20.2 ([GitLab](https://advisories.gitlab.com/npm/xlsx/CVE-2024-22363/)) ; que 0.20.3 les contienne est une **inférence non testée**. Non installée : exige un essai complet d'import/export de tous les écrans. Alternative : `exceljs` (déjà présent, vulnérabilité modérée via `uuid`). Atténuation actuelle : fichiers choisis par l'utilisateur sur son poste, aucun traitement serveur. Production : 13 vulnérabilités (7 hautes, 6 moyennes, 0 critique), inchangé.

### Restauration native, configuration, nginx
**BLOCKED** : client PostgreSQL et nginx absents, aucun conteneur lancé. Un conteneur `camconsult-db` existe sur ce poste (port non publié) : son rôle et ses données n'ont pas été établis et **il n'a pas été touché**. Procédure de l'opérateur : `docs/sauvegarde-restauration.md` (confirmer hôte, port, nom de la base jetable et origine non-production de la sauvegarde, noter la durée, exécuter `docs/verification-restauration.sql`). `check-config.js` : variables seules par défaut, `--db` explicite avec cible affichée ; non exécuté sur le serveur. nginx : aucune limitation de débit nginx, la limite est dans Express (identifiant, adresse) ; voir `RELEASE_CHECKLIST.md` §4.

### Tests de la phase 5 (nouveaux, exécutés)
`tsc` et `lint` PASSED ; 130 fichiers / **1087** tests PASSED (intégration sur bases jetables locales incluse) ; construction PASSED ; `git diff --check` PASSED ; `npm audit --omit=dev` : 13 vulnérabilités (inchangé). BLOCKED : exécution GitHub Actions, `pg_restore` réel, `nginx -t`. NOT EXECUTED : contrôle sur le serveur, en-têtes HTTPS publics.

**Décision : CONDITIONNELLEMENT PRÊT** (inchangée). Conditions pour la revue de mise en ligne : pull request observée au vert, protection de `main` activée et vérifiée, restauration native réussie, `check-config` sans `[ECHEC]` sur le serveur, D1 à D3 décidées.

## 15. Phase 6 — revalidation locale et procédure GitHub (15 octobre 2026)

**Garde-fou.** Aucune connexion à la production ; `camconsult-db` non lancé ni sollicité ; aucun `git add`, commit, push ni appel GitHub. Les tests de base de données ont visé `localhost:5439` (conteneur de développement `cabinet-comptable-db`, cible vérifiée avant l'exécution, bases jetables créées puis supprimées).

**État Git.** Branche `main`, tête `8865f4c`, 4 commits locaux intacts au-dessus de `origin/main` (`577fd81`). Modifié non commité : `.github/workflows/app-comptable.yml` (P5-1), `app comptabole/server/pipeline.test.js` (test de P5-1), `RELEASE_CHECKLIST.md`, `SECURITY_AND_PRODUCTION_READINESS_AUDIT.md`. Non suivi : `.vscode/` (étranger à l'audit, à ne pas ajouter).

**Contrôles exécutés (nouveaux).** `npx tsc --noEmit -p .` : PASSED ; `npm run lint` : PASSED ; `vitest run server/pipeline.test.js` : PASSED (24 tests) ; `vitest run` complet : PASSED (130 fichiers, 1087 tests) ; `npm run build` : PASSED ; `git diff --check` : PASSED.

**Noms des contrôles.** Les jobs `tests` et `integration` n'ont pas de champ `name` : le contrôle s'appelle exactement `tests` et `integration` (sans préfixe de workflow). Aucun autre job ne porte ces noms. Les deux workflows ont chacun un job `docker` : ne jamais le rendre requis (ambiguïté, et ignoré sur les pull requests). Les noms n'apparaîtront dans la liste des contrôles de GitHub qu'après une première exécution.

**Risque du workflow du site vitrine (inchangé, documenté).** `camconsult-site.yml` publie `latest` du site sur tout push touchant `camconsult/**` sur `main`, sans `tests` préalable ni protection autre que la branche. Watchtower le déploie. Il n'est pas déclenché par une pull request.

**Blocages conservés.** Restauration native `pg_dump`/`pg_restore` (BLOCKED) ; CI GitHub observée (NOT EXECUTED) ; protection de `main` (non activée) ; contrôle de configuration du serveur par un opérateur (NOT EXECUTED) ; en-têtes HTTPS publics (NOT EXECUTED) ; 13 vulnérabilités de production dont `xlsx` ; décisions D1 à D7. **Décision : CONDITIONNELLEMENT PRÊT**, pas prêt pour la production.

## 16. Phase 7 — inventaire des dépendances de production (15 octobre 2026)

**Garde-fou.** Aucune connexion à la production, aucun Docker, `camconsult-db` non sollicité, aucun `git add`/commit/push, aucune installation ni mise à jour de paquet. `package.json` et `package-lock.json` **non modifiés**. Seule cette section a été ajoutée. État Git inchangé : `main` en `8865f4c`, 4 commits intacts, mêmes modifications non commitées qu'en phase 6.

**Inventaire (`npm audit --omit=dev`, `npm ls --omit=dev --depth=0` du 15 octobre : 13 vulnérabilités, 7 hautes, 6 moyennes, 0 critique).** Atteignabilité établie par lecture du code, pas par exploitation.

| Paquet (installé) | Lien | Avis / gravité | Chemin utilisé ? | Entrée contrôlée par un utilisateur ? | Correctif proposé par npm | Classement |
| --- | --- | --- | --- | --- | --- | --- |
| `xlsx` 0.18.5 | direct | GHSA-4r6h-8v6p-xvw6 (pollution de prototype, corrigée en 0.19.3), GHSA-5pgg-2g8v-p4x9 (ReDoS, corrigée en 0.20.2) ; haute | **Oui** : lecture dans le navigateur (`XLSX.read`) dans 8 écrans d'import (balance, biens, honoraires, souche de chèques, suivi devise, conversions, classeurs) + génération d'exports ; **aucune utilisation côté serveur** | Fichier choisi par l'utilisateur sur son poste (`file.arrayBuffer()`), jamais un document stocké ; aucune limite de taille ni de type avant lecture ; pas de test de fichier malformé | aucun (`fixAvailable: false`) | **Risque réel avec chemin atteignable** (nécessite qu'un collaborateur importe un classeur piégé reçu d'un tiers : ingénierie sociale) ; impact : blocage de l'onglet (ReDoS) ou pollution d'objets de la page, donc, dans le pire cas, accès au jeton `localStorage` (confiance moyenne : non démontré) |
| `braces`, `micromatch`, `chokidar`, `fast-glob`, `source-map-js`, `postcss-nested`, `postcss-selector-parser` | transitifs de `tailwindcss` 3.4 | déni de service par motifs ou sélecteurs imbriqués ; 5 hautes, 2 moyennes | Outils de **construction** du CSS (Vite/Tailwind) : exécutés sur le poste de développement et la CI, sur le code du dépôt ; pas dans l'application servie | Non (entrées = fichiers du dépôt) | `tailwindcss` 4.3.3 (majeur) | Dépendance affectée **sans chemin atteignable en production** (confiance haute, vérifiée par l'architecture du build) |
| `tailwindcss` 3.4.x | direct | agrège les précédents | idem | idem | majeur 4 | idem |
| `react-router(-dom)` 6.30.6 | direct | GHSA-wrjc-x8rr-h8h6 (redirection ouverte via `Link`/`useNavigate` avec barre oblique inverse), GHSA-337j-9hxr-rhxg (`deserializeErrors`, rendu serveur) ; moyennes | `BrowserRouter` seul (pas de rendu serveur ni de `createStaticHandler`) ; `navigate()` appelé avec des chemins constants ou issus de l'application (recherche limitée, non exhaustive) | Pas de navigation vers une adresse saisie trouvée | 7.18.4 (majeur) | 1er avis : **à vérifier** (incertain) ; 2e avis : **non atteignable** (fonction de rendu serveur absente) |
| `exceljs` 4.4.0 / `uuid` 8.3.2 | direct / transitif | GHSA-w5hq-g745-h8pq (contrôle de bornes manquant quand un tampon est fourni à `v3/v5/v6`) ; moyenne | `exceljs` n'appelle que `uuidv4()` sans tampon (relu) | Non | « correctif » = retour à `exceljs` 3.4.0 : à refuser | Dépendance affectée **sans chemin atteignable** (confiance haute) |

**`xlsx` : provenance des correctifs.** La copie npm est figée en 0.18.5 (`npm view` : dernière version publiée = 0.18.5). La documentation officielle ([SheetJS](https://docs.sheetjs.com/docs/getting-started/installation/nodejs)) désigne le CDN comme source de référence, dernière version 0.20.3, installation par `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`, sans somme de contrôle publiée. Les deux avis sont décrits comme corrigés en 0.19.3 et 0.20.2 ([GitLab](https://advisories.gitlab.com/npm/xlsx/CVE-2024-22363/)) : **donc 0.20.3 devrait les contenir, mais je ne l'ai ni téléchargée, ni inspectée, ni testée** : non vérifié. Licence : Apache-2.0 (installée). Installation reproductible : non établie tant que l'archive n'est pas copiée dans le dépôt avec son empreinte SHA-512 enregistrée et le journal officiel relu.

**Ordre de remédiation recommandé (rien appliqué).**
1. **`xlsx` (seul risque atteignable)** — Option A (recommandée) : copier l'archive officielle 0.20.3 dans `vendor/`, enregistrer son empreinte lors d'une vérification indépendante (deux téléchargements depuis deux réseaux, comparaison avec le journal officiel), référencer `file:vendor/xlsx-0.20.3.tgz`, puis tester les 8 écrans d'import et tous les exports (les tests de classeurs existent : `etatFournisseursClasseur`, `banqueClasseur`, `pdfToTables`), ajouter des tests de fichiers malformés (classeur tronqué, très grand, motif ReDoS connu) ; la compatibilité 0.18.5 → 0.20.3 est annoncée mais non éprouvée ici. Option B : remplacer la lecture par `exceljs` (déjà présent) — plus de travail, comportement de lecture différent. Option C (atténuation sans changement de paquet, applicable tout de suite) : refuser avant lecture les fichiers de plus de quelques Mo et les extensions inattendues dans les 8 écrans d'import, et avertir de n'importer que des classeurs de source fiable. Les options A et C se combinent.
2. `react-router` 7 : à planifier avec des tests de navigation ; non urgent (chemin non démontré).
3. `tailwindcss` 4 : migration de construction, sans effet sur le code servi ; accepter par écrit en attendant.
4. `exceljs`/`uuid` : accepter (aucun chemin) ; ne pas appliquer le « correctif » de npm.
Ne pas lancer `npm audit fix` (propose des majeurs et un retour en arrière).

**Tests exécutés pendant cette phase.** `npm audit --omit=dev --json` et `npm ls` : EXECUTED (résultats ci-dessus). Aucun test applicatif relancé (aucune modification de code ou de dépendance ; les résultats de la phase 6 restent valides pour l'arbre inchangé : tsc, lint, 1087 tests, build PASSED, historiques).

**Une pull request de remédiation est-elle justifiée ?** Oui pour `xlsx` (option A + C), **mais pas avant** la décision du propriétaire sur l'origine de l'archive et la vérification de son empreinte ; pas pour les autres paquets. La pull request actuelle (phases 4 à 6) ne dépend pas de ce sujet.

**Décision : CONDITIONNELLEMENT PRÊT** (inchangée). Chaque vulnérabilité haute non résolue exige une décision écrite : `xlsx` (D7) ; les 6 autres hautes (outils de construction) sont à accepter par écrit ou à traiter par Tailwind 4. Blocages inchangés : restauration native, CI observée, protection de `main`, contrôle de configuration et en-têtes HTTPS par un opérateur, D1 à D7.

## 17. Phase 8 — contrôle commun des classeurs importés (15 octobre 2026)

**Garde-fou.** Aucune connexion à la production, aucun Docker, `camconsult-db` non sollicité, aucun `git add`/commit/push, aucune dépendance modifiée (`package.json` et `package-lock.json` inchangés ; `xlsx` 0.18.5 toujours installé, aucune archive SheetJS téléchargée ni installée). Les 4 commits sont intacts, `.vscode/` non touché.

**Écrans concernés (les huit lectures de classeur, toutes dans le navigateur ; aucune lecture côté serveur).**
1. États financiers — import de balance (`ImportBalanceDialog`) : xlsx, xls, csv.
2. États financiers — import de biens (`ImportBiensDialog`) : xlsx, xls, csv.
3. Honoraires (`HonoraireImportDialog`) : xlsx, xls, csv.
4. Souche de chèques (`SoucheChequeImportDialog`) : xlsx, xls, csv.
5. Suivi devise (`SuiviDeviseImportDialog`) : xlsx, xls, csv.
6. Conversions Excel → PDF (`ConversionsPage`) : xlsx, xls.
7. Relevés bancaires (`ImportReleveDialog`, branche Excel, via `lireClasseurExcel`) : xlsx, xls.
8. États fournisseurs (`ImportEtatFournisseursDialog`, via `lireClasseurExcel`) : xlsx, xls.
Les fichiers lus sont choisis sur le poste de l'utilisateur ; ils peuvent contenir des données comptables sensibles de clients. Les autres usages de `xlsx` (exports) n'en lisent aucun.

**Contrôle mis en place** (`src/lib/fichierImport.ts`, sans dépendance, appliqué avant toute lecture par `xlsx` ; point d'entrée unique `lireTamponClasseur`) :
- extension autorisée par écran (insensible à la casse) ;
- fichier non vide ;
- taille maximale **provisoire de 10 Mo** (`TAILLE_MAX_CLASSEUR_OCTETS`, modifiable, ou par appel) — valeur conservatrice **non fondée sur une mesure d'usage réel : à confirmer par le propriétaire** ;
- type MIME : refusé s'il est renseigné et étranger aux tableurs/CSV ; vide ou générique toléré (non fiable) ;
- contenu (signature, 4 Ko lus) : `.xlsx` doit être un zip ; `.xls` un fichier OLE, un export texte/XML/HTML ou de l'UTF-16 ; un binaire inconnu ou un zip nommé `.xls` est refusé ; `.csv` ne doit être ni zip, ni OLE, ni binaire (UTF-16 avec BOM accepté) ;
- message d'erreur en français, affiché à l'utilisateur ; l'entrée fichier est déjà réinitialisée par chaque écran avant le contrôle ; aucun contenu n'est journalisé.

**Tests ajoutés** : `src/lib/fichierImport.test.ts`, 25 tests, fichiers synthétiques uniquement : formats acceptés (dont MIME vide ou trompeur toléré quand le contenu est bon, UTF-16), extensions refusées ou absentes, extension non autorisée par l'écran, fichier vide, fichier au-dessus de la limite (cas de 10 Mo + 1 octet), MIME incompatible, extension trompeuse (xlsx/xls/csv), MIME correct mais contenu faux, **lecture complète jamais déclenchée pour un fichier refusé**, messages, et **vérification statique que les 8 écrans passent par le contrôle** et qu'aucun autre fichier n'appelle `XLSX.read`. **Limite : pas de test de rendu par écran** (couverture par le composant partagé et la vérification statique) ; l'ordre « contrôle puis analyse » dans chaque écran repose sur cette vérification.

**Résultats exécutés dans cette phase.** `npx tsc --noEmit -p .` PASSED ; `npx vitest run src/lib/fichierImport.test.ts` PASSED (25) ; `npx vitest run` complet PASSED (131 fichiers, 1112 tests, cible de base vérifiée locale `localhost:5439`) ; `npm run lint` PASSED ; `npm run build` PASSED ; `git diff --check` PASSED.

**Ce que ce contrôle ne corrige PAS.** Un classeur piégé, bien formé en apparence et de taille raisonnable, atteint toujours `XLSX.read` de la version 0.18.5 : **les avis GHSA-4r6h-8v6p-xvw6 (pollution de prototype) et GHSA-5pgg-2g8v-p4x9 (ReDoS) restent ouverts**. La limite de taille ne borne pas la durée d'un motif ReDoS. Aucun test de classeur malformé n'a été ajouté ni exécuté sur la bibliothèque. Aucun garde-fou de durée de lecture (travailleur séparé avec délai) n'existe : piste d'atténuation supplémentaire, non réalisée. Il n'y a pas de verrou contre deux lectures simultanées (chaque écran traite un fichier à la fois ; non traité).

**Décision toujours en attente (D7).** Vérifier et approuver (ou refuser) la distribution officielle `xlsx` 0.20.3 de `cdn.sheetjs.com` : provenance (documentation officielle consultée en phase 5), empreinte à relever de façon indépendante (aucune somme publiée), licence, essai des 8 écrans et des exports, archive copiée dans `vendor/`. Rien n'a été téléchargé ni installé.

**Statut : CONDITIONNELLEMENT PRÊT** (inchangé). Blocages inchangés : restauration native, CI observée sur une pull request, protection de `main`, contrôle de configuration serveur et en-têtes HTTPS par un opérateur, D1 à D7, vulnérabilités hautes non résolues.

## 18. Phase 9 — provenance de SheetJS et note de décision (15 octobre 2026)

**Garde-fou.** Aucune archive téléchargée, installée ni copiée ; aucune dépendance modifiée (`package.json` et `package-lock.json` inchangés) ; aucun code vendeur exécuté ; aucune connexion à la production ; aucun Docker ; aucun `git add`/commit/push. Les 4 commits et les modifications de la phase 8 sont intacts (fichiers modifiés vérifiés par `git status`). Seules des pages publiques ont été consultées.

### Faits vérifiés (sources)
| Fait | Source |
| --- | --- |
| Version documentée : **0.20.3** ; installation par `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` | [docs.sheetjs.com, installation Node.js](https://docs.sheetjs.com/docs/getting-started/installation/nodejs) |
| Le registre npm est périmé (dernière version : 0.18.5) ; le CDN SheetJS est la source faisant autorité | même page |
| Le fournisseur **recommande fortement de copier les modules localement** (« vendoring ») | même page ; la page de téléchargement du CDN dit que cela réduit la surface d'attaque de la chaîne d'approvisionnement ([cdn.sheetjs.com](https://cdn.sheetjs.com/)) |
| ReDoS (CVE-2024-22363, GHSA-5pgg-2g8v-p4x9) : gravité haute, CVSS 7.5, versions **avant 0.20.2** ; la 0.20.2 est disponible sur le CDN du fournisseur, pas sur npm | [GitHub Advisory GHSA-5pgg-2g8v-p4x9](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9) |
| Pollution de prototype (CVE-2023-30533, GHSA-4r6h-8v6p-xvw6) : haute, CVSS 7.8 (vecteur local, interaction de l'utilisateur requise), versions **jusqu'à 0.19.2** ; corrigée en 0.19.3 sur le CDN ; déclenchée à la **lecture** de fichiers spécialement construits ; les usages en écriture seule ne sont pas touchés | [GitHub Advisory GHSA-4r6h-8v6p-xvw6](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6) |
| Licence : Apache 2.0 ; redistribution permise avec conservation des notices et attribution ; droits de marque non accordés | [docs.sheetjs.com, licence](https://docs.sheetjs.com/docs/miscellany/license) ; la copie npm installée déclare aussi Apache-2.0 |

### Non vérifié
- **Que la 0.20.3 contienne les deux correctifs** : déduction (0.20.3 postérieure à 0.20.2 et 0.19.3), **aucune note de version officielle n'a pu être lue** (le journal des modifications et la page des versions n'étaient pas accessibles : 404 ou page de connexion). Les pages de sécurité du fournisseur consultées ne listent pas ces avis.
- **Intégrité** : le fournisseur ne publie, sur les pages consultées, **aucune somme de contrôle, signature ni attestation de provenance** pour l'archive. Le CDN ne propose pas de liste de versions lisible sans navigateur. Un hachage calculé sur une archive téléchargée consignerait seulement les octets reçus ; il n'établit pas l'authenticité. Deux téléchargements depuis deux réseaux détectent une altération locale ou ciblée, pas une archive compromise à la source. Je n'invente pas de mécanisme de vérification indépendant. Pistes réelles mais partielles : comparer l'archive avec le dépôt de sources officiel du fournisseur (reconstruction non garantie identique), lire le code de la différence entre 0.18.5 et 0.20.3 avant intégration, épingler l'empreinte dans le dépôt pour détecter tout changement ultérieur (reproductibilité, pas authenticité).
- Les changements d'interface entre 0.18.5 et 0.20.3 : non lus ; à relire dans le journal officiel avant tout essai.

### Compatibilité à contrôler avant une mise à niveau
Les huit écrans d'import (balance, biens, honoraires, souche de chèques, suivi devise, conversions, relevés bancaires, états fournisseurs) : lecture `.xlsx`, `.xls` et `.csv` là où l'écran les accepte, `cellDates` (dates en objets Date), `sheet_to_json` avec `header: 1`, `raw: true`, `defval`, plage `range`, fusions `!merges`, noms de feuilles, comportement sur fichiers vides, tronqués ou mal formés (message d'erreur affiché, pas de blocage). Tous les exports : `export.ts`, `fournisseursExport.ts`, `banqueExport.ts`, `etatsFinanciers/exportClasseur.ts`, `BordereauxPage`, `StockSocietePage`, `pdfToTables` : largeurs, formats de nombre à 3 décimales, fusions, styles, ouverture dans Excel. Les montants comptables : comparaison octet à octet des valeurs lues entre 0.18.5 et 0.20.3 sur un jeu **synthétique** couvrant nombres décimaux, dates, texte numérique, cellules vides et formules. Tests à ajouter : classeurs synthétiques volumineux et malformés (tronqué, zip incomplet, très nombreuses lignes/cellules, motif à tester pour la ReDoS), exécutés sous délai. Le chargement dynamique `import("xlsx")` et le découpage du paquet (taille du lot) sont aussi à vérifier à la construction. Les tests existants (`etatFournisseursClasseur`, `banqueClasseur`, `pdfToTables`) ne prouvent rien sur la nouvelle version tant qu'ils n'ont pas été exécutés avec elle.

### Les garde-fous de la phase 8, évalués (sans modification)
- **Limite de 10 Mio** : protège contre la consommation accidentelle de mémoire et de temps par un très gros fichier, et évite de passer à l'analyse un fichier manifestement hors norme. Elle ne borne **pas** la taille décompressée d'un `.xlsx` (un zip de 10 Mio peut se décompresser en centaines de Mio) ni la durée d'un motif ReDoS (un petit fichier suffit).
- **Extension, MIME, signature** : contrôles de cohérence, pas de sûreté. L'extension et le type MIME sont fournis par l'expéditeur ; la signature (zip, OLE) n'atteste que le conteneur. Un classeur piégé a la bonne signature.
- **Isolation dans un travailleur avec délai** : techniquement faisable. L'application est construite avec Vite (travailleurs de module par `new Worker(new URL(...), { type: "module" })`), l'import dynamique de `xlsx` fonctionne dans un travailleur, `worker.terminate()` borne la durée, et la CSP existante (rapport seul) admet déjà des travailleurs de même origine. Bénéfice supplémentaire : une pollution de prototype resterait confinée au travailleur et n'atteindrait pas la page (ni le jeton). Coût : remodeler les huit lecteurs autour d'un appel asynchrone avec transfert de tampon ; non réalisé, non testé ici.
- **Verrou de lecture unique** : utile et peu coûteux (empêche d'empiler des analyses coûteuses, par exemple des conversions multiples) ; sans effet sur la sécurité du contenu.
- **Seuil de 10 Mio** : décision du propriétaire, à fonder sur les plus gros classeurs réellement importés (taille mesurée sur des fichiers du cabinet, par lui-même, sans en transmettre le contenu). Non modifié.

### Note de décision (en attente ; recommandation non décisionnelle)
| Option | Avantages | Risques | Lacunes de preuve | Approbation requise |
| --- | --- | --- | --- | --- |
| **A. Conserver 0.18.5 provisoirement** | Aucun changement, aucun risque de régression | Deux avis hauts ouverts sur une lecture de fichiers de tiers ; plus aucun correctif npm | Impact exact non démontré | Acceptation écrite du risque résiduel, avec échéance |
| **B. Approuver 0.20.3 pour une phase séparée de vérification et d'intégration** | Source de référence du fournisseur, versions postérieures aux deux correctifs, licence compatible, copie locale recommandée par le fournisseur | Changements d'interface non lus ; authenticité non démontrable par somme de contrôle fournisseur ; régression possible sur des montants comptables | Contenu des correctifs de 0.20.3 non confirmé par notes officielles ; aucune somme de contrôle fournisseur | Autorisation explicite de télécharger l'archive dans un dossier isolé, de modifier `package.json`/`package-lock.json`, puis de lancer l'essai complet |
| **C. Refuser 0.20.3 jusqu'à une meilleure preuve** | Aucun code non vérifié intégré | Prolonge l'exposition de l'option A | Dépend de ce qu'on exigera comme preuve | Définition du seuil de preuve acceptable |

**Recommandation (décision réservée au propriétaire) : B, strictement encadrée**, combinée à A en attendant : (1) autoriser un téléchargement isolé (dossier propre, jamais d'exécution, `npm install --ignore-scripts` si installation) ; (2) lire le journal officiel et la différence de code ; (3) enregistrer l'empreinte et la copier dans `vendor/` ; (4) exécuter l'essai de compatibilité ci-dessus ; (5) réévaluer ensuite le travailleur avec délai. Les preuves actuelles **suffisent pour autoriser une phase d'intégration séparée et réversible, pas pour installer** : l'authenticité de l'archive repose sur la confiance dans le CDN du fournisseur.

### Décisions du propriétaire à rendre ensuite
1. Option A, B ou C pour `xlsx` (D7), et l'autorisation précise (téléchargement isolé ; modification des manifestes).
2. Seuil de taille des classeurs (provisoire : 10 Mio) à partir de tailles réelles.
3. Travailleur avec délai : oui/non, en phase séparée.
4. Pour le reste : D1 à D6 et les blocages inchangés.

**Statut : CONDITIONNELLEMENT PRÊT** (inchangé). Blocages conservés : restauration native PostgreSQL, CI observée sur une pull request, protection de `main`, configuration serveur et en-têtes HTTPS par un opérateur autorisé, D1 à D7, vulnérabilités hautes non résolues.

## 19. Phase 10 — évaluation isolée de SheetJS 0.20.3 (15 octobre 2026)

**Garde-fou.** Option B approuvée pour une évaluation locale, isolée et réversible, **pas pour la production**. Aucune connexion à la production, aucun Docker, `camconsult-db` non sollicité, aucun `git add`/commit/push. Vérifié en fin de phase : `package.json` (SHA-256 `975a258f…eca4`) et `package-lock.json` (`8d7ed89b…acd`) inchangés, `xlsx` installé dans l'application toujours **0.18.5**, `main` toujours en `8865f4c`, mêmes modifications non commitées. Le candidat n'a jamais été installé dans l'arbre de l'application : il a été décompressé dans un dossier temporaire hors du dépôt (`…/scratchpad/sheetjs-eval/`) et branché pour les essais par un alias de configuration situé **hors du dépôt** (vérifié : l'alias charge bien « SheetJS 0.20.3 »).

### Artefact
| Élément | Valeur |
| --- | --- |
| URL officielle | `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` (indiquée par la [documentation SheetJS](https://docs.sheetjs.com/docs/getting-started/installation/nodejs)) |
| Téléchargé le | 15 octobre 2026 à 16:50 UTC (HTTP 200, `application/octet-stream`) |
| Taille | 2 409 319 octets (26 entrées, 8 097 792 octets décompressés) |
| SHA-256 | `8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8` |
**Ce hachage consigne les octets reçus ; il ne prouve pas l'authenticité.** Un second téléchargement depuis la même source et le même réseau donne le même hachage (cohérence du CDN, pas authenticité).

### Provenance : vérification indépendante impossible
Aucune somme de contrôle, signature ni attestation du fournisseur : `…/SHA256SUMS`, `….sha256`, `….asc`, le listing du dossier et `xlsx-latest/package.json` répondent 404 ; les pages de documentation et du CDN n'en mentionnent aucune ; le dépôt de sources n'était pas consultable sans connexion. **Authenticité non établie** ; l'archive repose sur la confiance dans le CDN du fournisseur (et la recommandation de copie locale du fournisseur ne la remplace pas).

### Inspection statique (aucun code exécuté pour cette inspection)
- 26 entrées, **aucun chemin absolu ni `..`**, aucun lien, un seul fichier exécutable (`package/bin/xlsx.njs`, outil en ligne de commande déprécié, **non lancé**, non utilisé par l'application).
- `package.json` : **aucune dépendance**, **aucun script d'installation** (`preinstall`/`install`/`postinstall` absents ; seuls des scripts de test/construction du fournisseur), licence Apache-2.0, dépôt déclaré `git.sheetjs.com/SheetJS/sheetjs`. `LICENSE` identique dans `package/` et `dist/` ; la copie installée de 0.18.5 est aussi Apache-2.0.
- Recherche de motifs dangereux dans `xlsx.mjs` (appels `eval`, `new Function`, `child_process`, requêtes réseau, `process.env`) : **aucun trouvé** (seules des expressions régulières `.exec` d'analyse).
- Journal des modifications **fourni dans l'archive elle-même** (auto-déclaré, donc non indépendant) : v0.19.3 « Fixed Prototype Pollution vulnerability (CVE-2023-30533) » ; v0.20.2 « Reworked parsing methods to avoid slow regexes (CVE-2024-22363) ». Cela **confirme, de façon non indépendante, que la 0.20.3 contient les deux correctifs** annoncés par les [avis GitHub](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6) ([ReDoS](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9)). Je n'ai pas relu le code des correctifs.
- Comparaison avec 0.18.5 : 10 723 lignes diffèrent dans `xlsx.mjs` ; **revue complète non réalisée** (non faisable ici). Aucun jugement n'est porté sur ces changements au-delà des essais ci-dessous.
- Changements de comportement annoncés par le journal (à connaître) : 0.20.0 « interprétation UTC des dates » (potentiellement rupturiste), NaN/infini exportés en `#NUM!`/`#DIV/0!`, `sheet_to_json` interprète en UTC les chaînes formatées (0.20.1), export CSV : ne met entre guillemets que l'identifiant initial (0.20.3).

### Essais de comparaison (données synthétiques, poste en UTC+1 « Etc/GMT-1 », identique à la Tunisie ; refaits en UTC)
Exécutés dans un dossier isolé par scripts Node, avec les deux versions côte à côte, avec délai et mémoire limités pour les cas hostiles.

| Essai | Résultat |
| --- | --- |
| Lecture `.xlsx` (écrit par `exceljs`, lecteur indépendant) : valeurs, décimales (0,1+0,2, 999 999 999,999), texte numérique (« 00123 »), cellules vides, formules (valeurs en cache), dates, fusions, noms de feuilles accentués, feuille vide ; options `cellDates` vraie et fausse | **Identique** dans les deux versions (UTC et UTC+1) |
| Lecture `.xls` et `.xlsx` écrits par chaque version, croisés | **Identique** |
| Lecture CSV ISO « 2026-01-01 », fuseau UTC+1, `cellDates` | **DIFFÉRENCE** : 0.18.5 donne minuit **UTC** (2026-01-01T00:00Z), 0.20.3 minuit **local** (2025-12-31T23:00Z). Le rendu texte (`raw:false`) passe de « 1/1/26 » à « 2026-01-01 ». Sans `cellDates`, le numéro de série passe de 46023,0417 à 46023. |
| Lecture CSV : cellule `=1+1` | **DIFFÉRENCE** : 0.18.5 la lit vide (null), 0.20.3 la lit comme texte `=1+1` |
| Écriture : mêmes feuille, colonnes, largeurs, fusions, formats `#,##0.000` et `dd/mm/yyyy`, relue par `exceljs` | **Identique** (32 cellules), sauf NaN/infini : cellule vide → cellule d'erreur `#VALUE!`/`#DIV/0!` ; taille 17 681 → 17 696 octets |
| Export CSV | Identique sauf NaN/infini : « NAN »/« INFINITY » → `#VALUE!`/`#DIV/0!` |
| Compilation : bloc `xlsx` | 429,5 → **500,1 Ko** (gzip 143,1 → 163,1 Ko), +16 % |
| Suite `src` du projet avec le candidat par alias | 107 fichiers / 894 tests **PASSED**, comme avec 0.18.5 — **ces tests ne prouvent pas la compatibilité** (beaucoup simulent la bibliothèque ou n'en lisent pas de vrai classeur) |
| `tsc` avec les types de 0.20.3 | **NOT EXECUTED** |
| Les huit écrans d'import et les exports, dans un navigateur, ouverture dans Excel | **NOT EXECUTED** (aucune vérification manuelle) |

**Écarts de valeurs comptables.** Aucune différence de montant ou de décimale sur les classeurs. Différences de **dates** uniquement pour les CSV à dates ISO en texte lus avec `cellDates` dans un fuseau à l'est de UTC (Tunisie), ce qui touche `ImportBiensDialog` (qui utilise `toISOString()`, UTC) : la date d'acquisition serait décalée à la **veille**. **Défaut préexistant constaté en 0.18.5** : le même écran donne déjà la veille pour une vraie date Excel lue d'un `.xlsx` (essai `exceljs.xlsx` : accesseurs locaux « 2026-08-31 », `toISOString` « 2026-08-30 », poste en UTC+1). Les autres écrans (accesseurs locaux : `importCells`, `banque`, `suiviDevise`) restent corrects dans les deux versions pour ces cas. À corriger (indépendamment de la mise à niveau) dans une phase de code : lire la date par les accesseurs locaux ou par le numéro de série ; test à ajouter. Non corrigé ici.

### Fichiers hostiles (travaux isolés, tas de 512 Mo, délai de 60 s, fichiers synthétiques)
| Cas | 0.18.5 | 0.20.3 |
| --- | --- | --- |
| Vide, octets aléatoires, zip tronqué, zip sans classeur, nom de feuille `__proto__` | lecture ou erreur capturée en quelques ms ; **aucune pollution du prototype** | identique |
| 100 000 lignes (20 Mo, au-dessus de la limite de 10 Mio) | 3,2 s, 422 Mo | 4,1 s, 402 Mo |
| **Zip de 8,9 Mo (sous la limite) contenant 3 millions de cellules (300 000 lignes)** | **plantage mémoire (tas de 512 Mo)** ; avec 4 Go : 17,3 s, 1,43 Go | **plantage mémoire** ; avec 4 Go : 23,0 s, 1,44 Go |
| HTML de 60 000 `<tr><td` non fermés ; XML de 30 000 cellules non fermées ; 200 000 `<` ; CSV d'une ligne de 4 Mo | 0,1 à 0,35 s | identique (0,12 à 0,4 s) |
Aucun essai n'a reproduit la ReDoS publiée (je ne dispose pas de la charge utile exacte) : **l'absence de blocage dans ces essais ne prouve pas que la 0.18.5 est sûre ni que la 0.20.3 l'est**. Constat net : la **limite de 10 Mio ne borne pas la consommation de mémoire ni la durée** (rapport de compression), et **la mise à niveau ne change rien à ce point** (0.20.3 est même plus lente d'environ un tiers). Un travailleur avec délai et un contrôle de taille décompressée sont nécessaires dans tous les cas : voir `docs/note-conception-lecture-classeur-isolee.md`.

### Incertitudes de sécurité restantes
Authenticité de l'archive non démontrable ; revue du code de 10 723 lignes modifiées non faite ; correctifs vérifiés seulement par le journal auto-déclaré ; absence de test sur la charge utile réelle de la ReDoS ; comportement dans les navigateurs non vérifié ; changements de dates à traiter.

### Recommandation
**Accepter le candidat pour une future phase d'intégration, sous conditions** (décision du propriétaire en attente) : (1) copie dans `vendor/` avec le hachage ci-dessus et les notices Apache-2.0 ; (2) installation avec `--ignore-scripts`, modification des manifestes sous autorisation explicite ; (3) correction préalable de la lecture de date de `ImportBiensDialog` avec tests ; (4) décision sur les deux écarts CSV (date ISO en texte, `=…` lu comme texte) ; (5) types vérifiés par `tsc`, huit écrans et exports vérifiés manuellement dans un navigateur, ouverture dans Excel ; (6) mise en place du travailleur avec délai et du contrôle de taille décompressée, car la mise à niveau seule ne protège pas contre l'épuisement de mémoire. **Ne pas promouvoir automatiquement.** Le risque n'est pas résolu tant que ces étapes ne sont pas faites et acceptées.

**Statut : CONDITIONNELLEMENT PRÊT** (inchangé). Blocages conservés : restauration native PostgreSQL, CI observée sur une pull request, protection de `main`, configuration serveur et en-têtes HTTPS par un opérateur, D1 à D7, vulnérabilités hautes non résolues.

## 20. Phase 11 — dates, CSV, lecture bornée (15 octobre 2026)

**Garde-fou.** Aucune connexion à la production, aucun Docker, aucun `git add`/commit/push. `package.json` et `package-lock.json` inchangés (SHA-256 `975a258f…`, `8d7ed89b…`), `xlsx` installé = 0.18.5, aucun worktree ni installation du candidat : celui-ci (hachage `8dc73fc3…99fe8` revérifié identique) n'a servi que par un alias de configuration **hors du dépôt**. Hachage = octets reçus, pas authenticité. 4 commits intacts.

### 1. Date d'acquisition (correctif isolé)
Une date d'acquisition est une **date de calendrier** (« AAAA-MM-JJ »), pas un horodatage. `ImportBiensDialog` utilisait `toISOString()` (UTC) : en Tunisie (UTC+1) une date Excel donnait **la veille** (défaut préexistant, 0.18.5). Correctif minimal : `src/lib/dateBien.ts` (`dateCalendrier`, accesseurs locaux, validation du calendrier : 29/02 d'une année non bissextile, 31/04, mois 13 → refusés), utilisé par l'écran ; aucun schéma ni donnée modifié. Tests `dateBien.test.ts` (17) sous **UTC, Africa/Tunis, America/New_York, Pacific/Auckland** : date Excel, texte jj/mm/aaaa et ISO, minuit et 23:59:59, bissextiles, invalides ; PASSED. Les données déjà importées avec un jour de décalage ne sont **pas** corrigées (décision du propriétaire : les contrôler).

### 2. Sémantique CSV
- **Date ISO en texte** : la différence 0.18.5/0.20.3 (minuit UTC contre local) est neutralisée pour les écrans qui lisent par accesseurs locaux, et pour `ImportBiensDialog` après correctif ; pas de changement de sémantique CSV.
- **`=1+1` lu** : 0.18.5 le perdait (cellule vide), 0.20.3 le conserve en **texte** (jamais évalué). Le comportement du candidat est préférable (aucune perte silencieuse, aucune formule exécutée) ; aucune règle métier n'en dépend (aucun test existant). Décision du propriétaire seulement si un import attendait une cellule vide.
- **Injection de formules à l'export** : **défaut trouvé** — `buildCsv` écrivait tel quel un texte commençant par `= + - @` (ouverture dans Excel = formule). Corrigé : `neutraliserFormule` préfixe une apostrophe aux **textes** concernés ; nombres (type number) et textes qui ne sont qu'un montant (« -4 500,500 ») inchangés. Les exports `.xlsx` écrivent les chaînes comme texte (non concernés ; vérifié par lecture de l'API, pas par ouverture dans Excel). Tests ajoutés à `export.test.ts` (13 au total) : PASSED.

### 3. Lecture bornée (écrite, testée en simulation, **non branchée aux écrans**)
- `zipLimites.ts` : lit le répertoire central **avant** toute analyse et refuse > 2 000 entrées, > 64 Mo décompressés par entrée, > 128 Mo au total, rapport de compression > 1000, zip64, répertoire corrompu. **Branché** dans `lireTamponClasseur` : protège donc dès maintenant les huit écrans (pour les `.xlsx`).
- `extraireClasseur.ts` (noyau pur) : `sheetRows` borne l'analyse elle-même ; refuse > 50 feuilles, > 100 000 lignes, > 200 colonnes, > 2 000 000 cellules ; renvoie uniquement des données simples (dates en « AAAA-MM-JJ »).
- `classeurWorker.ts` + `lireClasseurIsole.ts` : travailleur jetable, **délai de 20 s** avec `terminate()`, une lecture à la fois, annulation, tampon transféré, messages d'erreur sans contenu.
- **Limites provisoires** (toutes à valider par le propriétaire d'après des classeurs réels) : 10 Mio (phase 8), 64/128 Mo décompressés, 50 feuilles, 100 000 lignes, 200 colonnes, 2 M cellules, 20 s.
- **Essai hostile, hors suite, processus à tas de 512 Mo et délai de 150 s** (fichier synthétique de 8,9 Mio, 3 M de cellules ; **avant** : plantage mémoire dans les deux versions) : le contrôle du zip le refuse en 2–3 ms ; **sans** ce contrôle, l'extraction à limites s'arrête sur « trop de lignes » en 5,7 s (0.18.5) et 7,7 s (0.20.3), **sans plantage**.
- **Non fait / non vérifié** : branchement du travailleur dans les huit écrans (refonte de chaque lecteur autour d'un appel asynchrone, à vérifier dans un navigateur) ; empaquetage du travailleur par Vite (le module n'est pas encore importé par l'application, donc absent de la construction) ; compatibilité CSP en conditions réelles ; **le délai borne la durée, pas la mémoire avant expiration** ; le répertoire central est déclaratif (un zip mensonger sur ses tailles passe le contrôle, d'où `sheetRows`, les limites et le délai) ; la ReDoS publiée n'est pas reproduite.

### 4. Résultats exécutés (cible de base vérifiée locale, `localhost:5439`)
`tsc` PASSED ; suite complète **133 fichiers / 1156 tests** PASSED ; `npm run build` PASSED ; `git diff --check` PASSED ; essai hostile ci-dessus PASSED. **Compatibilité du candidat** : mesures de la phase 10 inchangées (suite `src` avec alias : 894 tests PASSED à l'époque, pas relancée avec le nouveau code) ; `tsc` avec les types 0.20.3, huit écrans et exports **dans un navigateur**, ouverture dans Excel : **NOT EXECUTED**. Aucun test de navigateur, aucune vérification manuelle.

### 5. Une pull request d'intégration est-elle justifiée ?
Oui, **en trois pull requests séparées** : (a) dates + injection CSV + contrôle zip (aucune dépendance ; peut partir avec la phase 8) ; (b) travailleur branché aux écrans avec vérification navigateur ; (c) passage à 0.20.3 (copie dans `vendor/`, manifestes, autorisation explicite). Rien n'est commité. Risque d'épuisement mémoire : réduit (zip, lignes, cellules) mais **non éliminé** tant que (b) n'est pas fait.

**Statut : CONDITIONNELLEMENT PRÊT** (inchangé). Blocages : restauration native PostgreSQL, CI observée, protection de `main`, configuration serveur et en-têtes HTTPS par un opérateur, D1 à D7, vulnérabilités hautes non résolues.

## 21. Phase 12 — revue de la PR A (15 octobre 2026)

Aucun commit, push, branche, worktree, Docker ni accès à la production ; manifestes inchangés ; `xlsx` 0.18.5.

**Contenu de la PR A** (dates, injection CSV, contrôle du zip, avec le contrôle commun de la phase 8 dont il dépend) : `src/lib/dateBien.ts` + test, `src/lib/export.ts` + `export.test.ts`, `src/lib/zipLimites.ts` + `zipLimites.test.ts`, `src/lib/fichierImport.ts` + test, `src/lib/classeurExcel.ts`, `ConversionsPage.tsx`, les cinq dialogues d'import (`ImportBalance`, `ImportBiens`, `HonoraireImport`, `SoucheChequeImport`, `SuiviDeviseImport`). **Hors PR A** : `classeurWorker.ts`, `extraireClasseur.ts`, `lireClasseurIsole.ts`, `classeurBorne.test.ts`, `docs/note-conception-lecture-classeur-isolee.md` (PR B) ; `.github/workflows/app-comptable.yml` + `server/pipeline.test.js` (P5-1, PR de CI séparée) ; documents d'audit.

**Défauts trouvés à la revue et corrigés** : (1) le CSV ne neutralisait pas un `=` précédé d'espaces ou de caractères de contrôle, et ne mettait pas entre guillemets un retour chariot seul ; (2) `verifierZip` n'écartait ni les entrées en double, ni un répertoire central incohérent (taille ou décalage), ni un nom dépassant le tampon. Tests ajoutés (bornes sous/à/au-dessus des limites, zip64, doublons, structures corrompues).

**Changement de comportement à connaître** : une date inexistante (« 31/02/2026 ») était auparavant transmise telle quelle (`2026-02-31`) ; elle donne maintenant une chaîne vide et la ligne n'est pas importée. **Correctif de la phase 14** : `parseRows` compte (une fois chacune) les lignes dont la catégorie est renseignée mais dont la date d'acquisition est absente, illisible ou inexistante, et l'aperçu affiche, avant la confirmation, « N ligne(s) ignorée(s) : date d'acquisition invalide. Elles ne seront pas importées. » (aucun avertissement si N = 0). L'avertissement ne couvre pas les autres motifs de rejet (lignes vides, sans catégorie, totaux : non comptées) ; les autres écrans d'import ignorent encore en silence leurs lignes à date illisible (hors PR A). Les dates avec heure (« 2026-08-31T00:00 ») et les numéros de série restaient et restent refusés (donc comptés). Le format envoyé au serveur (« AAAA-MM-JJ ») est inchangé. Les acquisitions déjà importées avec un jour de moins n'ont **ni été inspectées ni corrigées** : elles nécessitent un rapprochement distinct et autorisé.

**Limites restantes** : CSV — le préfixe apostrophe protège Excel et LibreOffice, pas tous les logiciels, ni les caractères Unicode pleine chasse (« ＝ », non interprétés par Excel) ; un « - » ou « + » seul est préfixé ; les textes composés uniquement de chiffres, espaces, points et virgules sont conservés (aucune fonction possible). XLSX — `aoa_to_sheet` écrit les chaînes en cellules texte, vérifié par test (lecture de l'API, pas ouverture dans Excel). Zip — le répertoire central est déclaratif : un zip qui ment sur ses tailles passe le contrôle ; deux lecteurs peuvent interpréter différemment un faux répertoire final (commentaire forgé) ; la mémoire de la bibliothèque n'est pas bornée tant que le travailleur n'est pas branché (PR B). Un essai hostile (3 M de cellules, tas de 512 Mo, délai strict) a de nouveau été refusé en 2 ms.

**Les huit chemins** : tous passent par `lireTamponClasseur` avant tout `XLSX.read` (vérification statique ; relevés bancaires et états fournisseurs via `lireClasseurExcel`). Aucun contournement. Seul autre `XLSX.read` : `extraireClasseur.ts` (PR B, non branché).

**Résultats exécutés** : ciblés (dateBien, export, zipLimites, fichierImport) 80 tests PASSED ; `tsc` PASSED ; `npm run lint` PASSED ; suite complète 134 fichiers / 1174 tests PASSED (cible de base locale `localhost:5439` vérifiée) ; `npm run build` PASSED ; `git diff --check` PASSED. Aucun test navigateur ni Excel.

**PR A : prête pour revue humaine**, sous réserve de séparer les commits (voir la liste ci-dessus). `ImportBiensDialog.tsx` contient à la fois le contrôle de la phase 8 et le correctif de date : à commiter ensemble ou à scinder par morceaux. Blocages de mise en ligne inchangés.

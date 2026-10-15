# Audit de sécurité et préparation à la mise en production

Dernière mise à jour : 15 octobre 2026 (phase 4 : préparation de la revue finale ; voir §13). Périmètre : `app comptabole/` (outil de gestion de cabinet, pas une comptabilité en partie double). Documents liés : `RELEASE_CHECKLIST.md`, `docs/sauvegarde-restauration.md`, `docs/plan-nettoyage-donnees-heritees.md`.

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

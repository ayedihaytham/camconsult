# Liste de contrôle de mise en ligne

Date de rédaction : 15 octobre 2026. Complète `SECURITY_AND_PRODUCTION_READINESS_AUDIT.md`. **Rien n'a été poussé, publié ni déployé.** Chaque case est à cocher par la personne responsable ; une case non vérifiée n'est jamais cochée « par défaut ».

## 1. État du dépôt local

- Branche `main`, en avance de 3 commits sur `origin/main` au début de la phase 4 ; **les trois commits d'audit sont intacts** : `8db7ba2`, `414d59c`, `8c21d6a`. Les modifications de la phase 4 sont dans un quatrième commit local, **non poussé**.
- Garde-fou : aucune base de production n'a été touchée (ni lecture, ni requête, ni migration) ; les tests n'ont visé que le PostgreSQL de développement local (`localhost:5439`) par des bases jetables.
- Fichiers non suivis laissés intacts : `.vscode/` (et les documents locaux de `samples/`, `ocr-transfer/`, désormais ignorés).
- Le dépôt distant n'a reçu aucun changement. Un `git push` sur `main` **déclenche la publication de l'image `latest`** puis son déploiement automatique (Watchtower, 60 s) : ne pas pousser avant d'avoir rempli les conditions du §10.

## 2. Points de décision du propriétaire (bloquants pour la revue de mise en ligne)

| # | Décision | Recommandation | Détail |
| --- | --- | --- | --- |
| D1 | Forcer le changement de mot de passe de tous les employés | Oui, après la fenêtre de validation | `docs/plan-nettoyage-donnees-heritees.md` §A |
| D2 | Neutraliser puis supprimer les colonnes `societes.identifiant` / `mot_de_passe` | Mesurer d'abord, transférer vers un gestionnaire de mots de passe si ce sont de vrais accès | idem §B |
| D3 | Purger l'historique git des classeurs clients | Seulement si le dépôt n'est pas strictement privé ou si les balances sont réelles ; sinon consigner l'acceptation du risque | idem §C |
| D4 | Politique de TVA et avoirs (arrondi par ligne ou sur le total, notes de crédit) | À faire valider par un professionnel tunisien ; ne pas implémenter les avoirs avant | rapport §6 |
| D5 | Stockage des fichiers hors base (SEC-09) | Planifier après la mise en ligne | rapport §9 |
| D6 | Montants en `numeric(18,3)` (FIN-04) | Migration contrôlée après réconciliation | rapport §9 |
| D7 | `xlsx` : rester sur la copie npm (sans correctif) ou passer à la version distribuée par SheetJS | Version officielle SheetJS ≥ 0.20.x avec somme de contrôle fixée, après essai complet | rapport §5 |

## 3. Vérification de la configuration du serveur de production

Script : `server/scripts/check-config.js`. Ce qu'il fait (relu) : lit uniquement les variables d'environnement du processus ; avec la base, il exécute des `SELECT` (connexion, présence de tables, comptage des comptes sans empreinte, présence du déclencheur du journal) ; **il ne modifie rien et n'affiche jamais la valeur d'un secret** (uniquement présent / longueur / conforme). Code de sortie 1 si un contrôle bloquant échoue.

Procédure à exécuter **par le responsable, sur le serveur** (non exécutée par l'audit) :

```bash
# 1. Dans le conteneur de production : variables seules, aucune connexion à la base (comportement par défaut)
docker exec app-comptable node server/scripts/check-config.js
# 2. Seulement ensuite, et en connaissance de cause : avec la base (lecture seule). Le script AFFICHE d'abord « Base visée (lecture seule) : hôte:port/base » :
#    vérifier que c'est bien la base attendue avant de poursuivre.
docker exec app-comptable node server/scripts/check-config.js --db
```

Scripts d'exploitation : `migrate-passwords.js` simule par défaut ; l'écriture exige `--apply --confirmer-cible=<hôte:port/base>` (la cible affichée, retapée). `audit-donnees.js` ne fait que des comptages, après avoir affiché sa cible.

À obtenir : aucun `[ECHEC]`. Contrôles attendus :

| Contrôle | Exigence |
| --- | --- |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | présent, ≥ 24 caractères, différent de la valeur de développement (le serveur refuse de démarrer sinon) |
| `ADMIN_PASSWORD` | défini à l'installation (la valeur par défaut est refusée) |
| `DATABASE_URL` | valide, mot de passe non trivial |
| `CORS_ORIGIN`, `APP_URL` | `https://cabinet.camconsult.com.tn` (déjà dans `deploy/docker-compose.yml`) |
| SMTP | configuré si les liens d'accès doivent partir par email ; sinon l'administrateur les transmet lui-même |
| `ALLOW_DATA_RESET` | absent (ou différent de `true`) |
| `MIGRATE_LEGACY_PASSWORDS` | `false` pendant la fenêtre de validation, puis retiré |
| Base | table `password_tokens`, colonne `mdp_hash`, déclencheur `journal_ajout_seul_trg` présents après le premier démarrage de la nouvelle version |

**Ce qui a été réellement exécuté** : le contrôle a tourné sur le poste de développement avec ses variables locales (sans base : `--no-db`) et a correctement signalé les défauts de développement (mot de passe administrateur par défaut, mot de passe de base faible) ; la logique est couverte par 12 tests (valeurs synthétiques uniquement, sans base) et 10 tests d'exploitation sur base jetable. **Aucune exécution sur le serveur de production.**

## 4. nginx et proxy Express

Topologie relevée dans `deploy/` : nginx sur l'hôte → `127.0.0.1:5181` → conteneur `app-comptable` (port publié sur l'interface locale uniquement, pas sur Internet).

| Point | Constat | Verdict |
| --- | --- | --- |
| `X-Forwarded-Proto` | `proxy_set_header X-Forwarded-Proto $scheme;` dans tous les blocs de l'application | Correct (le fichier du dépôt ne contient que le port 80 ; Certbot ajoute le bloc 443 : **vérifier sur le serveur** qu'il garde cette ligne) |
| `X-Forwarded-For` | `$proxy_add_x_forwarded_for` : nginx **ajoute** l'adresse réelle à droite de ce que le client a envoyé | Correct avec `trust proxy = 1` |
| Express | `app.set("trust proxy", 1)` : fait confiance à un seul saut et lit l'adresse la plus à droite | Correct pour cette topologie ; ne pas passer à `true` |
| Usurpation d'adresse | Démontrée par un test réel : huit échecs avec huit valeurs forgées à gauche du `X-Forwarded-For` sont tous comptés sur l'adresse ajoutée par nginx, le neuvième est bloqué | Résistant, **à condition que le port 5181 ne soit joignable que par nginx** (c'est le cas dans `deploy/docker-compose.yml` : `127.0.0.1:5181:8080`). Si l'application était exposée directement, l'adresse deviendrait falsifiable. |
| `CLIENT_IP_HEADER` | Inutile ici (un seul proxy). À ne définir que derrière Cloudflare ou un second proxy, et seulement si le serveur n'est joignable que par lui | Laisser vide |
| HTTPS / HSTS | `req.secure` vient de `X-Forwarded-Proto` ; HSTS n'est envoyé que pour une requête HTTPS (test réel) | Correct |
| En-têtes de sécurité | Posés **uniquement par Express** (`server/securityHeaders.js`) ; nginx n'en ajoute aucun. `X-Powered-By` est désactivé dans Express. | Pas de doublon. Le site actuellement en ligne (version du 13/10) n'envoie encore aucun de ces en-têtes et montre `X-Powered-By: Express` et la version de nginx |

Modifications de configuration **préparées dans `deploy/nginx-camconsult.conf`, non appliquées** (nginx en production n'a pas été touché ; `nginx -t` : BLOCKED, nginx absent du poste) :
- `server_tokens off;` dans chaque bloc `server` (retire la version de nginx de l'en-tête `Server`).
- `proxy_hide_header X-Powered-By;` pour l'application (défense en plus d'Express).
- Les blocs HTTPS ajoutés par Certbot doivent **conserver** ces lignes, `proxy_set_header X-Forwarded-Proto $scheme;`, `X-Forwarded-For $proxy_add_x_forwarded_for;` et `proxy_pass http://127.0.0.1:5181;` ; ne pas ajouter `add_header` pour les en-têtes déjà envoyés par Express (doublons contradictoires).
- Avant rechargement, sur l'hôte : `sudo nginx -t` puis `sudo systemctl reload nginx`.

Vérifications à lancer après la mise en ligne (la requête est en lecture seule) :

```bash
# 1. Chaque en-tête exactement une fois, aucun X-Powered-By
curl -sI https://cabinet.camconsult.com.tn/ | grep -iE '^(strict-transport-security|x-content-type-options|x-frame-options|referrer-policy|permissions-policy|content-security-policy-report-only|x-powered-by|server):' | sort -f | uniq -c
# 2. L'adresse retenue est bien celle du visiteur : depuis DEUX réseaux différents, faire 9 échecs avec un identifiant INEXISTANT
for i in 1 2 3 4 5 6 7 8 9; do curl -s -o /dev/null -w "%{http_code} " -X POST https://cabinet.camconsult.com.tn/api/auth/login -H 'Content-Type: application/json' -d '{"identifiant":"audit.inconnu","motDePasse":"x"}'; done; echo
#   attendu : 401 ×8 puis 429 depuis le premier réseau ; depuis le second réseau, le premier essai donne 401 (et non 429)
```

## 5. Garde-fous de la chaîne de publication (GitHub Actions)

Fichier `.github/workflows/app-comptable.yml` (relu, YAML validé, vérifié par 5 tests statiques) :

- Jobs `tests` (types, tests, construction de production), `integration` (PostgreSQL jetable en conteneur de service, données synthétiques, `npm run test:integration`) et `docker` qui exige `needs: [tests, integration]`.
- `docker` ne s'exécute **ni pour une pull request ni depuis une autre branche que `main`** : un lancement manuel (`workflow_dispatch`) sur une branche ne publie plus `latest` (c'était un contournement possible avant cette phase).
- Les pull requests ne lancent que les contrôles : aucun secret n'est référencé hors du job `docker`, droits en lecture seule (`permissions: contents: read`).
- Une étape en échec arrête le job, donc `docker` (qui en dépend) ne démarre pas ; aucun `continue-on-error`.
- Limites : les actions sont référencées par étiquette (`@v4`), pas par empreinte de commit (à durcir) ; **protection de branche** `main` (revue obligatoire, contrôles requis) à activer côté GitHub, hors du dépôt ; le workflow du site vitrine (`camconsult-site.yml`) n'a pas ces garde-fous (hors périmètre) ; **ce pipeline n'a jamais tourné sur GitHub** (non exécuté : pousser une branche déclencherait la CI, et un push sur `main` déploierait).
- Le workflow du site vitrine (`camconsult-site.yml`) est désormais limité à `main` pour la publication, avec droits en lecture seule. Validation locale : YAML analysé, 23 tests statiques ; **jamais exécuté sur GitHub**.
- Procédure sûre pour l'observer (**à faire par le propriétaire**, rien n'est fait par l'audit) :
  1. Créer une branche de travail à partir du commit de la phase 4 et la pousser **sur cette branche seulement** (jamais `main`).
  2. Ouvrir une pull request vers `main` : seuls `tests` et `integration` tournent ; `docker` est ignoré (condition `github.event_name != 'pull_request'`). Aucun secret n'est exposé.
  3. Constater que les deux contrôles passent. Ne pas fusionner avant la revue.
  4. Réglages GitHub > Settings > Branches > règle pour `main` : *Require a pull request before merging*, *Require status checks to pass* avec **`tests`** et **`integration`** (les noms apparaissent après la première exécution), *Require branches to be up to date*, *Do not allow bypassing*, interdire les push forcés et la suppression de la branche.
  5. Seule la fusion sur `main` publie `latest` (puis Watchtower déploie sous 60 s) : la planifier pendant la fenêtre prévue au §10.

## 6. Retour arrière et récupération

**Vérifié expérimentalement** (base jetable, ancienne version = commit `577fd81` démarrée sur une base déjà migrée par la nouvelle, aucun email) :

| Constat | Résultat |
| --- | --- |
| L'ancienne version démarre sur le schéma migré (colonnes et tables ajoutées sans suppression) | Oui |
| Administrateur | Se connecte |
| Compte hérité **non encore converti** | Se connecte |
| Compte hérité **déjà converti** (empreinte, valeur en clair effacée) | **Ne peut plus se connecter** (401) |
| Compte créé et activé **après** la mise en ligne | **Ne peut pas se connecter** (401) |
| Création d'un compte avec mot de passe, liste des employés | Fonctionnent |
| L'ancienne version détruit-elle des empreintes ? | Non |
| Retour à la nouvelle version sur la même base | Les comptes convertis se reconnectent avec leur ancien mot de passe ; un compte créé par l'ancienne version (mot de passe en clair) se connecte et est converti |

Conséquences et stratégie :
1. **Stratégie : corriger en avançant.** Un retour à l'ancienne image ne perd aucune donnée mais verrouille les comptes déjà convertis et les nouveaux comptes ; il n'existe pas de « retour sûr » une fois des comptes convertis.
2. **Fenêtre de validation** : déployer avec `MIGRATE_LEGACY_PASSWORDS=false`. Pendant 1 à 3 jours, aucun compte hérité n'est converti : un retour arrière est alors **sans conséquence pour eux** (seuls les comptes créés dans la fenêtre sont touchés : les recréer, ou leur remettre un mot de passe via l'ancienne interface). Retirer le réglage ensuite.
3. **Restauration d'une sauvegarde** : dernier recours, jamais par-dessus des données plus récentes sans chiffrer la perte (tout ce qui a été saisi depuis la sauvegarde est perdu). Préférer la reprise des seules données utiles.
4. **Instances multiples / tâches de fond** : l'application tourne en une seule instance ; les relances planifiées vivent dans ce processus ; pendant un redémarrage Watchtower aucune seconde version ne coexiste. Les compteurs de tentatives de connexion sont en mémoire : remis à zéro à chaque redémarrage (à retenir si une attaque est en cours).
5. **Échec en cours de migration** : le schéma est appliqué par un seul appel idempotent au démarrage ; si le démarrage échoue, le serveur s'arrête (`process.exit(1)`) sans rien servir. Une conversion de mot de passe est une seule instruction conditionnelle ; une activation par lien est une transaction (le lien n'est pas consommé si l'enregistrement échoue).
6. **Porte de sortie obligatoire avant la mise en ligne** : sauvegarde du jour **et** test de restauration réussi au moins une fois (`docs/sauvegarde-restauration.md`). Tant que cette restauration n'a pas été exécutée, la mise en ligne reste bloquée.

## 7. Sauvegarde et restauration

Procédure : `docs/sauvegarde-restauration.md`. **Restauration réelle (`pg_dump`/`pg_restore`) : BLOCKED** (outils absents du poste, aucune action Docker lancée, aucune sauvegarde de production créée ou copiée). Ressources requises : hôte jetable avec client PostgreSQL 16, sauvegarde chiffrée de test, volume suffisant, puis `docs/verification-restauration.sql`. **Restauration logique : PASSED** sur deux bases jetables locales (données synthétiques, 66 lignes, fichier de 0,4 Mo, vérifications SQL, démarrage de l'application, connexion, relecture du fichier) : elle valide le schéma, les relations et les requêtes de vérification, **pas** les outils de sauvegarde. La porte de sortie du §6.6 reste donc **fermée**.

## 8. Dépendances

Voir le rapport §5 : production 17 → 13 vulnérabilités, 0 critique, après mise à jour de `express`, `body-parser`, `qs`, `proxy-addr`. Restent : outils de construction CSS (Tailwind 3 et dépendances), `react-router` 6 (correctif en version 7), `exceljs`/`uuid`, `xlsx` (aucun correctif sur npm : la copie npm n'est plus maintenue, les versions corrigées ne sont distribuées que par SheetJS ; l'avis GHSA-5pgg-2g8v-p4x9 est corrigé en 0.20.2 selon la base d'avis GitLab, le correctif de GHSA-4r6h-8v6p-xvw6 n'a pas pu être confirmé auprès d'une source officielle).

## 9. Ce qui a été exécuté pendant cette phase

Voir le rapport §7 pour les résultats complets : suite complète, types, construction, **21 tests d'intégration contre un vrai PostgreSQL 16 jetable** (dont l'activation simultanée d'un même lien, la conversion simultanée d'un compte hérité, les règlements fournisseurs simultanés, l'isolation par société et le redémarrage sur la même base), l'expérience de retour arrière, la validation du YAML de la CI.

Phase 4 (nouveaux résultats, 15 octobre) : `tsc` PASSED ; 130 fichiers / 1086 tests PASSED (dont 34 d'intégration sur bases jetables locales : 21 + 10 + 3) ; construction PASSED ; `npm audit --omit=dev` : 13 vulnérabilités (7 hautes, 6 moyennes, 0 critique) ; `git diff --check` propre. Défaut trouvé : restauration JSON sans garde-fou (corrigé). BLOCKED : `pg_restore` réel, `nginx -t`, exécution GitHub Actions. NOT EXECUTED : contrôle de configuration sur le serveur réel, vérification HTTPS des en-têtes.

### Phase 5 : pull request, protection de `main` et portes (rien n'a été exécuté côté GitHub)

Un push de branche de travail ne lance **aucun** workflow ; seule l'ouverture d'une pull request lance `tests` et `integration` (sans secret, sans publication). Détail et tableau des déclencheurs : rapport §14. Correction locale non commitée : le filtre de chemins des pull requests a été retiré (sinon un contrôle requis resterait « en attente »). **Commiter cette correction avant d'ouvrir la pull request.**

Commandes préparées pour le propriétaire (à lancer seulement après accord ; `git push` d'une branche de travail ne publie rien) :
```bash
git switch -c revue/securite-phase-5      # crée la branche à partir du commit courant ; main et les 4 commits ne bougent pas
git push -u origin revue/securite-phase-5 # NE PAS pousser main ; ce push seul ne lance aucun workflow
# puis, sur GitHub : Compare & pull request vers main (brouillon). Ne pas fusionner.
```
Protection de `main` (GitHub > Settings > Branches ou Rules > Rulesets), après la première exécution (les noms de contrôles n'apparaissent qu'ensuite) : pull request obligatoire avec au moins 1 approbation ; contrôles requis **`tests`** et **`integration`** (pas `docker`) ; branche à jour avant fusion ; aucune fusion si un contrôle est en attente ou en échec ; pas de push forcé, pas de suppression de la branche ; pas de contournement (y compris administrateurs, sauf justification consignée). Vérification : tenter de pousser sur `main` doit être refusé. Ne cocher qu'après vérification.

Quatre portes distinctes : (1) validation locale, (2) CI de pull request, (3) approbation de mise en ligne, (4) autorisation de déploiement : fusionner sur `main` déploie sous 60 s.

Décisions D1 à D7 : rapport §14 (recommandations ; aucune action exécutée). Restauration native, `nginx -t`, GitHub Actions, serveur : BLOCKED/NOT EXECUTED comme au §9.

## 10. Conditions avant une revue de mise en ligne

- [ ] D1 à D3 décidées ; D4 à D7 consignées (traitées plus tard, avec la date prévue).
- [ ] `check-config.js` exécuté **sur le serveur** : aucun `[ECHEC]`, résultat archivé (sans secret).
- [ ] Sauvegarde du jour chiffrée **et** restauration testée (durée notée) dans un environnement isolé.
- [ ] nginx : `X-Forwarded-Proto` présent dans le bloc HTTPS, port 5181 non exposé publiquement, `server_tokens off`.
- [ ] Pipeline observé sur une pull request (jobs `tests` et `integration` au vert) ; protection de branche `main` activée.
- [ ] Watchtower mis en pause pendant la fenêtre ; étiquette et empreinte de l'image en service notées.
- [ ] Mise en ligne avec `MIGRATE_LEGACY_PASSWORDS=false`, puis parcours de validation (connexion administrateur, compte hérité, création et activation d'un compte, `curl -sI` des en-têtes).
- [ ] Fenêtre de validation écoulée sans incident, puis réglage retiré et plan D1 exécuté.
- [ ] Approbation opérationnelle et métier du responsable, consignée avec la date.

## 11. Blocages restants pour la revue de mise en ligne

1. Restauration réelle d'une sauvegarde jamais testée (BLOCKED : outils et hôte isolé requis).
2. Contrôle de configuration jamais exécuté sur le serveur réel ; configuration nginx préparée mais ni validée (`nginx -t`) ni appliquée.
3. Pipeline jamais exécuté sur GitHub ; protection de `main` non activée.
4. Décisions D1 à D3 en attente (mots de passe hérités, colonnes de sociétés, historique git).
5. Vulnérabilités de dépendances restantes documentées mais ouvertes (dont `xlsx`).

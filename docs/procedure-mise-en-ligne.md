# Mise en ligne sécurisée : ce qui reste à faire, pas à pas

Document du 22 octobre 2026. Complète `RELEASE_CHECKLIST.md` et `SECURITY_AND_PRODUCTION_READINESS_AUDIT.md`. Il ne contient que des actions que **le responsable** exécute (serveur, GitHub) : elles ne peuvent pas être faites à distance depuis le poste de développement. Chaque case se coche à la main, après vérification.

## État des décisions (réponses du propriétaire, 22 octobre 2026)

| # | Décision | Réponse | Suite |
| --- | --- | --- | --- |
| D1 | Mots de passe hérités en clair | **Changement forcé pour tous** | §2 |
| D2 | Colonnes `societes.identifiant` / `mot_de_passe` | **Mesurer d'abord** | §3 |
| D3 | Classeurs clients dans l'historique git | **Risque accepté (dépôt privé), pas de purge** | consigné ci-dessous |
| D4 | Politique de TVA et d'avoirs | À faire valider par un professionnel tunisien ; **ne pas implémenter les avoirs avant** | en attente |
| D5 | Stockage des fichiers hors base | Après la mise en ligne | en attente |
| D6 | Montants en `numeric(18,3)` | Migration contrôlée après réconciliation sur la production (§4) | en attente |
| D7 | Bibliothèque Excel | **SheetJS 0.20.3 copiée dans `vendor/`** | fait (voir `app comptabole/vendor/README.md`) |

**D3 — risque accepté.** Les 19 classeurs `samples/Balance_*.xlsx` restent dans l'historique git (retirés des fichiers suivis, ignorés par `.gitignore` et `.dockerignore`). Décision : ne pas réécrire l'historique. Condition de cette acceptation : le dépôt GitHub reste **privé** et son accès limité aux personnes du cabinet. À revérifier si le dépôt change de visibilité ou reçoit de nouveaux collaborateurs. Le cache de la CI n'a pas besoin d'être vidé.

## 1. Avant toute chose : sauvegarde et essai de restauration

1. **Essai déjà fait sur le poste de développement (22 octobre)** : sauvegarde, restauration dans un conteneur jetable, vérifications, démarrage de l'application, connexion : tout passe (voir `docs/sauvegarde-restauration.md` §6, 6,7 s de restauration sur une base de démonstration).
2. **À faire une fois sur le serveur réel** (§2 de `docs/sauvegarde-restauration.md`) : une vraie sauvegarde de production, déchiffrée sur une machine de test, restaurée avec `pg_restore`, puis `docs/verification-restauration.sql`. Noter la durée : c'est le temps de reprise à annoncer.
3. Contrôle de configuration sur le serveur, **variables seules d'abord** :
   ```bash
   docker exec app-comptable node server/scripts/check-config.js
   docker exec app-comptable node server/scripts/check-config.js --db   # lecture seule, vérifier la base affichée
   ```
   Attendu : aucun `[ECHEC]`. L'essai du 22 octobre sur une copie a donné une seule `[ALERTE]` : `CLIENT_IP_HEADER` absent. Elle est **attendue ici** : `RELEASE_CHECKLIST.md` §4 indique de le laisser vide derrière un seul proxy (nginx). Vérifier tout de même par un test réel (deux visiteurs depuis deux adresses) que la limite de tentatives de connexion ne les traite pas comme une seule adresse.

## 2. D1 — forcer le changement des mots de passe hérités

À exécuter **dans le conteneur de production, après une sauvegarde testée (§1)** et après la fenêtre de validation de 1 à 3 jours ouvrés avec `MIGRATE_LEGACY_PASSWORDS=false`.

1. Prévenir les employés et les sociétés la veille : « à votre prochaine connexion, il vous sera demandé de choisir un nouveau mot de passe ; aucune action préalable ».
2. Simulation (ne modifie rien, affiche le nombre de comptes) :
   ```bash
   docker exec app-comptable node server/scripts/migrate-passwords.js
   ```
3. Application, en retapant la cible affichée par la simulation :
   ```bash
   docker exec app-comptable node server/scripts/migrate-passwords.js --apply --forcer-changement --confirmer-cible=<hôte:port/base>
   ```
4. Retirer `MIGRATE_LEGACY_PASSWORDS` de `.env`. Traiter toutes les sauvegardes d'avant cette étape comme sensibles (accès restreint, chiffrées, suppression planifiée).
5. Un employé qui oublie son nouveau mot de passe reçoit un lien d'accès de l'administrateur (« Lien d'accès »). **Pas de retour arrière pour les mots de passe** après l'étape 3 : les valeurs en clair n'existent plus.

## 3. D2 — mesurer les colonnes d'accès des sociétés (lecture seule)

```bash
docker exec camconsult-db psql -U cabinet -d cabinet -c "select count(*) total, count(*) filter (where identifiant <> '') avec_identifiant, count(*) filter (where mot_de_passe <> '') avec_mdp from societes;"
```
- **0 et 0** : on peut vider puis supprimer les colonnes dans une version ultérieure (étapes 6 et 7 de `docs/plan-nettoyage-donnees-heritees.md` §B).
- **Des valeurs** : ce sont peut-être des accès à des portails tiers. Les transférer dans un gestionnaire de mots de passe du cabinet (accès restreint), **puis seulement** vider les colonnes. Dire le nombre trouvé : la suite en dépend.

## 4. D6 — réconcilier les montants avant de changer les colonnes (lecture seule)

```bash
docker exec app-comptable node server/scripts/audit-donnees.js
```
Compte les lignes à plus de 3 décimales par colonne, sans afficher de valeur. Résultat attendu : 0 partout. Alors seulement, planifier la migration `numeric(18,3)` (taux en `numeric(18,6)`) après une sauvegarde testée.

## 5. GitHub : intégration continue et protection de la branche

1. **Observer la CI sur une pull request** : créer une branche (`git switch -c test-ci`), pousser un petit changement de documentation, ouvrir une pull request vers `main` sur GitHub. Les contrôles `tests`, `build` et `integration` doivent se lancer et passer au vert ; la tâche `docker` ne doit **pas** se lancer (elle est réservée à `main`).
2. **Protéger `main`** : GitHub → dépôt → Settings → Branches → Add branch ruleset (ou règle de protection) sur `main` :
   - exiger une pull request avant fusion ;
   - exiger que les contrôles `tests`, `build` et `integration` soient réussis ;
   - interdire les poussées forcées et la suppression de la branche.
   **Conséquence à connaître** : après cela, on ne pousse plus directement sur `main`. Chaque changement passe par une branche et une pull request, fusionnée quand la CI est verte. À n'activer que si ce fonctionnement vous convient.

## 6. nginx

La revue statique est couverte par `server/pipeline.test.js` (en-têtes, ports, transmission de l'adresse et du protocole). À vérifier **sur le serveur** : le bloc HTTPS transmet `X-Forwarded-Proto` et `X-Forwarded-For`, le port 5181 n'est pas ouvert sur Internet (`ss -ltnp | grep 5181` ne doit montrer que `127.0.0.1`), `server_tokens off;` est présent, et `curl -sI https://cabinet.camconsult.com.tn | grep -i strict-transport` renvoie l'en-tête HSTS.

## 7. Dépendances de production

`npm audit --omit=dev` : 13 alertes (6 modérées, 7 hautes) après le passage à SheetJS 0.20.3 ; **plus aucune alerte sur `xlsx`**. Les autres sont détaillées, avec leur atteignabilité, dans l'inventaire de la phase 7 de l'audit (`SECURITY_AND_PRODUCTION_READINESS_AUDIT.md` §16) ; à revoir à chaque mise à jour de dépendances.

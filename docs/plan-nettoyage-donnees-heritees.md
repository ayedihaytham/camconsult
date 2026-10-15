# Plan de nettoyage des données héritées

Aucune des opérations ci-dessous n'a été exécutée en production. Elles sont décrites pour décision et exécution contrôlée par le responsable. Aucune valeur de mot de passe n'est reproduite ici.

## A. Mots de passe des employés historiquement en clair : forcer le changement ?

**Recommandation : changement forcé pour tous les comptes concernés, en deux temps.**

Pourquoi :
- Ces mots de passe ont été visibles de l'administrateur à l'écran, stockés tels quels en base, présents dans toutes les sauvegardes antérieures, et envoyés par email lorsque le SMTP était configuré. Une partie d'entre eux a donc pu être lue hors de l'application, et on ne peut pas prouver le contraire.
- Convertir en empreinte protège la base à l'avenir mais **ne rend pas secrets des mots de passe déjà exposés**.
- Le changement forcé ne bloque personne : le compte se connecte avec son mot de passe actuel, puis l'application l'oblige à en choisir un nouveau (écran existant `ChangePasswordRequiredPage`, déclenché par `doit_changer_mdp`). Aucun lien ni email n'est nécessaire.

Déroulement conseillé :
1. **Fenêtre de validation (1 à 3 jours ouvrés)** : mise en ligne avec `MIGRATE_LEGACY_PASSWORDS=false`. Les comptes hérités se connectent sans être convertis : le retour à l'ancienne version reste possible pour eux. Les nouveaux comptes passent par un lien d'activation.
2. **Basculement** : retirer le réglage (conversion à la connexion) puis, une fois la version validée et la sauvegarde testée, exécuter `node server/scripts/migrate-passwords.js` (simulation : nombre de comptes concernés), puis `--apply --forcer-changement`. Les empreintes sont créées pour tous, les valeurs en clair effacées, et chaque employé choisit un nouveau mot de passe à sa prochaine connexion.
3. **Communication** : prévenir les employés et les sociétés clientes la veille (« à votre prochaine connexion, il vous sera demandé de choisir un nouveau mot de passe ; aucune action préalable »).
4. **Sauvegardes** : traiter toutes les sauvegardes d'avant l'étape 2 comme sensibles (accès restreint, chiffrement) et planifier leur suppression.

Impact et reprise : un employé qui oublie son nouveau mot de passe obtient un lien d'accès par l'administrateur ou le responsable des collaborateurs (« Lien d'accès »). Si l'opération échoue, la transaction est annulée (aucun compte à moitié converti) ; le script ne supprime aucun compte. **Retour arrière après l'étape 2 impossible pour les mots de passe** (les valeurs en clair n'existent plus) : on avance avec des liens d'accès.

Alternative acceptable si le cabinet refuse le changement massif : forcer d'abord les comptes à privilèges (administrateur, responsable des collaborateurs, comptables) et les comptes dont le mot de passe a été envoyé par email, laisser les autres se convertir à la connexion. Moins protecteur : à n'adopter que comme décision explicite.

## B. Identifiant et mot de passe de société (`societes.identifiant`, `societes.mot_de_passe`)

État du code (vérifié) : plus aucun chemin ne lit ni n'écrit ces colonnes (création, modification, duplication, restauration, DTO, écrans). Elles existent encore en base avec leurs anciennes valeurs. Sur la base de développement locale, 1 société sur 3 porte un identifiant et 1 un mot de passe : **la base de production peut donc contenir de vraies valeurs**, peut-être des accès à des portails tiers (fiscalité, banque…) que le cabinet utilisait pour le compte du client. Ce point est une décision métier avant toute suppression.

Plan par étapes (aucune suppression de colonne dans cette phase) :
1. **Mesurer** (lecture seule, en production, comptages seulement ; `node server/scripts/audit-donnees.js` donne aussi les mots de passe en clair restants) :
   ```sql
   select count(*) total, count(*) filter (where identifiant <> '') avec_identifiant, count(*) filter (where mot_de_passe <> '') avec_mdp from societes;
   ```
2. **Décider** avec le responsable : ces valeurs sont-elles des accès réellement utilisés ? Si oui, les transférer dans un gestionnaire de mots de passe du cabinet (avec accès restreint et journal), pas dans l'application.
3. **Arrêter les écritures** : fait (version de ce commit).
4. **Retirer l'exposition** : fait (plus de champ dans l'API).
5. **Vérifier l'absence de dépendance** : sur une copie de la base, renommer les deux colonnes et lancer toute la suite de tests et les tests d'intégration ; observer les journaux d'erreurs d'une version de validation en production.
6. **Neutraliser** (après sauvegarde testée, en transaction) :
   ```sql
   begin; update societes set identifiant = '', mot_de_passe = '' where identifiant <> '' or mot_de_passe <> ''; -- vérifier le nombre de lignes, puis commit
   ```
7. **Supprimer les colonnes** dans une version ultérieure, après un cycle complet de sauvegardes et la preuve qu'aucun traitement ne les utilise (`alter table societes drop column identifiant, drop column mot_de_passe`). Le retour arrière du code reste possible tant que les colonnes existent (l'ancienne version les lit à l'insertion).

Authentification de société : il n'en existe plus (les comptes de société sont des `employes` avec rôle `societe_employe`, déjà couverts par le hachage). Aucune intégration externe n'a été trouvée dans le code qui s'en serve.

## C. Classeurs clients dans l'historique git

Constat (noms uniquement, contenu non lu) : 19 classeurs `app comptabole/samples/Balance_*.xlsx` (2 « demo » et 17 « reelle_cargo », balances d'un client) ajoutés par 2 commits. Aucun autre fichier sensible dans tout l'historique : pas de `.env`, clé privée, archive ou sauvegarde SQL ; la recherche de motifs de secrets ne trouve que des exemples factices (`sk-ant-` suivi de 3 caractères dans les `.env.example`). Un seul dépôt distant (`ayedihaytham/camconsult` sur GitHub), 1 branche effective, 0 étiquette.

Déjà fait (commit local) : fichiers retirés de l'index, règles `.gitignore` et `.dockerignore` (`samples/`, `ocr-transfer/`, archives, journaux locaux). **L'historique contient toujours les fichiers.**

Évaluation de l'exposition à faire par le propriétaire :
- Le dépôt GitHub est-il **privé** ? (non vérifiable depuis le poste d'audit : l'outil `gh` est absent.) Qui a accès (collaborateurs, applications autorisées) ? Existe-t-il des forks, des clones sur d'autres postes, des artefacts de CI ?
- L'image Docker d'exécution ne contient pas `samples/` (elle ne copie que `server`, `shared`, `dist`), mais l'étape de construction copiait tout le dossier et le cache de la CI (`cache-to: gha`) a pu en garder des couches : accessible seulement aux membres du dépôt ; vider le cache GitHub Actions après la purge.
- Les balances sont-elles **réelles** ? Si oui, et si le dépôt a pu être lu hors du cabinet, c'est un incident de données clients à traiter selon les obligations contractuelles et légales applicables (à confirmer avec un juriste : je ne m'avance pas sur la loi tunisienne).

Plan de purge (à ne lancer qu'après autorisation explicite, jamais depuis ce poste d'audit) :
1. Prévenir tous les contributeurs (Wassim) : après la purge, **tous les clones doivent être refaits** ; aucune branche locale ne doit être repoussée.
2. Faire une copie miroir de secours (`git clone --mirror`), conservée hors dépôt, chiffrée.
3. Sur un clone miroir frais : `git filter-repo --path "app comptabole/samples" --invert-paths` (outil `git-filter-repo`).
4. Vérifier : `git log --all --name-only | grep samples` ne renvoie rien ; la suite de tests passe (les tests qui lisent `samples/` sont déjà conditionnés à la présence des fichiers).
5. `git push --force --mirror` **seulement après** accord, avec protection de branche temporairement levée ; demander à GitHub Support de purger les références en cache (`refs/pull/*`, vues de commits) et vider le cache Actions.
6. Rotation d'identifiants : aucun secret n'a été trouvé dans les fichiers ou l'historique, donc aucune rotation imposée par cette découverte. Rotation recommandée par prudence seulement si le propriétaire constate qu'un classeur contenait un accès.
7. Documenter la date, la portée et les personnes informées.

Si le propriétaire estime le risque faible (dépôt privé, 2 personnes), l'alternative documentée est de **ne pas réécrire l'historique** et de conserver le retrait de l'index et les règles d'ignorance : décision à consigner.

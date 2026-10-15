# Sauvegarde et restauration

État : **procédure préparée, restauration NON EXÉCUTÉE** (aucun environnement de restauration isolé avec les outils `pg_dump`/`pg_restore` n'était disponible sur le poste d'audit, et la production n'a pas été touchée). La partie « vérification » ci-dessous a été validée sur une base de test jetable avec des données synthétiques (voir `server/integration/`), pas sur une vraie sauvegarde.

## 1. Ce qu'il faut sauvegarder (inventaire réel du déploiement)

Déploiement : VPS, nginx sur l'hôte, conteneurs Docker (`deploy/docker-compose.yml`), images tirées de Docker Hub par Watchtower.

| Élément | Où | Sauvegarde |
| --- | --- | --- |
| Base PostgreSQL 16 (toutes les données, y compris les **documents**) | conteneur `camconsult-db`, volume `camconsult_pgdata`, base `cabinet`, utilisateur `cabinet` | `pg_dump` (§2). **Les fichiers déposés (structuration, collectes, honoraires, messages, SWIFT) sont dans la base en base64** : il n'y a pas de dossier de fichiers séparé à sauvegarder. |
| Secrets et configuration | `/opt/camconsult/.env` (DB_PASSWORD, JWT_SECRET, ADMIN_*, SMTP_*, ANTHROPIC_API_KEY) | Copie chiffrée dans un coffre de secrets, **jamais** dans git ni avec la sauvegarde de la base. `JWT_SECRET` : s'il change, toutes les sessions en cours sont invalidées (sans perte de données). Il n'existe aucune clé de chiffrement des données à conserver. |
| Définition du déploiement | `/opt/camconsult/docker-compose.yml`, `nginx-camconsult.conf`, certificats Let's Encrypt (`/etc/letsencrypt`) | Copie du dossier et de `/etc/letsencrypt` (ou réémission des certificats). |
| Version de l'application | étiquette d'image `merba7/app-comptable:<sha du commit>` publiée par la CI | Noter l'étiquette et l'empreinte (`digest`) de l'image en service avant chaque mise en ligne (§4). Le schéma se met à jour au démarrage de l'application : la base et l'image vont ensemble. |
| Historique des migrations | pas de table de migrations : `server/schema.sql` est rejoué à chaque démarrage (idempotent) | Rien à sauvegarder ; la version du fichier suit l'image. |
| Services externes | SMTP (si configuré), clé Anthropic | Les paramètres sont dans `.env`. Aucune donnée n'y est stockée. |

## 2. Faire une sauvegarde (avant toute mise en ligne et chaque nuit)

Sur le VPS, en tant qu'administrateur (adapter les chemins) :

```bash
set -euo pipefail
DEST=/var/backups/camconsult
mkdir -p "$DEST" && chmod 700 "$DEST"
STAMP=$(date +%F-%H%M)

# 1. Dump complet, format « custom » (compressé, restaurable table par table)
docker exec camconsult-db pg_dump -U cabinet -d cabinet -Fc --no-owner > "$DEST/cabinet-$STAMP.dump"

# 2. Somme de contrôle et métadonnées de version
sha256sum "$DEST/cabinet-$STAMP.dump" > "$DEST/cabinet-$STAMP.dump.sha256"
docker inspect --format '{{.Config.Image}} {{.Image}}' app-comptable > "$DEST/cabinet-$STAMP.version.txt"
docker exec camconsult-db psql -U cabinet -d cabinet -tAc \
  "select 'employes='||count(*) from employes union all select 'societes='||count(*) from societes union all select 'factures='||count(*) from factures" \
  > "$DEST/cabinet-$STAMP.comptes.txt"

# 3. Copie hors du serveur, chiffrée (exemple avec age ; sinon gpg)
age -r "<clé publique du cabinet>" -o "$DEST/cabinet-$STAMP.dump.age" "$DEST/cabinet-$STAMP.dump"
# puis copie du .age (jamais du .dump en clair) vers un stockage distant

# 4. Rétention : garder 14 sauvegardes quotidiennes + 3 mensuelles, supprimer les plus anciennes
```

Les sauvegardes antérieures à la mise à jour de sécurité contiennent les **mots de passe des employés en clair** : les traiter comme sensibles (accès restreint, chiffrées, supprimées à terme).

## 3. Tester une restauration (sans jamais toucher à la production)

À faire sur une autre machine ou dans un dossier isolé, avec un conteneur jetable qui n'est pas relié au réseau de production :

```bash
set -euo pipefail
# 1. Récupérer le dump (déchiffré) sur la machine de test, vérifier l'intégrité
sha256sum -c cabinet-<STAMP>.dump.sha256

# 2. Serveur PostgreSQL jetable (même version majeure que la production), écoute locale uniquement
docker run -d --name restauration-test --rm -e POSTGRES_PASSWORD=jetable-test -p 127.0.0.1:55432:5432 postgres:16-alpine
until docker exec restauration-test pg_isready -U postgres; do sleep 1; done

# 3. Restaurer — mesurer la durée
time (docker exec -i restauration-test pg_restore -U postgres -d postgres --create --no-owner --exit-on-error < cabinet-<STAMP>.dump)

# 4. Vérifications (voir ci-dessous)
docker exec -i restauration-test psql -U postgres -d cabinet -f verification.sql

# 5. Démarrage de l'application sur cette base (secrets de TEST, jamais ceux de production, aucun SMTP)
DATABASE_URL=postgres://postgres:jetable-test@127.0.0.1:55432/cabinet NODE_ENV=production \
  JWT_SECRET=$(openssl rand -hex 32) ADMIN_PASSWORD=test-jetable-1 SMTP_HOST= ANTHROPIC_API_KEY= \
  node server/scripts/check-config.js
# puis démarrer le serveur sur cette base et vérifier GET /api/health et une connexion

# 6. Détruire l'environnement
docker stop restauration-test   # --rm supprime le conteneur et ses données
```

`verification.sql` (lecture seule) :

```sql
-- Volumes par table clé : à comparer au fichier .comptes.txt de la sauvegarde
select 'societes' t, count(*) from societes union all select 'employes', count(*) from employes
union all select 'factures', count(*) from factures union all select 'stock_mouvements', count(*) from stock_mouvements
union all select 'fournisseur_reglements', count(*) from fournisseur_reglements union all select 'mouvements_bancaires', count(*) from mouvements_bancaires
union all select 'swift_virements', count(*) from swift_virements union all select 'collecte_fichiers', count(*) from collecte_fichiers;
-- Contraintes toutes validées
select conrelid::regclass, conname from pg_constraint where not convalidated;
-- Orphelins (doivent être vides)
select count(*) from fournisseur_affectations a left join stock_mouvements m on m.id = a.mouvement_id where m.id is null;
select count(*) from facture_lignes l left join factures f on f.id = l.facture_id where f.id is null;
select count(*) from swift_factures f left join swift_virements v on v.id = f.virement_id where v.id is null;
-- Références de fichiers : la donnée est dans la base, vérifier qu'elle n'est pas tronquée
select count(*) filter (where data_url is null or data_url = '') as fichiers_vides from noeuds where type = 'fichier';
-- État des mots de passe (comptages seulement)
select count(*) filter (where mdp_hash is not null) as avec_empreinte, count(*) filter (where mot_de_passe <> '' and mdp_hash is null) as en_clair from employes;
-- Journal et déclencheur d'ajout seul
select count(*) from journal; select tgname from pg_trigger where tgname = 'journal_ajout_seul_trg';
```

Critères de réussite : tous les comptages égaux à ceux de la sauvegarde, aucune contrainte non validée, aucun orphelin, `GET /api/health` répond 200, une connexion d'un compte de test réussit. Noter la durée de `pg_restore` : c'est le temps de reprise minimal à annoncer en cas d'incident.

## 4. Avant une mise en ligne (le déploiement est automatique : Watchtower tire `latest` toutes les 60 s)

1. Arrêter Watchtower pendant la fenêtre de mise en ligne : `docker stop watchtower` (il n'applique alors rien tout seul).
2. Faire la sauvegarde du §2, vérifier la somme de contrôle, **réussir un test du §3 au moins une fois avant la première mise en ligne**.
3. Noter l'étiquette et l'empreinte de l'image en service : `docker inspect --format '{{.Config.Image}} {{.Image}}' app-comptable`.
4. Après la publication par la CI, tirer et lancer la nouvelle image à la main : `docker compose pull app-comptable && docker compose up -d app-comptable`, puis les vérifications du fichier `RELEASE_CHECKLIST.md`.
5. Ne redémarrer Watchtower qu'après validation.

## 5. Récupération après un déploiement raté

Voir la stratégie détaillée dans `RELEASE_CHECKLIST.md` (§ « Retour arrière et récupération »). En résumé : **corriger en avançant** ; un retour à l'ancienne image ne casse pas la base (le schéma ajouté est compatible) mais les comptes déjà convertis ne peuvent plus se connecter avec l'ancienne version. Ne jamais restaurer une ancienne sauvegarde par-dessus des données plus récentes sans avoir chiffré la perte : toute saisie faite depuis la sauvegarde disparaît.

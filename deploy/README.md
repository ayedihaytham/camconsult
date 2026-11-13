# Déploiement — VPS (Docker Hub + Watchtower)

Le VPS ne contient **que ce dossier** (`docker-compose.yml`, `nginx-camconsult.conf`,
`.env`) — jamais le code source. Les images sont construites par GitHub
Actions à chaque push sur `main` et poussées sur Docker Hub
(`merba7/app-comptable`, `merba7/camconsult-site`) ; le service
`watchtower` du `docker-compose.yml` les tire et relance les conteneurs tout
seul (vérification toutes les 60s).

## 0. Deux environnements : test et production

| | **Test** | **Production** |
| --- | --- | --- |
| Adresse | `https://test.camconsult.com.tn` | `https://cabinet.camconsult.com.tn` |
| Branche Git | `main` | `production` |
| Image Docker | `merba7/app-comptable:test` | `merba7/app-comptable:latest` |
| Pile Docker | `docker-compose.test.yml` (projet `camconsult-test`) | `docker-compose.yml` |
| Base de données | propre (volume `camconsult_test_pgdata`), données de démonstration | propre (volume `camconsult_pgdata`), données réelles |
| Port interne | `127.0.0.1:5182` | `127.0.0.1:5181` |
| Modules | **tous** (`MODULES_ACTIFS="*"`) + bandeau « Environnement de test » | seulement ceux de `MODULES_ACTIFS` |

**Modules ouverts en production** (liste validée) : Tableau de bord, Mes tâches, Messagerie, Sociétés, Collectes de pièces,
Structuration, Stock, Journal, Cours de change, Suivi client devise, Équipe, Conversions, Paramètres. Les autres (Facturation,
Honoraires, Fournisseurs, Apurement TVA, Suivi bancaire, Souche de chèques, Bordereaux, États financiers, État SWIFT,
Simulation de paie, AFFECTAT) sont cachés du menu, renvoient à l'accueil et leur API répond 403 — la règle est appliquée par le
serveur (`app comptabole/shared/modules.js`, `server/modules.js`). Fournisseurs, Suivi bancaire et État SWIFT n'ont **pas de page**
en production, mais leur API reste lisible parce que le Stock et les Collectes s'en servent. Tous les rôles peuvent se connecter ;
ils voient seulement les modules ouverts.

### Mettre un module en production
1. Le valider sur le test (tous les rôles concernés).
2. Ajouter sa clé à `MODULES_ACTIFS` dans le `.env` de production du VPS (clés dans `shared/modules.js`), puis
   `docker compose up -d` (le serveur relit la variable au démarrage). Aucun nouveau code n'est nécessaire.

### Publier une version en production
Le test reçoit automatiquement chaque `git push` sur `main`. La production ne bouge **que** lorsque la branche `production`
avance, sur un commit déjà essayé sur le test :

```bash
git fetch origin
git push origin origin/main:production      # avance `production` jusqu'au dernier commit validé en test
```

Pour ne promouvoir qu'une version précise : `git push origin <sha>:production`. Retour arrière : `git push --force-with-lease
origin <ancien-sha>:production` (ou relancer l'image `app-comptable:prod-<ancien-sha>` à la main).

### Créer l'environnement de test (une seule fois)
1. **DNS** : enregistrement A `test.camconsult.com.tn` → `102.204.205.214` (comme `cabinet.`).
2. **VPS** : mettre à jour `/opt/camconsult` (`docker-compose.yml`, `docker-compose.test.yml`, `.env.test`), puis :
   ```bash
   cd /opt/camconsult
   cp .env.test.example .env.test && nano .env.test        # mots de passe et JWT_SECRET DIFFÉRENTS de la production
   docker compose -f docker-compose.test.yml --env-file .env.test up -d
   docker compose -f docker-compose.test.yml --env-file .env.test ps
   ```
3. **Nginx** : ajouter à la main (voir l'avertissement « Mettre à jour » plus bas) le bloc `test.camconsult.com.tn` de
   `nginx-camconsult.conf` dans le fichier live, puis `nginx -t && systemctl reload nginx`.
4. **HTTPS** : `certbot --nginx -d test.camconsult.com.tn`.
5. Recommandé : protéger le test (mot de passe nginx ou liste d'IP, lignes commentées dans le bloc) — il ne doit contenir aucune
   donnée réelle.
6. **Première publication** : `git push origin main` construit l'image `:test` (Watchtower la tire sous 60 s). L'image `:test`
   doit exister avant l'étape 2.

> ⚠️ **Avant la première publication de la branche `production`** : la production actuelle est servie par `:latest`, mise à jour à
> chaque push sur `main` jusqu'ici. Désormais `main` ne publie plus que `:test` ; `:latest` ne change que sur `production`.
> La nouvelle image de production applique par défaut la liste de modules validés même si `MODULES_ACTIFS` est absent du `.env`.

## 1. Prérequis GitHub (une seule fois)

Dans le dépôt `ayedihaytham/camconsult` sur github.com → **Settings → Secrets
and variables → Actions → New repository secret**, ajouter :

| Secret | Valeur |
| --- | --- |
| `DOCKERHUB_USERNAME` | `merba7` |
| `DOCKERHUB_TOKEN` | un **access token** Docker Hub (pas ton mot de passe) — généré sur hub.docker.com → Account Settings → Security → New Access Token, permission "Read & Write" |

Dès qu'un push touche `app comptabole/**` ou `camconsult/**` sur `main`,
le workflow correspondant build + push l'image automatiquement.

## 2. Sur le VPS — installer Docker (une seule fois)

```bash
curl -fsSL https://get.docker.com | sh
```

(Nginx, PostgreSQL-client, certbot ne sont **plus nécessaires** en paquets —
si tu avais suivi l'ancien guide `DEPLOIEMENT-VPS.md` PM2, Nginx reste utile
comme reverse-proxy ci-dessous ; PM2 et le PostgreSQL apt peuvent rester
installés sans gêner, ou être supprimés plus tard, au choix.)

## 3. Envoyer ce dossier sur le VPS

Depuis ton PC, uniquement ce dossier `deploy/` (pas les projets) :

```bash
scp -r deploy root@102.204.205.214:/opt/camconsult
```

## 4. Configurer `.env`

```bash
ssh root@102.204.205.214
cd /opt/camconsult
cp .env.example .env
nano .env        # DB_PASSWORD, JWT_SECRET (openssl rand -hex 48), ADMIN_PASSWORD...
                  # ANTHROPIC_API_KEY (Claude) : extraction des
                  # pièces du module Stock par un modèle de vision (voir
                  # app comptabole/server/ocr.js). Il n'y a plus d'OCR local :
                  # sans clé (ni moteur RUSPINA), l'import automatique est refusé.
                  # SMTP_* est facultatif (envoi d'emails réel, voir
                  # app comptabole/server/mailer.js) — sans ça, l'envoi est
                  # simplement sauté (aucun blocage).
```

## 5. Lancer

```bash
docker compose up -d
docker compose ps        # les 4 conteneurs (db, app-comptable, camconsult-site, watchtower) doivent être "Up"
```

## 6. Nginx (reverse-proxy, sur l'hôte — déjà installé)

```bash
cp nginx-camconsult.conf /etc/nginx/sites-available/camconsult.com.tn
ln -s /etc/nginx/sites-available/camconsult.com.tn /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

## 7. HTTPS (une fois le DNS propagé)

```bash
certbot --nginx -d camconsult.com.tn -d www.camconsult.com.tn -d cabinet.camconsult.com.tn
```

## 8. Monitoring (Dozzle)

Dozzle affiche les logs en direct et les métriques (CPU/RAM/réseau) de
chaque conteneur, avec possibilité de start/stop/restart, protégé par un
mot de passe. Empreinte négligeable (~20 Mo RAM).

**8.1. Créer le DNS (à faire vous-même)** — chez votre registrar/DNS, un
enregistrement A `monitor.camconsult.com.tn` → l'IP du VPS
(`102.204.205.214`), identique aux entrées existantes pour `cabinet.` et
`www.`. Attendez la propagation avant l'étape certbot.

**8.2. Générer `users.yml`** — sur le VPS, dans `/opt/camconsult` :

```bash
docker run -it --rm amir20/dozzle generate admin \
  --name "Admin" > users.yml
# (tape le mot de passe désiré quand demandé — n'apparaît pas dans
# l'historique du shell contrairement à --password)
```

Ce fichier contient le hash du mot de passe (jamais en clair) ; il n'est
**jamais committé** dans le dépôt (déjà couvert par le `.gitignore`
existant, au même titre que `.env`).

**8.3. Lancer** :

```bash
docker compose up -d
docker compose ps       # "dozzle" doit être "Up"
```

**8.4. Nginx** (comme à l'étape 6, le nouveau bloc `monitor.camconsult.com.tn`
est déjà dans `nginx-camconsult.conf`) :

```bash
cp nginx-camconsult.conf /etc/nginx/sites-available/camconsult.com.tn
nginx -t && systemctl reload nginx
```

**8.5. HTTPS** (une fois le DNS propagé) :

```bash
certbot --nginx -d monitor.camconsult.com.tn
```

Accès ensuite sur `https://monitor.camconsult.com.tn`, identifiant/mot de
passe définis à l'étape 8.2.

## 9. Moteur d'extraction RUSPINA (module Stock) — optionnel

Un service OCR dédié (conteneur Docker `ocr-ruspina`) lit les dossiers de
trois pièces — facture du producteur (achat), facture RUSPINA (vente) et
déclaration douanière — avec un contrat de champs figé par page. L'application
l'appelle depuis le serveur (`app comptabole/server/ruspinaOcr.js`) pour les
sociétés dont la raison sociale contient `ruspina` (réglable avec
`RUSPINA_OCR_SOCIETES`). Pour toute autre société, ou si le service est
absent / en échec / demande une revue de routage, le modèle de vision
(Claude) prend le relais ; sans clé, l'import automatique est
refusé avec un message clair.

L'image est fournie en archive (`.tar`), elle n'est pas sur Docker Hub :

```bash
# 1. Copier l'archive sur le VPS puis vérifier son empreinte
sha256sum -c ocr-ruspina-3.1.tar.sha256
docker load -i ocr-ruspina-3.1.tar
docker image inspect ocr-ruspina:3.1 --format '{{.Id}} {{.Os}}/{{.Architecture}} {{.Config.User}}'

# 2. Démarrer la pile AVEC le moteur
cd /opt/camconsult
docker compose -f docker-compose.yml -f docker-compose.ocr.yml up -d
docker compose ps        # "ocr-ruspina" doit passer à "healthy"
```

- Aucun port n'est publié : seul `app-comptable` joint le service, sur le
  réseau interne Docker (il n'a pas d'authentification).
- Un seul conteneur et un seul worker (les sessions de revue de routage sont
  en mémoire). Prévoir ~0,8 Go de RAM et, sur CPU, de quelques dizaines de
  secondes à plusieurs minutes par dossier de trois pages : l'écran Stock
  suit l'extraction en tâche de fond (`GET /api/stock/extract-jobs/:id`).
- Pour revenir à l'extraction habituelle : `docker compose up -d` (sans le
  fichier `docker-compose.ocr.yml`).
- Les mises à jour de l'image sont manuelles (pas de Watchtower) : charger la
  nouvelle archive, puis relancer la commande de l'étape 2.

## Mettre à jour

- **Test** : `git push` sur `main` → GitHub Actions construit l'image `:test` → Watchtower la détecte (≤ 60 s) et relance
  `app-comptable-test`.
- **Production** : `git push origin origin/main:production` (voir « Publier une version en production ») → image `:latest` →
  Watchtower relance `app-comptable`.

Vérifier après coup :

```bash
docker compose logs -f watchtower
```

**Exception : `nginx-camconsult.conf`** — nginx tourne sur l'hôte, pas dans
un conteneur, donc il n'est jamais mis à jour par Watchtower.

⚠️ **Ne jamais faire `cp nginx-camconsult.conf /etc/nginx/sites-available/camconsult.com.tn`
sur un fichier déjà en place** (vécu deux fois) : ce fichier source ne contient
que les blocs `listen 80` — certbot ajoute lui-même les blocs `listen 443
ssl` + certificats directement dans le fichier live (jamais reportés ici),
et un `cp` complet les efface. Pour une modification, éditer le fichier
**live** à la main (`nano /etc/nginx/sites-available/camconsult.com.tn`) et
reporter le même changement dans `nginx-camconsult.conf` pour que le dépôt
reste à jour, plutôt que l'inverse. En cas d'effacement accidentel des blocs
HTTPS : `certbot --nginx -d camconsult.com.tn -d www.camconsult.com.tn -d
cabinet.camconsult.com.tn` (option "reinstall existing certificate") les
recrée.

```bash
nano /etc/nginx/sites-available/camconsult.com.tn   # reporter le changement à la main
nginx -t && systemctl reload nginx
```

### Réglages hôte qui ne sont PAS dans ce dépôt

Deux réglages vivent uniquement dans les fichiers système du VPS (jamais
touchés par git/Watchtower/certbot) — à refaire après une réinstallation de
l'hôte ou un nouveau VPS :

- **HTTP/2** — sur chaque `listen 443 ssl;` (et `listen [::]:443 ssl;`) du
  fichier live `/etc/nginx/sites-available/camconsult.com.tn`, ajouter
  `http2` : `listen 443 ssl http2;` (nginx < 1.25.1 — au-delà, préférer la
  directive séparée `http2 on;`).
- **Compression gzip** — dans `/etc/nginx/nginx.conf`, bloc « Gzip Settings »
  (décommenté) :
  ```nginx
  gzip on;
  gzip_vary on;
  gzip_proxied any;
  gzip_comp_level 6;
  gzip_buffers 16 8k;
  gzip_http_version 1.1;
  gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript application/wasm image/svg+xml font/woff2;
  ```
  Le `gzip_proxied any;` est indispensable ici : tout est servi via
  `proxy_pass`, et nginx ne compresse jamais une réponse proxifiée sans lui.
  Vérifier après coup : `curl -sI -H "Accept-Encoding: gzip" https://cabinet.camconsult.com.tn/assets/index-*.js | grep -i content-encoding` doit répondre `gzip`.

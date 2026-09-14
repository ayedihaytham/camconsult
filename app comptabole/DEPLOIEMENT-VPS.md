> **Méthode actuellement utilisée : Docker Hub + Watchtower** — voir
> [`deploy/README.md`](../deploy/README.md) (à la racine du repo). Ce guide-ci
> (PM2, sans Docker) reste valable comme méthode alternative si tu préfères
> déployer manuellement sans CI, mais duplique le travail de mise à jour à
> chaque changement.

# Déploiement sans cPanel — VPS Ubuntu (camconsult.com.tn)

Cible : un **VPS** (OxaHost ou autre) sous **Ubuntu 22.04 / 24.04**, avec accès
**SSH root** (ou sudo). **Deux applications séparées** tournent sur le même
VPS, chacune dans son propre process **PM2**, derrière **Nginx** qui route
selon le (sous-)domaine et gère le HTTPS :

- `camconsult.com.tn` / `www` → **site vitrine** (`camconsult/`, Next.js,
  PM2 `camconsult-site`, port 3000).
- `cabinet.camconsult.com.tn` → **app comptable** (ce dossier, `app comptabole/`,
  PM2 `app-comptable`, port 5181).

Schéma :

```
Internet ─┬─▶ Nginx :80/:443 ─┬─ camconsult.com.tn / www ──▶ Node :3000 (site vitrine)
          │                   └─ cabinet.camconsult.com.tn ────▶ Node :5181 (app comptable) ──▶ PostgreSQL
```

Les étapes 1 à 7 déploient l'**app comptable**. La section « Déployer le
site vitrine » (après l'étape 7) déploie **camconsult/**. Les étapes 8 à 11
(Nginx, DNS, HTTPS, vérification) couvrent les **deux** applications d'un
coup, car elles partagent le même VPS et le même fichier de config Nginx.

---

## Étape 1 — Se connecter au VPS

Depuis ton PC :

```bash
ssh root@IP_DU_VPS
```

(l'IP et le mot de passe root sont dans l'e-mail OxaHost de livraison du VPS)

---

## Étape 2 — Installer les prérequis

Envoie le projet une première fois (ou juste le script), puis :

```bash
# si tu as déjà cloné le repo :
sudo bash deploy/setup-vps.sh
```

Ou sans le repo, en une ligne :

```bash
sudo apt-get update && sudo apt-get install -y curl git nginx postgresql ufw \
  certbot python3-certbot-nginx \
&& curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash - \
&& sudo apt-get install -y nodejs \
&& sudo npm install -g pm2 \
&& sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw --force enable
```

Vérifie : `node -v` doit afficher `v20.x`.

---

## Étape 3 — Créer la base PostgreSQL

```bash
sudo -u postgres psql <<'SQL'
CREATE DATABASE cabinet;
CREATE USER cabinet WITH PASSWORD 'CHANGE_MOI_mot_de_passe_fort';
GRANT ALL PRIVILEGES ON DATABASE cabinet TO cabinet;
\c cabinet
GRANT ALL ON SCHEMA public TO cabinet;
SQL
```

L'URL de connexion sera :
`postgres://cabinet:CHANGE_MOI_mot_de_passe_fort@localhost:5432/cabinet`

---

## Étape 4 — Récupérer le code (app comptable)

```bash
sudo mkdir -p /var/www && cd /var/www
sudo git clone VOTRE_DEPOT app-comptable      # ou : envoyez un .zip et décompressez ici
sudo chown -R $USER:$USER /var/www/app-comptable
cd /var/www/app-comptable
```

> Pas de dépôt Git ? Depuis ton PC : `scp projet.zip root@IP:/var/www/` puis
> `cd /var/www && unzip projet.zip -d app-comptable`.
> Le `.zip` peut **exclure** `node_modules/` et `.env`.

---

## Étape 5 — Configuration (`.env`)

```bash
cp .env.production.example .env
nano .env
```

Renseigne :

```
NODE_ENV=production
API_PORT=5181
CORS_ORIGIN=https://cabinet.camconsult.com.tn
DATABASE_URL=postgres://cabinet:CHANGE_MOI_mot_de_passe_fort@localhost:5432/cabinet
JWT_SECRET=<colle : openssl rand -hex 48>
ADMIN_IDENTIFIANT=mohamed.ayedi
ADMIN_PASSWORD=<mot de passe admin de départ>
ADMIN_NOM=Mohamed Ayedi
ADMIN_ROLE=Expert-comptable — Responsable du cabinet
```

Génère le secret : `openssl rand -hex 48`

---

## Étape 6 — Installer + construire

```bash
npm install               # toutes les dépendances (dont vite pour le build)
npm run build             # crée dist/  (tsc + vite)
```

Test rapide :

```bash
node server/index.js
# -> [api] écoute sur le port 5181 ... — sert dist/
# Ctrl+C pour arrêter
```

---

## Étape 7 — Lancer avec PM2 (démarrage permanent)

```bash
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup            # copie-colle et exécute la ligne que PM2 affiche
```

Commandes utiles : `pm2 logs app-comptable` · `pm2 restart app-comptable` · `pm2 status`

---

## Déployer le site vitrine (`camconsult/`)

Même principe, dans un dossier séparé, avec son propre process PM2 :

```bash
cd /var/www
sudo git clone VOTRE_DEPOT camconsult-site      # ou : .zip, comme à l'étape 4
sudo chown -R $USER:$USER /var/www/camconsult-site
cd /var/www/camconsult-site

cp .env.example .env
nano .env               # NEXT_PUBLIC_CLIENT_PORTAL_URL=https://cabinet.camconsult.com.tn/login

corepack enable          # active pnpm (packageManager défini dans package.json)
pnpm install
pnpm run build            # crée .next/

pm2 start ecosystem.config.cjs
pm2 save
```

Commandes utiles : `pm2 logs camconsult-site` · `pm2 restart camconsult-site`

---

## Étape 8 — Nginx (les deux domaines)

Le fichier `deploy/nginx-camconsult.conf` (dans `app comptabole/`) contient
**deux blocs `server`** — un pour `camconsult.com.tn`/`www` (site vitrine,
:3000) et un pour `cabinet.camconsult.com.tn` (app comptable, :5181) :

```bash
sudo cp deploy/nginx-camconsult.conf /etc/nginx/sites-available/camconsult.com.tn
sudo ln -s /etc/nginx/sites-available/camconsult.com.tn /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

---

## Étape 9 — DNS : pointer les (sous-)domaines

Chez le gestionnaire DNS du domaine (OxaHost ou registrar `.tn`), crée :

| Type | Nom   | Valeur          |
| ---- | ----- | --------------- |
| A    | `@`   | **IP du VPS**   |
| A    | `www` | **IP du VPS**   |
| A    | `cabinet` | **IP du VPS**   |

Attends la propagation (`ping camconsult.com.tn` et `ping cabinet.camconsult.com.tn`
doivent renvoyer l'IP du VPS).

---

## Étape 10 — HTTPS (Let's Encrypt, gratuit)

Une fois le DNS propagé, un seul appel Certbot pour les trois noms
(il configure les deux blocs `server` du fichier Nginx) :

```bash
sudo certbot --nginx -d camconsult.com.tn -d www.camconsult.com.tn -d cabinet.camconsult.com.tn
```

Réponds aux questions (e-mail, redirection HTTP→HTTPS : **oui**). Le renouvellement
est automatique.

---

## Étape 11 — Vérifier

- `https://camconsult.com.tn` → site vitrine.
- `https://camconsult.com.tn` → clic sur « Espace client » → ouvre
  `https://cabinet.camconsult.com.tn/login` dans un nouvel onglet.
- `https://cabinet.camconsult.com.tn` → page de connexion de l'app comptable.
- `https://cabinet.camconsult.com.tn/api/health` → `{"ok":true}`.
- Connexion `mohamed.ayedi` / `ADMIN_PASSWORD` → **change le mot de passe** dans *Paramètres*.

---

## Mettre à jour l'application plus tard

**App comptable** (`/var/www/app-comptable`) :

```bash
cd /var/www/app-comptable
git pull                 # ou ré-upload
npm install               # si dépendances modifiées
npm run build             # si le front a changé
pm2 restart app-comptable
```

(script tout-en-un : `bash deploy/update.sh`)

**Site vitrine** (`/var/www/camconsult-site`) :

```bash
cd /var/www/camconsult-site
git pull
pnpm install
pnpm run build
pm2 restart camconsult-site
```

---

## Sauvegarde de la base (recommandé, via cron)

```bash
# sauvegarde quotidienne dans /var/backups/camconsult
sudo mkdir -p /var/backups/camconsult
( crontab -l 2>/dev/null; echo '15 3 * * * pg_dump -U cabinet -h localhost cabinet | gzip > /var/backups/camconsult/cabinet-$(date +\%F).sql.gz' ) | crontab -
```

---

## Dépannage

| Symptôme | Action |
| --- | --- |
| `502 Bad Gateway` sur `cabinet.camconsult.com.tn` | Node (app comptable) ne tourne pas : `pm2 status`, `pm2 logs app-comptable`. |
| `502 Bad Gateway` sur `camconsult.com.tn` | Node (site vitrine) ne tourne pas : `pm2 status`, `pm2 logs camconsult-site`. |
| `Impossible de préparer la base de données` | `DATABASE_URL` faux, ou droits PG manquants (refaire l'étape 3, dont le `GRANT ALL ON SCHEMA public`). |
| `413 Request Entity Too Large` à l'import de fichier | `client_max_body_size` absent du bloc Nginx `cabinet.camconsult.com.tn` → remets `15M` et `reload`. |
| `certbot` échoue | Le DNS ne pointe pas encore vers le VPS (vérifie aussi le sous-domaine `app`). Attends, puis relance. |
| Page blanche sur `cabinet.camconsult.com.tn` | `dist/` manquant côté app comptable : `npm run build` puis `pm2 restart app-comptable`. |
| Page blanche / erreur sur `camconsult.com.tn` | `.next/` manquant côté site vitrine : `pnpm run build` puis `pm2 restart camconsult-site`. |
| 500 à la connexion | `JWT_SECRET` vide dans le `.env` de l'app comptable. |
| « Espace client » ne s'ouvre pas sur la bonne URL | Vérifie `NEXT_PUBLIC_CLIENT_PORTAL_URL` dans le `.env` du site vitrine, puis rebuild (`pnpm run build`, c'est une variable lue au build). |

---

## Je n'ai pas de VPS

- **OxaHost VPS** : prends la plus petite offre (1 vCPU / 1–2 Go RAM suffit), Ubuntu 22.04.
- **Alternative sans serveur à gérer** : Render.com (service Web Node + PostgreSQL managé, domaine perso `camconsult.com.tn` via un enregistrement DNS). Dis-le-moi et je te fais ce guide-là.

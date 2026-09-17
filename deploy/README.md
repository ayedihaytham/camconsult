# Déploiement — VPS (Docker Hub + Watchtower)

Le VPS ne contient **que ce dossier** (`docker-compose.yml`, `nginx-camconsult.conf`,
`.env`) — jamais le code source. Les images sont construites par GitHub
Actions à chaque push sur `main` et poussées sur Docker Hub
(`merba7/app-comptable`, `merba7/camconsult-site`) ; le service
`watchtower` du `docker-compose.yml` les tire et relance les conteneurs tout
seul (vérification toutes les 60s).

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
                  # ANTHROPIC_API_KEY est facultative (extraction OCR par Claude,
                  # voir app comptabole/server/claudeExtract.js) — sans elle,
                  # l'appli retombe automatiquement sur l'OCR local gratuit.
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

## Mettre à jour

Rien à faire manuellement : `git push` sur `main` → GitHub Actions build +
push l'image → Watchtower la détecte (≤ 60s) et relance le conteneur
concerné automatiquement. Vérifier après coup :

```bash
docker compose logs -f watchtower
```

**Exception : `nginx-camconsult.conf`** — nginx tourne sur l'hôte, pas dans
un conteneur, donc il n'est jamais mis à jour par Watchtower. Après une
modification de ce fichier, sur le VPS :

```bash
cp nginx-camconsult.conf /etc/nginx/sites-available/camconsult.com.tn
nginx -t && systemctl reload nginx
```

# Application de gestion de cabinet comptable

Frontend **React + TypeScript + Vite + Tailwind** et backend **Node (Express) + PostgreSQL** (API REST).

## Prérequis

- Node.js 20+
- Docker (pour la base PostgreSQL fournie) — ou un PostgreSQL existant

## Démarrage (première fois)

```bash
npm install

# 1. Base de données PostgreSQL (conteneur Docker, port 5439)
npm run db:up

# 2. Fichier de configuration
cp .env.example .env        # ajustez si besoin (identifiants admin, secret JWT…)

# 3. Schéma + compte administrateur
npm run db:init

# 4. Lancer l'API + le front en parallèle
npm run dev
```

- Front : http://localhost:5180
- API  : http://localhost:5181 (proxyfiée sous `/api` par Vite)

**Connexion administrateur par défaut** (modifiable dans `.env` avant `db:init`,
puis depuis l'écran *Paramètres*) :

| Identifiant       | Mot de passe   |
| ---------------- | -------------- |
| `mohamed.ayedi`  | `Cabinet2026!` |

Les collaborateurs se connectent avec l'identifiant et le mot de passe de leur
fiche (créés par l'administrateur), si leur statut est « actif ».

## Scripts

| Script            | Rôle                                                   |
| ----------------- | ----------------------------------------------------- |
| `npm run dev`     | API (`node --watch`) + front (Vite) en parallèle      |
| `npm run dev:web` | Front seul                                             |
| `npm run dev:api` | API seule                                             |
| `npm run db:up` / `db:down` | Démarre / arrête le conteneur PostgreSQL     |
| `npm run db:init` | Applique `server/schema.sql` + crée le compte admin   |
| `npm run build`   | `tsc --noEmit` + build de production Vite             |
| `npm start`       | Sert l'API **et** le build (`dist/`) sur un seul port |
| `npm test`        | Tests unitaires (Vitest)                              |

## Production

```bash
npm run build          # génère dist/  (ou `npm run build:prod` = vite seul, sans tsc)
NODE_ENV=production DATABASE_URL=... JWT_SECRET=... CORS_ORIGIN=https://cabinet.camconsult.com.tn \
  node server/index.js
```

Quand `dist/` existe, l'API le sert directement (fallback SPA inclus) : **un seul
processus, un seul port**. Le serveur lit `process.env.PORT` (fixé par
Passenger/cPanel), sinon `API_PORT`.

Guides de déploiement :

- **Docker + domaine `camconsult.com.tn` — tunnel Cloudflare (gratuit, sans VPS,
  marche derrière CGNAT) → [DEPLOIEMENT-DOMAINE-CLOUDFLARE.md](DEPLOIEMENT-DOMAINE-CLOUDFLARE.md)**.
- **Docker + domaine via ton IP publique** (Caddy + redirection de ports) →
  [DEPLOIEMENT-IP-PUBLIQUE.md](DEPLOIEMENT-IP-PUBLIQUE.md).
- **Docker, accès réseau local uniquement → [DEPLOIEMENT-DOCKER.md](DEPLOIEMENT-DOCKER.md)**
  — `docker compose -f docker-compose.prod.yml up -d --build`, puis
  `http://IP-DE-CETTE-MACHINE:8080`.
- **Sans cPanel — VPS Ubuntu (SSH) → [DEPLOIEMENT-VPS.md](DEPLOIEMENT-VPS.md)**
  (Nginx + PM2 + Let's Encrypt ; fichiers prêts dans `deploy/`).
- **OxaHost mutualisé cPanel → [DEPLOIEMENT-OXAHOST.md](DEPLOIEMENT-OXAHOST.md)**.

Modèle de configuration serveur : [.env.production.example](.env.production.example).

## Architecture

```
server/                API REST Express + PostgreSQL
  schema.sql           DDL
  migrate.js           npm run db:init
  auth.js              JWT + middlewares requireAuth / requireAdmin + scoping
  permissions.js       droits par défaut selon le rôle
  routes/*.js          societes, employes, noeuds, messages, journal, data
src/
  lib/api.ts           client fetch (jeton Bearer, gestion d'erreurs)
  store/auth.ts        session (login / restore / logout)
  store/data.ts        données du cabinet (hydrate + actions -> API)
  store/journal.ts     lecture du journal (alimenté automatiquement côté serveur)
  hooks/usePermissions.ts   droits lus depuis la session
```

Les permissions sont **appliquées côté serveur** (chaque route vérifie le rôle,
le périmètre société et le droit concerné) *et* côté client (masquage des
actions). Le journal d'activité est alimenté automatiquement par l'API.

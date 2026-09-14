# Déploiement sur OxaHost (mutualisé cPanel) — camconsult.com.tn

Cible : hébergement **mutualisé cPanel** OxaHost, **PostgreSQL disponible**.
L'application tourne en **un seul processus Node** qui sert à la fois l'API et
le site (le dossier `dist/`). Aucun serveur web séparé à configurer.

---

## 0. Ce dont vous avez besoin

- Accès **cPanel** de l'hébergement.
- Le domaine **camconsult.com.tn** rattaché à cet hébergement (voir §1).
- Node.js **18 ou 20** proposé par cPanel (« Setup Node.js App »).
- Idéalement l'outil **Terminal** dans cPanel (sinon on build en local, §4-A).

---

## 1. Faire pointer le domaine

Dans **cPanel → Domaines** (ou « Domaines complémentaires ») : ajoutez
`camconsult.com.tn` s'il n'y est pas déjà. Notez l'**IP partagée** du serveur
(colonne latérale de cPanel : *Adresse IP partagée*).

Puis, chez le registrar du `.tn` :

- **Domaine acheté chez OxaHost** → rien à faire, la zone DNS est déjà bonne.
- **Domaine géré ailleurs** → deux possibilités :
  - pointer les **serveurs de noms** vers ceux d'OxaHost (indiqués dans votre
    e-mail de bienvenue OxaHost, du type `ns1.oxahost.com.tn` /
    `ns2.oxahost.com.tn`) ;
  - ou créer les enregistrements **A** :
    `camconsult.com.tn` → *IP partagée*, et `www` → *IP partagée*.

La propagation d'un `.tn` peut prendre quelques heures.

---

## 2. Créer la base PostgreSQL

**cPanel → Bases de données → PostgreSQL Databases** :

1. **Créer une base** : nom `cabinet` → elle devient `LOGIN_cabinet`
   (préfixée par votre login cPanel).
2. **Créer un utilisateur** : nom `dbuser` + mot de passe fort →
   `LOGIN_dbuser`.
3. **Ajouter l'utilisateur à la base** avec **tous les privilèges**.

Vous obtenez ainsi l'URL de connexion :

```
postgres://LOGIN_dbuser:MOT_DE_PASSE@localhost:5432/LOGIN_cabinet
```

> Le schéma (tables) et le compte administrateur sont créés **automatiquement**
> au premier démarrage de l'application. Rien à importer.

---

## 3. Déposer le code sur le serveur

Placez le projet dans un dossier **hors de `public_html`**, par ex.
`~/camconsult-app`.

- **Via Git** (cPanel → *Git Version Control*, ou Terminal) :
  `git clone <votre dépôt> ~/camconsult-app`
- **Via ZIP** : compressez le projet **sans** `node_modules/` ni `.env`,
  envoyez-le avec le *Gestionnaire de fichiers* et extrayez-le dans
  `~/camconsult-app`.

Créez le fichier **`~/camconsult-app/.env`** à partir de
[.env.production.example](.env.production.example) et remplissez :

```
NODE_ENV=production
CORS_ORIGIN=https://camconsult.com.tn
DATABASE_URL=postgres://LOGIN_dbuser:MOT_DE_PASSE@localhost:5432/LOGIN_cabinet
JWT_SECRET=<longue chaîne aléatoire>
ADMIN_IDENTIFIANT=mohamed.ayedi
ADMIN_PASSWORD=<mot de passe admin initial>
ADMIN_NOM=Mohamed Ayedi
ADMIN_ROLE=Expert-comptable — Responsable du cabinet
```

> Générez `JWT_SECRET` avec `openssl rand -hex 48` (Terminal) ou n'importe quel
> générateur de chaîne longue.

---

## 4. Installer les dépendances et construire le site

### Option A — build en local (recommandé en mutualisé)

Sur **votre machine** :

```bash
npm install
npm run build        # génère dist/
```

Envoyez ensuite le dossier **`dist/`** dans `~/camconsult-app/dist` (Gestionnaire
de fichiers ou Git). Sur le serveur, il ne restera qu'à installer les
dépendances **de production** (§5, bouton *Run NPM Install*).

### Option B — build sur le serveur (si Terminal disponible)

```bash
cd ~/camconsult-app
source ~/nodevenv/camconsult-app/20/bin/activate   # commande donnée par cPanel à l'étape 5
npm run deploy:build                                # install (avec devDeps) + vite build
```

---

## 5. Créer l'application Node dans cPanel

**cPanel → Logiciel → Setup Node.js App → Create Application** :

| Champ | Valeur |
| --- | --- |
| **Node.js version** | 20 (ou 18) |
| **Application mode** | Production |
| **Application root** | `camconsult-app` |
| **Application URL** | `camconsult.com.tn` (laisser le sous-dossier **vide**) |
| **Application startup file** | `server/index.js` |

Dans **Environment variables**, ajoutez les mêmes clés que le `.env`
(`NODE_ENV`, `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `ADMIN_*`).
*Ne définissez pas `PORT`* : cPanel s'en charge.

Cliquez **Create**, puis **Run NPM Install** (installe `express`, `pg`,
`bcryptjs`, `jsonwebtoken`, `cors`, `dotenv`, `zod`).

---

## 6. Initialiser et démarrer

- La base s'initialise toute seule au premier appel. Pour la préparer tout de
  suite (Terminal) :
  ```bash
  cd ~/camconsult-app && source ~/nodevenv/camconsult-app/20/bin/activate
  npm run db:init
  ```
- Dans *Setup Node.js App*, cliquez **Restart**.

---

## 7. Activer HTTPS

**cPanel → Sécurité → SSL/TLS Status** → cochez `camconsult.com.tn` et
`www.camconsult.com.tn` → **Run AutoSSL**. Apache termine le TLS et transmet à
l'application en clair en local (`trust proxy` est déjà activé côté serveur).

---

## 8. Vérifier

1. `https://camconsult.com.tn` → page de connexion.
2. `https://camconsult.com.tn/api/health` → `{"ok":true}`.
3. Connexion avec `ADMIN_IDENTIFIANT` / `ADMIN_PASSWORD`.
4. **Changez le mot de passe admin** dans *Paramètres* juste après.

---

## 9. Mises à jour ultérieures

```bash
cd ~/camconsult-app
git pull                       # ou ré-upload
source ~/nodevenv/.../bin/activate
npm install --omit=dev         # si dépendances modifiées
npm run build:prod             # si le front a changé (ou upload d'un dist/ construit en local)
```
Puis **Restart** dans *Setup Node.js App* (ou `touch tmp/restart.txt`).

---

## 10. Dépannage

| Symptôme | Cause probable / action |
| --- | --- |
| Page blanche, `/api/health` KO | App non démarrée → *Setup Node.js App* → Restart ; vérifier les logs (`~/camconsult-app/stderr.log` ou l'onglet cPanel). |
| `Impossible de préparer la base de données` dans les logs | `DATABASE_URL` faux, ou l'utilisateur PG n'a pas les privilèges sur la base. |
| Connexion refusée « API indisponible » | Le front a été servi sans l'API — ici c'est le **même** process : cela signifie que Node ne tourne pas. Restart. |
| 500 à la connexion | `JWT_SECRET` vide ; définissez-le puis Restart. |
| Les routes `/societes`, `/login` renvoient 404 en rechargeant | Le fallback SPA est dans le serveur Node ; si 404, c'est qu'Apache sert un dossier au lieu de passer par Node → vérifier *Application URL* (racine du domaine, sous-dossier vide). |
| Node 16 seulement proposé | Demandez à OxaHost l'activation de Node 18/20 (le code est en ESM moderne). |

---

## Récapitulatif des fichiers ajoutés pour la prod

- `.env.production.example` — modèle de configuration serveur.
- `server/index.js` — lit `process.env.PORT` (Passenger), `trust proxy`,
  CORS restreint via `CORS_ORIGIN`, sert `dist/` + fallback SPA.
- `package.json` — scripts `build:prod`, `deploy:build`, `start`.

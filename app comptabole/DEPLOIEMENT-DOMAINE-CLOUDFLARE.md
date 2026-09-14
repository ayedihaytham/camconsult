# Publier l'application sur camconsult.com.tn (tunnel Cloudflare, gratuit)

Ton application tourne en Docker sur ta machine (port 8080). Ce guide la rend
accessible sur **https://camconsult.com.tn** depuis n'importe où, **sans VPS,
sans IP publique, sans ouvrir de port sur la box**, avec **HTTPS automatique**.

> Fonctionne tant que ta machine + Docker Desktop restent allumés. Si la machine
> s'éteint, le site est hors ligne (c'est le compromis d'un hébergement « maison »).

---

## Vue d'ensemble

```
Visiteur ─▶ https://camconsult.com.tn ─▶ Cloudflare ─▶ (tunnel sortant) ─▶ conteneur cloudflared ─▶ http://app:8080
```

---

## Étape 1 — Compte Cloudflare + ajouter le domaine

1. Crée un compte gratuit sur **https://dash.cloudflare.com** (« Sign up »).
2. **Add a site** → saisis `camconsult.com.tn` → plan **Free**.
3. Cloudflare scanne la zone puis affiche **2 serveurs de noms** du type
   `xxx.ns.cloudflare.com` / `yyy.ns.cloudflare.com`. **Note-les.**

---

## Étape 2 — Pointer le domaine vers Cloudflare

Chez le **registrar du `.tn`** (OxaHost si tu l'as acheté chez eux, ou l'espace
de gestion ATI/registrar) :

- Remplace les serveurs de noms actuels par **les 2 de Cloudflare**.
- Enregistre.

> Si tu ne trouves pas où changer les NS : ouvre un ticket OxaHost —
> *« Merci de configurer les serveurs de noms de camconsult.com.tn vers
> xxx.ns.cloudflare.com et yyy.ns.cloudflare.com »*.

La propagation prend de quelques minutes à quelques heures. Cloudflare enverra un
e-mail « camconsult.com.tn is now active on Cloudflare ».

---

## Étape 3 — Créer le tunnel

1. Dans le dashboard Cloudflare : menu **Zero Trust** (à gauche) →
   la première fois, choisis le plan **Free** (peut demander une carte, **non
   débitée** ; sinon passe par l'étape « Free » sans carte).
2. **Networks → Tunnels → Create a tunnel** → type **Cloudflared**.
3. Nom du tunnel : `camconsult` → **Save tunnel**.
4. Écran « Install and run a connector » → **copie la valeur du jeton** : dans la
   commande affichée (`cloudflared ... --token eyJ...`), copie **tout ce qui suit
   `--token `** (une longue chaîne). C'est ton `CLOUDFLARE_TUNNEL_TOKEN`.
5. **Ne ferme pas la page.** Va à l'onglet **Public Hostnames** →
   **Add a public hostname** :
   - **Subdomain** : *(laisser vide)*
   - **Domain** : `camconsult.com.tn`
   - **Type** : `HTTP`
   - **URL** : `app:8080`
   - **Save**
6. (Optionnel mais conseillé) ajoute un 2e hostname identique avec **Subdomain**
   `www`.

---

## Étape 4 — Configurer et lancer

Dans le fichier **`.env`** à la racine du projet, ajoute :

```
CLOUDFLARE_TUNNEL_TOKEN=eyJ...colle_ici_le_jeton_complet...
CORS_ORIGIN=https://camconsult.com.tn
```

Puis lance le stack **avec** le tunnel :

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.tunnel.yml up -d --build
```

Vérifie le tunnel :

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.tunnel.yml logs -f cloudflared
# -> "Registered tunnel connection" (x4)  = OK
```

Dans le dashboard Cloudflare (Tunnels), le tunnel `camconsult` doit passer
**HEALTHY / Actif**.

---

## Étape 5 — Vérifier

- Ouvre **https://camconsult.com.tn** → page de connexion (cadenas HTTPS présent).
- **https://camconsult.com.tn/api/health** → `{"ok":true}`.
- Connecte-toi (`ADMIN_IDENTIFIANT` / `ADMIN_PASSWORD` du `.env`) puis **change le
  mot de passe admin** dans *Paramètres*.

---

## Au quotidien

| Besoin | Commande |
| --- | --- |
| Démarrer tout (app + tunnel) | `docker compose -f docker-compose.prod.yml -f docker-compose.tunnel.yml up -d` |
| Arrêter | `docker compose -f docker-compose.prod.yml -f docker-compose.tunnel.yml down` |
| Logs du tunnel | `... logs -f cloudflared` |
| Logs de l'appli | `... logs -f app` |
| Mettre à jour le code | `... up -d --build` |

Astuce : pour que ça redémarre tout seul au démarrage de Windows, laisse Docker
Desktop en démarrage automatique — les conteneurs ont `restart: unless-stopped`.

---

## Dépannage

| Symptôme | Action |
| --- | --- |
| `camconsult.com.tn` affiche encore l'ancienne page / erreur DNS | Les NS ne sont pas encore propagés, ou pas changés chez le registrar. Attends / vérifie l'étape 2. |
| Tunnel « DOWN » dans Cloudflare | `... logs -f cloudflared` : jeton faux (recopie tout après `--token`), ou pas d'accès Internet. |
| `502` / `Bad Gateway` sur le domaine | Le hostname public pointe sur la mauvaise URL : elle doit être **`app:8080`** (nom du service Docker), pas `localhost`. |
| Boucle de redirection / assets qui ne chargent pas | Dans Cloudflare → SSL/TLS → **mode `Full`** (pas `Flexible`). |
| Page blanche | `... logs -f app` puis `... restart app`. |

---

## Rappels

- **Gratuit** : Cloudflare Free + Tunnel = 0 DT. Seul le domaine reste payant.
- **Disponibilité** : le site est en ligne uniquement quand ta machine tourne.
  Pour du 24/7 fiable → un petit VPS (`DEPLOIEMENT-VPS.md`).
- Le tunnel ne change rien au mode `npm run dev` (ports 5180/5181), qui reste
  utilisable en parallèle.

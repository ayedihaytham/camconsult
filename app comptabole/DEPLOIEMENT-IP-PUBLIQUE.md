# Publier sur camconsult.com.tn via ton IP publique (154.108.67.71 — Ooredoo)

Ton IP `154.108.67.71` est une **vraie IP publique** (Ooredoo Tunisie, Tunis).
Ce guide fait pointer le domaine directement dessus. Caddy (dans Docker) gère le
**HTTPS automatiquement**.

> 3 conditions doivent être réunies. Si l'une échoue → bascule sur le tunnel
> Cloudflare (`DEPLOIEMENT-DOMAINE-CLOUDFLARE.md`), qui n'a besoin d'aucune
> d'entre elles.
>
> 1. l'IP est bien **publique** (pas de CGNAT) — à vérifier §1 ;
> 2. les ports **80 et 443 entrants** ne sont pas bloqués par Ooredoo — test §5 ;
> 3. l'IP est **assez stable** (elle peut changer à la reconnexion) — §7.

---

## 1. Vérifier qu'il n'y a pas de CGNAT

Connecte-toi à ta box (`http://192.168.1.1` en général) → **État / WAN / Internet**
→ relève l'**« Adresse IP WAN »**.

- Elle **est égale** à `154.108.67.71` → ✅ pas de CGNAT, continue.
- Elle est **différente** (ex. `100.64.x.x`, `10.x.x.x`) → ❌ CGNAT →
  **arrête ici**, utilise le tunnel Cloudflare.

Relève aussi l'**IP locale de ce PC** : `ipconfig` → adaptateur connecté →
« Adresse IPv4 », ex. `192.168.1.20`. On l'appelle **IP_LOCALE_PC**.

---

## 2. Enregistrements DNS (chez OxaHost)

Panneau OxaHost → **Éditeur de zone DNS** de `camconsult.com.tn`. Supprime les
éventuels A/AAAA existants sur `@` et `www`, puis ajoute :

| Type | Nom / Hôte | Valeur / Cible | TTL |
| ---- | ---------- | -------------- | ---- |
| A    | `@`        | `154.108.67.71` | 3600 |
| A    | `www`      | `154.108.67.71` | 3600 |

Enregistre. Attends 15–60 min, puis vérifie :
`nslookup camconsult.com.tn` doit renvoyer `154.108.67.71`.

---

## 3. Redirection de ports sur la box

Box → **NAT / Redirection de ports / Port Forwarding / Serveurs virtuels** →
ajoute **2 règles** vers **IP_LOCALE_PC** :

| Nom | Port externe | Protocole | IP interne | Port interne |
| --- | ------------ | --------- | ---------- | ------------ |
| web-http  | 80  | TCP | IP_LOCALE_PC | 80  |
| web-https | 443 | TCP | IP_LOCALE_PC | 443 |

(sur certaines box il faut aussi cocher UDP pour 443 — HTTP/3, optionnel)

Astuce : réserve une **IP locale fixe** pour ce PC dans la box (DHCP statique /
bail réservé) pour que la redirection ne se casse pas.

---

## 4. Pare-feu Windows

PowerShell **en administrateur** sur ce PC :

```powershell
New-NetFirewallRule -DisplayName "Web 80"  -Direction Inbound -Protocol TCP -LocalPort 80  -Action Allow
New-NetFirewallRule -DisplayName "Web 443" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
```

---

## 5. Lancer + tester les ports

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.public.yml up -d --build
```

Teste depuis l'**extérieur** (pas depuis ce PC) que les ports arrivent bien :
site comme <https://www.yougetsignal.com/tools/open-ports/> → IP `154.108.67.71`,
teste **80** puis **443**.

- Les deux **Open** → parfait.
- **80 fermé mais 443 ouvert** → OK quand même (Caddy sait obtenir le certificat
  via le port 443).
- **Les deux fermés** → Ooredoo bloque l'entrant → **tunnel Cloudflare
  obligatoire**.

---

## 6. Vérifier le site

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.public.yml logs -f caddy
# -> "certificate obtained successfully"  (1 à 2 min)
```

Puis : **https://camconsult.com.tn** → page de connexion avec le cadenas HTTPS.
`https://camconsult.com.tn/api/health` → `{"ok":true}`.
Connecte-toi puis **change le mot de passe admin** dans *Paramètres*.

Dans `.env`, ajoute pour la propreté :
```
CORS_ORIGIN=https://camconsult.com.tn
```
(puis `... up -d` pour recharger)

---

## 7. IP dynamique (important)

Si dans quelques jours le site devient injoignable alors que rien n'a changé :
ton IP publique a été **modifiée** par Ooredoo. Solutions :

- Demander une **IP fixe** à Ooredoo (souvent une option payante « IP fixe »).
- Ou installer un **client DDNS** qui met à jour un enregistrement quand l'IP
  change, et pointer `camconsult.com.tn` en CNAME vers ce nom DDNS.
- Ou passer au **tunnel Cloudflare** (insensible au changement d'IP).

---

## Commandes

| | |
| --- | --- |
| Démarrer | `docker compose -f docker-compose.prod.yml -f docker-compose.public.yml up -d` |
| Arrêter  | `docker compose -f docker-compose.prod.yml -f docker-compose.public.yml down` |
| Logs Caddy | `... logs -f caddy` |
| Mettre à jour | `... up -d --build` |

---

## Dépannage

| Symptôme | Cause / action |
| --- | --- |
| `nslookup` ne renvoie pas `154.108.67.71` | DNS pas encore propagé, ou anciens enregistrements A restants → §2. |
| Caddy : `could not get certificate` / timeout ACME | Ports 80 **et** 443 bloqués (Ooredoo) ou redirection box incorrecte → §3 / §5, sinon tunnel Cloudflare. |
| `502 Bad Gateway` | Le conteneur `app` n'est pas prêt : `... logs app`, `... restart app`. |
| Marche en HTTP mais pas en HTTPS | Port 443 non redirigé / non ouvert. |
| Marchait, puis plus rien | IP publique changée → §7. |

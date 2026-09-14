# Faire tourner l'application dans Docker (accès depuis d'autres PC du réseau)

Toute l'application (**site + API + PostgreSQL**) tourne dans **2 conteneurs
Docker** sur ta machine. Les autres postes du **même réseau local** y accèdent
via l'adresse IP de ta machine.

> ⚠️ Ceci donne un accès **réseau local (LAN)** — bureau, Wi-Fi de l'entreprise.
> Pas un accès Internet public : pour ça il faut un VPS ou un hébergeur
> (Render/Railway). Ta machine + Docker Desktop doivent rester allumés.

---

## 1. Prérequis

- **Docker Desktop** installé et démarré (tu l'as déjà).

---

## 2. Configurer les secrets

Ouvre le fichier **`.env`** à la racine du projet et vérifie / remplis :

```
JWT_SECRET=<une longue chaîne aléatoire — change la valeur par défaut>
ADMIN_IDENTIFIANT=mohamed.ayedi
ADMIN_PASSWORD=<le mot de passe admin pour se connecter à l'appli>
ADMIN_NOM=Mohamed Ayedi
ADMIN_ROLE=Expert-comptable — Responsable du cabinet
# facultatif :
# DB_PASSWORD=motdepasse_postgres
# APP_PORT=8080          # change si le port 8080 est déjà pris
```

> Les lignes `DATABASE_URL=` et `API_PORT=5181` du `.env` servent au mode
> développement (`npm run dev`) et sont **ignorées** par Docker.

---

## 3. Démarrer

Dans un terminal, à la racine du projet :

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Le premier lancement construit l'image (2–3 min). Les tables et le compte admin
sont créés automatiquement.

Vérifie :

```bash
curl http://localhost:8080/api/health      # -> {"ok":true}
```

Puis ouvre **http://localhost:8080** dans le navigateur, connecte-toi avec
`ADMIN_IDENTIFIANT` / `ADMIN_PASSWORD`, et **change le mot de passe admin** dans
*Paramètres*.

---

## 4. Accéder depuis un autre PC du réseau

### a) Trouver l'adresse IP de ta machine

```bash
ipconfig
```

Repère l'adaptateur **réellement connecté** (« Carte réseau sans fil Wi-Fi » ou
« Ethernet ») et note sa ligne **« Adresse IPv4 »**, par ex. `10.83.188.48` ou
`192.168.1.20`.
(Ignore les IP en `192.168.x.1` qui sont des adaptateurs virtuels Docker/Hyper-V.)

### b) Sur l'autre PC (même réseau)

Ouvre : **`http://IP_DE_TA_MACHINE:8080`**
(ex : `http://10.83.188.48:8080`)

### c) Si l'autre PC n'arrive pas à se connecter

1. **Réseau en profil « Privé »** (Windows) :
   *Paramètres → Réseau et Internet → Propriétés du réseau → Profil réseau =
   Privé*.
2. **Autoriser le port dans le pare-feu Windows** (PowerShell **en
   administrateur** sur ta machine) :
   ```powershell
   New-NetFirewallRule -DisplayName "Cabinet Comptable 8080" -Direction Inbound `
     -Protocol TCP -LocalPort 8080 -Action Allow -Profile Private
   ```
3. Vérifie depuis l'autre PC : `ping IP_DE_TA_MACHINE` doit répondre.

---

## 5. Commandes utiles

| Besoin | Commande |
| --- | --- |
| Voir l'état | `docker compose -f docker-compose.prod.yml ps` |
| Voir les logs | `docker compose -f docker-compose.prod.yml logs -f app` |
| Redémarrer | `docker compose -f docker-compose.prod.yml restart` |
| Arrêter | `docker compose -f docker-compose.prod.yml down` |
| Mettre à jour après modif du code | `docker compose -f docker-compose.prod.yml up -d --build` |
| **Tout effacer** (données comprises) | `docker compose -f docker-compose.prod.yml down -v` |

---

## 6. Données

Stockées dans le volume Docker **`camconsult_camconsult_pgdata`** : elles
survivent aux `restart`, `down`, et aux reconstructions d'image. Seul
`down -v` les supprime.

Sauvegarde manuelle :

```bash
docker exec camconsult-db pg_dump -U cabinet cabinet | gzip > sauvegarde-$(date +%F).sql.gz
```

---

## 7. Points importants

- **Indépendant du mode dev** : `npm run dev` (ports 5180/5181/5439) et ce stack
  Docker (port 8080) peuvent coexister ; c'est un projet Docker séparé
  (`name: camconsult`).
- **Ne fonctionne que sur le réseau local.** Pour un accès depuis l'extérieur :
  soit une redirection de port sur la box + IP publique fixe (peu recommandé),
  soit un hébergement (voir `DEPLOIEMENT-VPS.md`).
- Ta machine doit **rester allumée** avec **Docker Desktop lancé** pour que les
  collègues aient accès.

---

## 8. Dépannage

| Symptôme | Action |
| --- | --- |
| `port is already allocated` | Le port 8080 est pris. Mets `APP_PORT=8090` dans `.env` puis relance `up -d`. |
| `Definissez JWT_SECRET dans .env` | Ajoute la ligne `JWT_SECRET=...` dans `.env`. |
| App qui redémarre en boucle (`logs app`) → erreur DB | Attends que `camconsult-db` soit *healthy* ; sinon `down` puis `up -d`. |
| Autre PC : « site inaccessible » | Pare-feu (étape 4c) ou profil réseau « Public ». |
| Page blanche | `docker compose -f docker-compose.prod.yml logs app` puis `restart`. |

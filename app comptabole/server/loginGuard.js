import { createHash, timingSafeEqual } from "node:crypto";
import { query } from "./db.js";

/**
 * Protection contre la force brute sur la connexion : au-delà d'un certain nombre d'échecs, l'identifiant (depuis cette adresse)
 * ou l'adresse elle-même est bloquée pendant la fenêtre. Mémoire du processus : suffisant pour une seule instance (déploiement actuel).
 */
export function createLoginGuard({ maxParCompte = 8, maxParIdentifiant = 30, maxParAdresse = 100, fenetreMs = 15 * 60_000, maintenant = () => Date.now() } = {}) {
  const essais = new Map();

  const lire = (cle) => {
    const e = essais.get(cle);
    if (!e) return null;
    if (maintenant() - e.debut > fenetreMs) {
      essais.delete(cle);
      return null;
    }
    return e;
  };

  const cles = (adresse, identifiant) => ({
    compte: `c:${adresse}|${String(identifiant || "").toLowerCase()}`,
    identifiant: `i:${String(identifiant || "").toLowerCase()}`,
    adresse: `a:${adresse}`,
  });

  return {
    /** Secondes à attendre avant de pouvoir réessayer, ou 0 si la connexion est permise. */
    attente(adresse, identifiant) {
      const { compte, adresse: a } = cles(adresse, identifiant);
      const bloques = [
        [lire(compte), maxParCompte],
        [lire(cles(adresse, identifiant).identifiant), maxParIdentifiant],
        [lire(a), maxParAdresse],
      ].filter(([e, max]) => e && e.nb >= max);
      if (bloques.length === 0) return 0;
      const fin = Math.max(...bloques.map(([e]) => e.debut + fenetreMs));
      return Math.max(1, Math.ceil((fin - maintenant()) / 1000));
    },
    echec(adresse, identifiant) {
      for (const cle of Object.values(cles(adresse, identifiant))) {
        const e = lire(cle) ?? { nb: 0, debut: maintenant() };
        e.nb++;
        essais.set(cle, e);
      }
    },
    /** Une connexion réussie remet le compteur du compte à zéro (pas celui de l'adresse). */
    succes(adresse, identifiant) {
      essais.delete(cles(adresse, identifiant).compte);
    },
    /** Retire les entrées expirées (appelé périodiquement). */
    nettoyer() {
      for (const cle of [...essais.keys()]) lire(cle);
    },
    /** Lève le blocage d'un identifiant (tous les compteurs de compte et d'identifiant, depuis toutes les adresses). Pas celui des adresses. */
    reinitialiserIdentifiant(identifiant) {
      const id = String(identifiant || "").toLowerCase();
      for (const cle of [...essais.keys()]) if (cle === `i:${id}` || (cle.startsWith("c:") && cle.endsWith(`|${id}`))) essais.delete(cle);
    },
  };
}

/**
 * Même protection, mais enregistrée dans PostgreSQL : elle survit au redémarrage du serveur (et resterait juste avec plusieurs serveurs).
 * Mêmes règles et même interface que `createLoginGuard`, en asynchrone. Le temps est celui de la base (une seule horloge).
 * `executer` permet d'injecter un autre accès à la base (tests).
 */
export function createLoginGuardPg({ garde, maxParCompte = 8, maxParIdentifiant = 30, maxParAdresse = 100, fenetreMs = 15 * 60_000, executer = query } = {}) {
  const fenetreS = fenetreMs / 1000;
  const norm = (identifiant) => String(identifiant || "").toLowerCase();
  const portees = (adresse, identifiant) => [
    ["compte", adresse, norm(identifiant)],
    ["identifiant", "", norm(identifiant)],
    ["adresse", adresse, ""],
  ];
  const max = { compte: maxParCompte, identifiant: maxParIdentifiant, adresse: maxParAdresse };

  return {
    /** Secondes à attendre avant de pouvoir réessayer, ou 0 si la connexion est permise. */
    async attente(adresse, identifiant) {
      const id = norm(identifiant);
      const { rows } = await executer(
        `select portee, nb, ceil(extract(epoch from (debut + make_interval(secs => $4) - now())))::int as reste
           from tentatives_connexion
          where garde = $1 and debut > now() - make_interval(secs => $4)
            and ((portee = 'compte' and adresse = $2 and identifiant = $3) or (portee = 'identifiant' and identifiant = $3) or (portee = 'adresse' and adresse = $2))`,
        [garde, adresse, id, fenetreS],
      );
      const bloques = rows.filter((r) => r.nb >= max[r.portee]);
      if (bloques.length === 0) return 0;
      return Math.max(1, ...bloques.map((r) => r.reste));
    },
    /** Un échec : les trois compteurs montent ; un compteur dont la fenêtre est finie repart à 1 (une seule requête, sans course entre échecs simultanés). */
    async echec(adresse, identifiant) {
      for (const [portee, adr, id] of portees(adresse, identifiant)) {
        await executer(
          `insert into tentatives_connexion (garde, portee, adresse, identifiant, nb, debut) values ($1, $2, $3, $4, 1, now())
           on conflict (garde, portee, adresse, identifiant) do update set
             nb    = case when tentatives_connexion.debut <= now() - make_interval(secs => $5) then 1 else tentatives_connexion.nb + 1 end,
             debut = case when tentatives_connexion.debut <= now() - make_interval(secs => $5) then now() else tentatives_connexion.debut end`,
          [garde, portee, adr, id, fenetreS],
        );
      }
    },
    /** Une connexion réussie remet le compteur du compte à zéro (pas celui de l'adresse). */
    async succes(adresse, identifiant) {
      await executer("delete from tentatives_connexion where garde = $1 and portee = 'compte' and adresse = $2 and identifiant = $3", [garde, adresse, norm(identifiant)]);
    },
    /** Retire les entrées dont la fenêtre est finie (appelé périodiquement). */
    async nettoyer() {
      await executer("delete from tentatives_connexion where garde = $1 and debut <= now() - make_interval(secs => $2)", [garde, fenetreS]);
    },
    /** Lève le blocage d'un identifiant, depuis toutes les adresses (pas celui des adresses). */
    async reinitialiserIdentifiant(identifiant) {
      await executer("delete from tentatives_connexion where garde = $1 and portee in ('compte', 'identifiant') and identifiant = $2", [garde, norm(identifiant)]);
    },
  };
}

export const loginGuard = createLoginGuardPg({ garde: "connexion" });
/** Activations par lien : le jeton fait 256 bits (la force brute est hors de portée), la limite ne sert qu'à freiner l'abus ; seuil plus large pour ne pas gêner un réseau partagé. */
export const activationGuard = createLoginGuardPg({ garde: "activation", maxParCompte: 40, maxParIdentifiant: 400, maxParAdresse: 400 });
setInterval(() => {
  // Le nettoyage est un confort : une base momentanément indisponible ne doit jamais arrêter le serveur.
  void loginGuard.nettoyer().catch(() => {});
  void activationGuard.nettoyer().catch(() => {});
}, 5 * 60_000).unref();

/**
 * Lève le blocage de connexion d'un compte employé, à la demande de la personne (un lien d'accès lui est émis ou utilisé).
 * Jamais pour l'administrateur : son blocage ne se lève qu'avec le temps. Renvoie vrai si le blocage a été levé.
 */
export async function leverBlocage(identifiant, garde = loginGuard) {
  const id = String(identifiant || "").trim().toLowerCase();
  if (!id) return false;
  const { rows } = await query("select 1 from administrateurs where lower(identifiant) = $1", [id]);
  if (rows.length > 0) return false;
  await garde.reinitialiserIdentifiant(id);
  return true;
}

/** Comparaison de textes en temps constant (mot de passe), sans fuite sur la longueur. */
export function egalConstant(a, b) {
  const h = (s) => createHash("sha256").update(String(s ?? "")).digest();
  return timingSafeEqual(h(a), h(b));
}

/**
 * Adresse du visiteur pour les compteurs. Derrière un proxy, `req.ip` peut être celle du proxy (tous les visiteurs ont alors la même) :
 * si le proxy transmet l'adresse réelle dans un en-tête de confiance (ex. CLIENT_IP_HEADER=cf-connecting-ip pour Cloudflare), on la lit.
 * N'activez CLIENT_IP_HEADER que si le serveur n'est joignable que par ce proxy : sinon l'en-tête peut être falsifié.
 */
export function adresseClient(req) {
  const nom = (process.env.CLIENT_IP_HEADER || "").trim().toLowerCase();
  const valeur = nom ? String(req.headers?.[nom] ?? "").split(",")[0].trim() : "";
  return valeur || req.ip;
}

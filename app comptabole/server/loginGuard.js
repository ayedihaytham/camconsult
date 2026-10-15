import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Protection contre la force brute sur la connexion : au-delà d'un certain nombre d'échecs, l'identifiant (depuis cette adresse)
 * ou l'adresse elle-même est bloquée pendant la fenêtre. Mémoire du processus : suffisant pour une seule instance (déploiement actuel).
 */
export function createLoginGuard({ maxParCompte = 8, maxParAdresse = 100, fenetreMs = 15 * 60_000, maintenant = () => Date.now() } = {}) {
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
    adresse: `a:${adresse}`,
  });

  return {
    /** Secondes à attendre avant de pouvoir réessayer, ou 0 si la connexion est permise. */
    attente(adresse, identifiant) {
      const { compte, adresse: a } = cles(adresse, identifiant);
      const bloques = [
        [lire(compte), maxParCompte],
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
  };
}

export const loginGuard = createLoginGuard();
setInterval(() => loginGuard.nettoyer(), 5 * 60_000).unref();

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

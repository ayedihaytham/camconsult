import { query } from "./db.js";

/**
 * Sessions ouvertes (une par appareil / navigateur) : chaque jeton porte l'identifiant `sid` de sa session. La personne voit la liste de
 * ses appareils connectés et peut en révoquer un seul ; l'administrateur voit et révoque celles d'un employé. Une session révoquée est
 * refusée à la requête suivante. En plus, la « version des sessions » du compte (server/auth.js) ferme d'un coup toutes les sessions
 * d'un compte (changement de mot de passe) et protège les jetons émis avant la mise en place de cette liste.
 */

/** Durée de vie d'une session (celle du jeton) ; un renouvellement la prolonge. */
const DUREE_S = 12 * 3600;
/** La dernière activité n'est réécrite qu'au bout de ce délai : une écriture par requête serait inutile. */
const RAFRAICHISSEMENT_S = 120;

/** Clé du compte dans la table : « admin » ou l'identifiant de l'employé. */
export const cleCompte = (session) => (session.role === "admin" ? "admin" : String(session.employeId));

/** « Chrome sur Windows », « Safari sur iPhone »… : lisible dans la liste, sans conserver d'information inutile. */
export function libelleAppareil(ua) {
  const t = String(ua ?? "");
  if (!t) return "Appareil inconnu";
  const systeme = /iPhone/.test(t) ? "iPhone" : /iPad/.test(t) ? "iPad" : /Android/.test(t) ? "Android" : /Windows/.test(t) ? "Windows" : /Mac OS X|Macintosh/.test(t) ? "macOS" : /CrOS/.test(t) ? "ChromeOS" : /Linux/.test(t) ? "Linux" : "";
  const navigateur = /Edg\//.test(t) ? "Edge" : /OPR\/|Opera/.test(t) ? "Opera" : /Firefox\//.test(t) ? "Firefox" : /(Chrome|CriOS)\//.test(t) ? "Chrome / Brave" : /Safari\//.test(t) ? "Safari" : /curl|node|undici/i.test(t) ? "Application" : "Navigateur";
  return systeme ? `${navigateur} sur ${systeme}` : navigateur;
}

/** Ouvre une session pour un compte et renvoie son identifiant. `remplacer` supprime d'abord toutes les autres (changement de mot de passe,
 * « déconnecter mes autres appareils ») : la nouvelle est alors la seule. */
export async function ouvrirSession({ compte, adresse, navigateur, remplacer = false }) {
  if (remplacer) await query("delete from sessions_connexion where compte = $1", [compte]);
  const { rows } = await query(
    `insert into sessions_connexion (compte, adresse, navigateur, expire_le) values ($1, $2, $3, now() + make_interval(secs => $4)) returning id`,
    [compte, String(adresse ?? "").slice(0, 100), String(navigateur ?? "").slice(0, 300), DUREE_S],
  );
  return rows[0].id;
}

/** Vrai si la session existe, n'est pas révoquée et n'a pas expiré. Rafraîchit la dernière activité de temps en temps. */
export async function sessionValide(sid, compte) {
  const { rows } = await query(
    "select derniere_activite, extract(epoch from (now() - derniere_activite)) as inactif_s from sessions_connexion where id = $1 and compte = $2 and revoquee_le is null and expire_le > now()",
    [sid, compte],
  );
  if (!rows[0]) return false;
  if (Number(rows[0].inactif_s) > RAFRAICHISSEMENT_S) void query("update sessions_connexion set derniere_activite = now() where id = $1", [sid]).catch(() => {});
  return true;
}

/** Prolonge une session (jeton renouvelé). */
export async function prolongerSession(sid) {
  await query("update sessions_connexion set expire_le = now() + make_interval(secs => $2), derniere_activite = now() where id = $1 and revoquee_le is null", [sid, DUREE_S]);
}

export async function sessionsDuCompte(compte, sidCourante) {
  const { rows } = await query(
    "select id, adresse, navigateur, cree_le, derniere_activite, expire_le from sessions_connexion where compte = $1 and revoquee_le is null and expire_le > now() order by derniere_activite desc",
    [compte],
  );
  return rows.map((r) => ({
    id: r.id,
    courante: r.id === sidCourante,
    appareil: libelleAppareil(r.navigateur),
    adresse: r.adresse,
    creeLe: r.cree_le,
    derniereActivite: r.derniere_activite,
    expireLe: r.expire_le,
  }));
}

/** Révoque une session du compte ; faux si elle n'existe pas (ou plus). */
export async function revoquerSession(compte, sid) {
  const r = await query("update sessions_connexion set revoquee_le = now() where id = $1 and compte = $2 and revoquee_le is null and expire_le > now()", [sid, compte]);
  return r.rowCount === 1;
}

/** Révoque toutes les sessions du compte sauf une (la courante) ; renvoie le nombre révoqué. */
export async function revoquerAutres(compte, sidGardee) {
  const r = await query("update sessions_connexion set revoquee_le = now() where compte = $1 and revoquee_le is null and expire_le > now() and ($2::uuid is null or id <> $2::uuid)", [compte, sidGardee ?? null]);
  return r.rowCount;
}

/** Supprime les sessions finies depuis plus d'un jour (appelé périodiquement). */
export async function nettoyerSessions() {
  await query("delete from sessions_connexion where expire_le < now() - interval '1 day' or revoquee_le < now() - interval '1 day'");
}

setInterval(() => {
  void nettoyerSessions().catch(() => {});
}, 30 * 60_000).unref();

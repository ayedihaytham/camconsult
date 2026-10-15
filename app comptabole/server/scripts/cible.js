// Identification de la base visée par un script d'exploitation, SANS jamais afficher d'identifiants.
/** « hôte:port/base » de DATABASE_URL, ou une erreur si elle est absente (aucun repli sur la base locale par défaut de db.js). */
export function cibleBase(env = process.env) {
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL est absent : aucune base n'est visée, rien n'est exécuté.");
  const u = new URL(env.DATABASE_URL);
  return `${u.hostname}:${u.port || 5432}/${u.pathname.slice(1)}`;
}

/** Vrai si l'hôte est la machine locale (base de développement ou de test). */
export function estLocale(env = process.env) {
  const hote = new URL(env.DATABASE_URL).hostname;
  return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hote);
}

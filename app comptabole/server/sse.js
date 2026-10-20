/**
 * Registre en mémoire des connexions "push" ouvertes (Server-Sent Events),
 * une par onglet connecté. Process unique (pas de cluster/replica), donc
 * pas besoin d'un pub/sub externe (Redis…) — juste une Map en RAM.
 */
const clients = new Map(); // userKey -> Set<ServerResponse>

export function addClient(userKey, res) {
  if (!clients.has(userKey)) clients.set(userKey, new Set());
  clients.get(userKey).add(res);
}

export function removeClient(userKey, res) {
  const set = clients.get(userKey);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) clients.delete(userKey);
}

/** Clés des destinataires qui ont au moins un onglet ouvert (« admin:<id> » ou id d'un employé). */
export function clesEnLigne() {
  return [...clients.keys()];
}

/** Pousse un signal (jamais le contenu métier — le client refait l'appel
 * REST habituel) à toutes les connexions ouvertes de ce destinataire. */
export function pushToUser(userKey, type, payload = {}) {
  // « admin » vise le cabinet : tous les administrateurs connectés.
  if (userKey === "admin") {
    for (const cle of [...clients.keys()]) if (cle.startsWith("admin:")) pushToUser(cle, type, payload);
    return;
  }
  const set = clients.get(userKey);
  if (!set || set.size === 0) return;
  const line = `data: ${JSON.stringify({ type, ...payload })}\n\n`;
  for (const res of set) {
    try {
      res.write(line);
    } catch {
      // connexion morte — nettoyée par son propre listener "close" côté route
    }
  }
}

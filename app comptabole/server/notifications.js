import { query } from "./db.js";

/** Clé destinataire d'après la session. */
export function notifKey(session) {
  return session.role === "admin" ? "admin" : session.employeId;
}

/**
 * Crée une notification (best effort — n'interrompt jamais la requête).
 * @param {string} userKey  'admin' | uuid employé
 */
export function notify(userKey, type, titre, corps = "", lien = "/") {
  if (!userKey) return;
  query(
    `insert into notifications (user_key, type, titre, corps, lien)
     values ($1,$2,$3,$4,$5)`,
    [
      userKey,
      type,
      String(titre ?? "").slice(0, 200),
      String(corps ?? "").slice(0, 500),
      lien,
    ],
  ).catch((err) => console.error("[notif] insert failed", err.message));
}

/** Notifie plusieurs destinataires (doublons / valeurs vides ignorés). */
export function notifyMany(userKeys, type, titre, corps = "", lien = "/") {
  for (const k of [...new Set((userKeys || []).filter(Boolean))]) {
    notify(k, type, titre, corps, lien);
  }
}

/**
 * Personnes concernées par une société : collaborateurs qui l'ont dans leur
 * périmètre (assignation directe OU via une tâche) + employés de cette société.
 * `includeAdmin` ajoute 'admin'.
 */
export async function concernedBySociete(societeId, { includeAdmin = false } = {}) {
  if (!societeId) return includeAdmin ? ["admin"] : [];
  const [collabs, taskCollabs, clients] = await Promise.all([
    query(
      `select id from employes
        where role = 'collaborateur' and statut = 'actif'
          and societes_assignees @> $1::jsonb`,
      [JSON.stringify([societeId])],
    ),
    query(
      `select distinct assigne_id as id from taches
        where societe_id = $1 and assigne_id is not null`,
      [societeId],
    ),
    query(
      `select id from employes
        where role = 'societe_employe' and statut = 'actif' and societe_id = $1`,
      [societeId],
    ),
  ]);
  return [
    ...(includeAdmin ? ["admin"] : []),
    ...collabs.rows.map((r) => r.id),
    ...taskCollabs.rows.map((r) => r.id),
    ...clients.rows.map((r) => r.id),
  ];
}

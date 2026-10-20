import { query } from "./db.js";
import { pushToUser } from "./sse.js";

/** Clé destinataire d'après la session : « admin:<id> » pour un administrateur (chacun a sa propre boîte et son état lu), l'identifiant pour un employé. */
export function notifKey(session) {
  return session.role === "admin" ? `admin:${session.adminId}` : session.employeId;
}

/** Clés de tous les administrateurs actifs (une notification « au cabinet » est copiée pour chacun). */
export async function clesAdmins(executer = query) {
  const { rows } = await executer("select id from administrateurs where statut = 'actif'");
  return rows.map((r) => `admin:${r.id}`);
}

/**
 * Crée une notification (best effort — n'interrompt jamais la requête).
 * Pousse aussi un signal temps réel une fois la ligne insérée (jamais avant
 * — sinon le client pourrait refaire son fetch avant que la notif soit
 * visible en base) au(x) client(s) de ce destinataire déjà connectés.
 * @param {string} userKey  'admin' (tous les administrateurs actifs, chacun reçoit la sienne) | 'admin:<id>' | uuid employé
 */
export function notify(userKey, type, titre, corps = "", lien = "/") {
  if (!userKey) return;
  if (userKey === "admin") {
    clesAdmins()
      .then((cles) => notifyMany(cles, type, titre, corps, lien))
      .catch((err) => console.error("[notif] administrateurs introuvables", err.message));
    return;
  }
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
  )
    .then(() => {
      pushToUser(userKey, "notification");
      // Une notification de type "message" a aussi son propre signal, pour
      // que la conversation ouverte se mette à jour sans passer par le
      // panneau de notifications.
      if (type === "message") pushToUser(userKey, "message");
    })
    .catch((err) => console.error("[notif] insert failed", err.message));
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
  if (!societeId) return includeAdmin ? await clesAdmins() : [];
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
    ...(includeAdmin ? await clesAdmins() : []),
    ...collabs.rows.map((r) => r.id),
    ...taskCollabs.rows.map((r) => r.id),
    ...clients.rows.map((r) => r.id),
  ];
}

import { query } from "./db.js";

/**
 * Lecture des messages pour un lecteur donné. Les messages écrits par le cabinet portent l'administrateur qui les a écrits (`admin_id`, nom
 * affiché), et l'état « lu » des messages REÇUS par le cabinet est propre à chaque administrateur (table `messages_lus_admin`) : quand Karim
 * ouvre une conversation, elle reste non lue pour Sara. Pour l'employé qui a écrit, « lu » veut dire « lu par au moins un administrateur »
 * (`messages.statut`, posé dès qu'un administrateur ouvre la conversation).
 *
 * @param {{ adminId?: string|null, conversationIds?: string[]|null }} options
 *   `adminId` : l'administrateur lecteur (état « lu » à son nom) ; absent pour un employé (état commun `statut`).
 *   `conversationIds` : limite aux conversations de l'employé ; absent pour un administrateur (toutes).
 */
export async function lireMessages({ adminId = null, conversationIds = null } = {}) {
  const { rows } = await query(
    `select m.id, m.conversation_id, m.auteur_id, m.contenu, m.envoye_le,
            case when $1::uuid is not null and m.auteur_id <> 'me' then (case when l.admin_id is not null then 'lu' else 'envoye' end) else m.statut end as statut,
            (m.piece_jointe - 'dataUrl') as piece_jointe, coalesce(m.piece_jointe ? 'dataUrl', false) as pj_a_contenu,
            m.admin_id, a.nom as auteur_nom
       from messages m
       left join administrateurs a on a.id = m.admin_id
       left join messages_lus_admin l on l.message_id = m.id and l.admin_id = $1::uuid
      where ($2::text[] is null or m.conversation_id = any($2::text[]))
      order by m.envoye_le`,
    [adminId, conversationIds],
  );
  return rows;
}

import { query } from "./db.js";

/** Enregistre une action dans le journal (best effort, ne bloque jamais la
 * requête). `entityId` facultatif — permet de retrouver l'historique d'un
 * enregistrement précis (voir GET /collectes/:id/journal) plutôt que de
 * dépendre d'une recherche texte fragile sur `label`. */
export function logAction(actor, action, entity, label, entityId = null) {
  query(
    "insert into journal (actor, action, entity, label, entity_id) values ($1,$2,$3,$4,$5)",
    [actor || "Système", action, entity, String(label ?? "").slice(0, 500), entityId],
  ).catch((err) => console.error("[journal] insert failed", err.message));
}

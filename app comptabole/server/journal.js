import { query } from "./db.js";

/** Enregistre une action dans le journal (best effort, ne bloque jamais la requête). */
export function logAction(actor, action, entity, label) {
  query(
    "insert into journal (actor, action, entity, label) values ($1,$2,$3,$4)",
    [actor || "Système", action, entity, String(label ?? "").slice(0, 500)],
  ).catch((err) => console.error("[journal] insert failed", err.message));
}

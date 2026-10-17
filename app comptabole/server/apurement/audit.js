import { createHash } from "node:crypto";
export function stableJson(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(stableJson);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .filter((k) => value[k] !== undefined)
        .map((k) => [k, stableJson(value[k])]),
    );
  return value;
}
export const hash = (value) =>
  createHash("sha256")
    .update(
      typeof value === "string" || Buffer.isBuffer(value)
        ? value
        : JSON.stringify(stableJson(value)),
    )
    .digest("hex");
export async function audit(
  client,
  session,
  societeId,
  action,
  entityId,
  before,
  after,
) {
  await client.query(
    `insert into apurement_audit (societe_id,acteur,action,entity_id,avant,apres)
    values ($1,$2,$3,$4,$5,$6)`,
    [
      societeId,
      session.employeId || "admin",
      action,
      entityId,
      before ? JSON.stringify(before) : null,
      after ? JSON.stringify(after) : null,
    ],
  );
}
// Serialize writes for one company before locking domain rows. This order is
// also used by Stock, approval and import to prevent cross-domain deadlocks.
export async function lockCompany(client, id) {
  await client.query(
    "select pg_advisory_xact_lock(hashtextextended($1, 7241))",
    [id],
  );
}

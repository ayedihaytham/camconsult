import { withTransaction } from "../db.js";
import { pushToUser } from "../sse.js";

export async function internalRecipients(c, societeId) {
  const rows = (
    await c.query(
      `select e.id from employes e where e.statut='actif' and e.role in ('collaborateur','responsable_collaborateurs')
    and (e.role='responsable_collaborateurs' or e.societes_assignees @> $1::jsonb
      or exists(select 1 from taches t where t.assigne_id=e.id and t.societe_id=$2))`,
      [JSON.stringify([societeId]), societeId],
    )
  ).rows;
  return ["admin", ...rows.map((r) => r.id)];
}
export async function notifyInternal(
  c,
  societeId,
  titre,
  corps = "",
  recipients = null,
) {
  const keys = recipients || (await internalRecipients(c, societeId));
  for (const key of keys) {
    await c.query(
      `insert into notifications(user_key,type,titre,corps,lien) values($1,'apurement',$2,$3,$4)`,
      [
        key,
        titre.slice(0, 200),
        corps.slice(0, 500),
        `/apurement/${societeId}`,
      ],
    );
    c.apurementNotifications?.add(key);
  }
}
// Rows are transactional; realtime signals are emitted only after COMMIT.
export async function withApurementTransaction(fn) {
  const recipients = new Set();
  const result = await withTransaction(async (c) => {
    c.apurementNotifications = recipients;
    try {
      return await fn(c);
    } finally {
      delete c.apurementNotifications;
    }
  });
  for (const key of recipients) pushToUser(key, "notification");
  return result;
}

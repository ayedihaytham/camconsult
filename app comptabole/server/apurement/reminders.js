import { z } from "zod";
import { query } from "../db.js";
import { withApurementTransaction as withTransaction } from "./notifications.js";
import { company, dto } from "./repository.js";
import { periodSchema, parse, uuid, day } from "./domain.js";
import { audit } from "./audit.js";
import { internalRecipients, notifyInternal } from "./notifications.js";
import { manager } from "./permissions.js";
const rule = periodSchema.extend({
  societeId: uuid,
  echeance: day,
  cadenceJours: z.number().int().min(1).max(365),
  actif: z.boolean(),
});
export function registerReminders(router) {
  router.get("/rappels", async (req, res) => {
    const v = parse(periodSchema.extend({ societeId: uuid }), req.query);
    await company({ query }, req.session, v.societeId);
    res.json(
      (
        await query(
          "select * from apurement_reminder_rules where societe_id=$1 and annee=$2 and trimestre=$3",
          [v.societeId, v.annee, v.trimestre],
        )
      ).rows.map(dto),
    );
  });
  router.put("/rappels", async (req, res) => {
    const v = parse(rule, req.body);
    manager(req.session);
    res.json(
      await withTransaction(async (c) => {
        await company(c, req.session, v.societeId, true);
        const row = (
          await c.query(
            `insert into apurement_reminder_rules(societe_id,annee,trimestre,echeance,cadence_jours,actif) values($1,$2,$3,$4,$5,$6)
        on conflict(societe_id,annee,trimestre) do update set echeance=excluded.echeance,cadence_jours=excluded.cadence_jours,actif=excluded.actif returning *`,
            [
              v.societeId,
              v.annee,
              v.trimestre,
              v.echeance,
              v.cadenceJours,
              v.actif,
            ],
          )
        ).rows[0];
        await audit(
          c,
          req.session,
          v.societeId,
          "rappel.configurer",
          row.id,
          null,
          row,
        );
        return dto(row);
      }),
    );
  });
}
export async function runReminders() {
  return withTransaction(sendDueReminders);
}
export async function sendDueReminders(c) {
  const rules = (
    await c.query(`select *,floor(((now() at time zone 'Africa/Tunis')::date-echeance)::numeric/cadence_jours)::int as fenetre
      from apurement_reminder_rules where actif and echeance <= (now() at time zone 'Africa/Tunis')::date for update skip locked`)
  ).rows;
  let sent = 0;
  for (const rule of rules)
    for (const recipient of await internalRecipients(c, rule.societe_id)) {
      const run = await c.query(
        "insert into apurement_reminder_runs(rule_id,user_key,fenetre) values($1,$2,$3) on conflict do nothing returning rule_id",
        [rule.id, recipient, rule.fenetre],
      );
      if (!run.rowCount) continue;
      await notifyInternal(
        c,
        rule.societe_id,
        "Rappel Apurement",
        `${rule.annee} ${rule.trimestre} : échéance définie par le cabinet.`,
        [recipient],
      );
      sent++;
    }
  return sent;
}
export function startApurementReminders() {
  const run = () =>
    runReminders().catch((e) =>
      console.error("[apurement/rappels]", e.message),
    );
  const timer = setInterval(run, 3600000);
  timer.unref();
  void run();
  return timer;
}
